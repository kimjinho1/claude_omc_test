import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt', maxAge: 3600 },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // Sync user with backend on first login
        try {
          // INTERNAL_API_URL is used for server-side calls (e.g. Docker: http://backend:3001)
          // Falls back to NEXT_PUBLIC_API_URL for local dev
          const backendUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
          const res = await fetch(`${backendUrl}/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'google',
              providerId: profile.sub,
              email: profile.email,
              name: profile.name,
              image: profile.picture,
            }),
          });
          const data = await res.json();
          token.accessToken = data.accessToken;
          token.userId = data.user?.id;
        } catch (e) {
          console.error('Backend sync failed', e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.user.id = token.userId as string;
      return session;
    },
  },
});

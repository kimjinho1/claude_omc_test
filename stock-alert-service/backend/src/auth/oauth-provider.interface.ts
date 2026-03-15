export interface IOAuthProvider {
  name: string;
  getAuthUrl(): string;
  exchangeCode(
    code: string,
  ): Promise<{ email: string; name?: string; image?: string }>;
}

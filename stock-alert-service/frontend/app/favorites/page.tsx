'use client';

import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Favorite = { id: string; symbol: string; stock: { name: string; market: string } };

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function FavoritesPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken ?? '';

  const favKey = token ? `${API_URL}/favorites` : null;
  const { data: favorites = [] } = useSWR<Favorite[]>(favKey, (url: string) => fetcher(url, token));

  async function removeFavorite(symbol: string) {
    await fetch(`${API_URL}/favorites/${symbol}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    mutate(favKey);
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">← 목록으로</Link>
        <h1 className="text-xl font-bold">즐겨찾기</h1>
      </div>
      <div className="divide-y divide-gray-800 rounded-xl bg-gray-900">
        {favorites.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-4 py-3">
            <Link href={`/stocks/${f.symbol}`} className="flex-1">
              <div className="font-medium">{f.stock?.name ?? f.symbol}</div>
              <div className="text-xs text-gray-400">{f.symbol} · {f.stock?.market}</div>
            </Link>
            <button onClick={() => removeFavorite(f.symbol)}
              className="ml-4 rounded-lg px-3 py-1 text-xs text-red-400 hover:bg-red-950 transition-colors">
              제거
            </button>
          </div>
        ))}
        {!favorites.length && <div className="py-12 text-center text-gray-500">즐겨찾기가 없습니다</div>}
      </div>
    </div>
  );
}

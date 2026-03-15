'use client';

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Stock = { symbol: string; name: string; market: string };

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [market, setMarket] = useState<'KR' | 'US'>('KR');

  if (status === 'unauthenticated') { router.push('/login'); return null; }
  if (status === 'loading') return <div className="p-8 text-gray-400">로딩 중...</div>;

  const token = (session as { accessToken?: string })?.accessToken ?? '';

  return (
    <StockList market={market} token={token} onMarketChange={setMarket} />
  );
}

function StockList({ market, token, onMarketChange }: { market: 'KR' | 'US'; token: string; onMarketChange: (m: 'KR' | 'US') => void }) {
  const { data: rawStocks, isLoading } = useSWR<Stock[]>(
    token ? `${API_URL}/stocks?market=${market}` : null,
    (url: string) => fetcher(url, token),
    { refreshInterval: 30000 },
  );
  const stocks = Array.isArray(rawStocks) ? rawStocks : [];

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">주식 목록</h1>
        <nav className="flex gap-2 items-center">
          <Link href="/favorites" className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white">즐겨찾기</Link>
          <Link href="/settings/alerts" className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white">알림 설정</Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="rounded-lg px-3 py-1.5 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            로그아웃
          </button>
        </nav>
      </div>
      <div className="mb-4 flex gap-2">
        {(['KR', 'US'] as const).map((m) => (
          <button key={m} onClick={() => onMarketChange(m)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${market === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
            {m === 'KR' ? '한국 (KOSPI)' : '미국 (US)'}
          </button>
        ))}
      </div>
      {isLoading ? (
        <div className="py-12 text-center text-gray-400">불러오는 중...</div>
      ) : (
        <div className="divide-y divide-gray-800 rounded-xl bg-gray-900">
          {stocks.map((s) => (
            <Link key={s.symbol} href={`/stocks/${s.symbol}`}
              className="flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors first:rounded-t-xl last:rounded-b-xl">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-400">{s.symbol} · {s.market}</div>
              </div>
              <span className="text-gray-500">›</span>
            </Link>
          ))}
          {!stocks.length && <div className="py-12 text-center text-gray-500">종목 없음</div>}
        </div>
      )}
    </div>
  );
}

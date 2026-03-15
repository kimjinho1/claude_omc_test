'use client';

import { use, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { useSession } from 'next-auth/react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import Link from 'next/link';
import DropBadge from '@/components/DropBadge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

type StockDetail = {
  symbol: string; name: string; market: string;
  price?: string; change?: string; changePercent?: string; volume?: number;
  per?: string; pbr?: string; dividendYield?: string;
  week52High?: string; week52Low?: string;
  analytics?: { high6m: string };
};

type OHLCVBar = { date: string; close: string };
type Favorite = { symbol: string };

export default function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = use(params);
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken ?? '';
  const [toggling, setToggling] = useState(false);

  // Chart range zoom state
  const [zoomOffset, setZoomOffset] = useState(0);
  const [zoomCount, setZoomCount] = useState<number | null>(null);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);

  const { data: detail } = useSWR<StockDetail>(
    token ? `${API_URL}/stocks/${symbol}` : null,
    (url: string) => fetcher(url, token),
    { refreshInterval: 30000 },
  );

  const { data: chart = [] } = useSWR<OHLCVBar[]>(
    token ? `${API_URL}/stocks/${symbol}/chart?period=1m` : null,
    (url: string) => fetcher(url, token),
  );

  const favKey = token ? `${API_URL}/favorites` : null;
  const { data: favorites = [] } = useSWR<Favorite[]>(favKey, (url: string) => fetcher(url, token));
  const isFavorite = Array.isArray(favorites) && favorites.some((f) => f.symbol === symbol);

  async function toggleFavorite() {
    if (!token) return;
    setToggling(true);
    try {
      await fetch(`${API_URL}/favorites/${symbol}`, {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      mutate(favKey);
    } finally {
      setToggling(false);
    }
  }

  // Compute displayed chart data with zoom applied
  const baseData = chart.slice(-60);
  const displayData = zoomCount !== null
    ? baseData.slice(zoomOffset, zoomOffset + zoomCount)
    : baseData.slice(zoomOffset);

  const isZoomed = zoomOffset > 0 || zoomCount !== null;

  function handleChartClick(data: { activeTooltipIndex?: number | string | null } | null) {
    if (!data) return;
    const raw = data.activeTooltipIndex;
    if (typeof raw !== 'number') return;
    const idx = raw;

    if (pendingIdx === null) {
      // First click: mark start
      setPendingIdx(idx);
    } else {
      // Second click: apply zoom
      const start = Math.min(pendingIdx, idx);
      const end = Math.max(pendingIdx, idx);
      if (start < end) {
        setZoomOffset((prev) => prev + start);
        setZoomCount(end - start + 1);
      }
      setPendingIdx(null);
    }
  }

  function resetZoom() {
    setZoomOffset(0);
    setZoomCount(null);
    setPendingIdx(null);
  }

  const pendingDate = pendingIdx !== null ? displayData[pendingIdx]?.date : undefined;

  if (!detail) return <div className="p-8 text-gray-400">불러오는 중...</div>;

  const dropPct = detail.analytics?.high6m && detail.price
    ? ((parseFloat(detail.analytics.high6m) - parseFloat(detail.price)) / parseFloat(detail.analytics.high6m)) * 100
    : null;

  const changeNum = detail.changePercent ? parseFloat(detail.changePercent) : 0;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Link href="/dashboard" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← 목록으로</Link>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{detail.name}</h1>
          <p className="text-sm text-gray-400">{detail.symbol} · {detail.market}</p>
        </div>
        <div className="flex items-center gap-2">
          {dropPct !== null && <DropBadge dropPercent={dropPct} />}
          <button
            onClick={toggleFavorite}
            disabled={toggling}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              isFavorite
                ? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {isFavorite ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기'}
          </button>
        </div>
      </div>

      <div className="mb-6 flex items-end gap-3">
        <span className="text-3xl font-bold">{detail.price ? Number(detail.price).toLocaleString() : '-'}</span>
        <span className={`text-lg font-medium ${changeNum >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {changeNum >= 0 ? '+' : ''}{detail.changePercent}%
        </span>
      </div>

      {chart.length > 0 && (
        <div className="mb-6 rounded-xl bg-gray-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {pendingIdx !== null
                ? '⬜ 종료점을 클릭하세요'
                : '📍 차트 클릭으로 시작점 선택 (2번 클릭으로 범위 확대)'}
            </span>
            {isZoomed && (
              <button onClick={resetZoom} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                전체 범위 보기
              </button>
            )}
          </div>
          <div style={{ cursor: 'crosshair' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={displayData} onClick={handleChartClick}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={60} />
                <Tooltip contentStyle={{ background: '#111827', border: 'none', borderRadius: 8 }} />
                <Line type="monotone" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={2} />
                {pendingDate && (
                  <ReferenceLine x={pendingDate} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={2} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '전일 대비', value: detail.change },
          { label: '거래량', value: detail.volume?.toLocaleString() },
          { label: 'PER', value: detail.per },
          { label: 'PBR', value: detail.pbr },
          { label: '배당률', value: detail.dividendYield ? `${detail.dividendYield}%` : '-' },
          { label: '52주 최고', value: detail.week52High ? Number(detail.week52High).toLocaleString() : '-' },
          { label: '52주 최저', value: detail.week52Low ? Number(detail.week52Low).toLocaleString() : '-' },
          { label: '6개월 전고점', value: detail.analytics?.high6m ? Number(detail.analytics.high6m).toLocaleString() : '-' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg bg-gray-900 p-3">
            <div className="text-xs text-gray-400">{label}</div>
            <div className="mt-1 font-medium">{value ?? '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

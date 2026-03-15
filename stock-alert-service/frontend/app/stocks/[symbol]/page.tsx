'use client';

import { use, useRef, useState } from 'react';

type Period = '1d' | '1w' | '1m' | '3m' | '1y';
const PERIODS: { value: Period; label: string }[] = [
  { value: '1d', label: '시간별' },
  { value: '1w', label: '1주' },
  { value: '1m', label: '1달' },
  { value: '3m', label: '3달' },
  { value: '1y', label: '1년' },
];

import DropBadge from '@/components/DropBadge';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import useSWR, { mutate } from 'swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Recharts default margin + YAxis width
const CHART_LEFT_OFFSET = 5 + 60; // marginLeft + yAxisWidth
const CHART_RIGHT_OFFSET = 5;      // marginRight

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
  const [period, setPeriod] = useState<Period>('1m');

  // Chart range zoom state
  const [zoomOffset, setZoomOffset] = useState(0);
  const [zoomCount, setZoomCount] = useState<number | null>(null);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Chart range zoom state
  const [zoomOffset, setZoomOffset] = useState(0);
  const [zoomCount, setZoomCount] = useState<number | null>(null);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const { data: detail } = useSWR<StockDetail>(
    token ? `${API_URL}/stocks/${symbol}` : null,
    (url: string) => fetcher(url, token),
    { refreshInterval: 30000 },
  );

  const { data: chart = [] } = useSWR<OHLCVBar[]>(
    token ? `${API_URL}/stocks/${symbol}/chart?period=${period}` : null,
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

  const baseData = chart.slice(-60);
  const displayData = zoomCount !== null
    ? baseData.slice(zoomOffset, zoomOffset + zoomCount)
    : baseData.slice(zoomOffset);

  const isZoomed = zoomOffset > 0 || zoomCount !== null;

  function getDataIndexFromClick(clientX: number): number | null {
    const el = chartContainerRef.current;
    if (!el || displayData.length === 0) return null;
    const rect = el.getBoundingClientRect();
    const dataAreaLeft = rect.left + CHART_LEFT_OFFSET;
    const dataAreaWidth = rect.width - CHART_LEFT_OFFSET - CHART_RIGHT_OFFSET;
    const clickX = clientX - dataAreaLeft;
    if (clickX < 0 || clickX > dataAreaWidth) return null;
    const ratio = clickX / dataAreaWidth;
    return Math.min(Math.round(ratio * (displayData.length - 1)), displayData.length - 1);
  }

  function handleChartAreaClick(e: React.MouseEvent<HTMLDivElement>) {
    const idx = getDataIndexFromClick(e.clientX);
    if (idx === null) return;

    if (pendingIdx === null) {
      setPendingIdx(idx);
    } else {
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

  function handlePeriodChange(p: Period) {
    setPeriod(p);
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
          {/* Period selector */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePeriodChange(p.value)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    period === p.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {isZoomed && (
              <button onClick={resetZoom} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                전체 범위 보기
              </button>
            )}
          </div>
          <div className="mb-2">
            <span className="text-xs text-gray-500">
              {pendingIdx !== null
                ? `⬜ 종료점을 클릭하세요 (시작: ${pendingDate ?? ''})`
                : '📍 차트 클릭 → 시작점, 재클릭 → 범위 확대'}
            </span>
          </div>
          {/* div-level click handler — more reliable than Recharts onClick */}
          <div
            ref={chartContainerRef}
            style={{ cursor: 'crosshair' }}
            onClick={handleChartAreaClick}
          >
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={displayData} margin={{ top: 5, right: CHART_RIGHT_OFFSET, bottom: 5, left: 5 }}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} width={60} />
                <Tooltip contentStyle={{ background: '#111827', border: 'none', borderRadius: 8 }} />
                <Line type="monotone" dataKey="close" stroke="#3b82f6" dot={false} strokeWidth={2} />
                {pendingDate && (
                  <ReferenceLine x={pendingDate} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={2} label={{ value: '시작', fill: '#f59e0b', fontSize: 10 }} />
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

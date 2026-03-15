'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const LEVELS = [10, 15, 20, 25, 30] as const;

type AlertSetting = { thresholds: number[] };

function fetcher(url: string, token: string) {
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
}

export default function AlertSettingsPage() {
  const { data: session } = useSession();
  const token = (session as { accessToken?: string })?.accessToken ?? '';

  const { data } = useSWR<AlertSetting>(
    token ? `${API_URL}/users/alert-settings` : null,
    (url: string) => fetcher(url, token),
  );

  const [selected, setSelected] = useState<Set<number>>(new Set([10, 20, 30]));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.thresholds) setSelected(new Set(data.thresholds));
  }, [data]);

  function toggle(level: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(level) ? next.delete(level) : next.add(level);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch(`${API_URL}/users/alert-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ thresholds: Array.from(selected) }),
    });
    setSaving(false);
    setSaved(true);
  }

  const levelInfo: Record<number, { label: string; colorClass: string }> = {
    10: { label: '10% 하락', colorClass: 'border-yellow-600 bg-yellow-950 text-yellow-300' },
    15: { label: '15% 하락', colorClass: 'border-orange-600 bg-orange-950 text-orange-300' },
    20: { label: '20% 하락', colorClass: 'border-red-600 bg-red-950 text-red-300' },
    25: { label: '25% 하락', colorClass: 'border-red-800 bg-red-950 text-red-200' },
    30: { label: '30% 하락', colorClass: 'border-gray-600 bg-gray-900 text-gray-300' },
  };

  return (
    <div className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-center gap-4">
        <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">← 대시보드</Link>
        <h1 className="text-xl font-bold">알림 설정</h1>
      </div>
      <p className="mb-4 text-sm text-gray-400">전고점 대비 하락 시 알림을 받을 단계를 선택하세요.</p>
      <div className="space-y-2">
        {LEVELS.map((level) => {
          const info = levelInfo[level];
          const isOn = selected.has(level);
          return (
            <label key={level}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all ${isOn ? info.colorClass : 'border-gray-800 bg-gray-900 text-gray-400'}`}>
              <input type="checkbox" checked={isOn} onChange={() => toggle(level)} className="h-4 w-4 accent-current" />
              <span className="font-medium">{info.label}</span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-500">즐겨찾기 종목은 선택 여부와 무관하게 모든 단계 알림을 받습니다.</p>
      <button onClick={save} disabled={saving}
        className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
        {saving ? '저장 중...' : saved ? '✓ 저장됨' : '저장'}
      </button>
    </div>
  );
}

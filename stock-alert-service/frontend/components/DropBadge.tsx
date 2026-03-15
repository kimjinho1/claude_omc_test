export default function DropBadge({ dropPercent }: { dropPercent: number }) {
  if (dropPercent < 10) return null;

  const { label, className } =
    dropPercent >= 30 ? { label: `▼${dropPercent.toFixed(1)}%`, className: 'bg-gray-900 text-white border border-gray-600' } :
    dropPercent >= 25 ? { label: `▼${dropPercent.toFixed(1)}%`, className: 'bg-red-950 text-red-300' } :
    dropPercent >= 20 ? { label: `▼${dropPercent.toFixed(1)}%`, className: 'bg-red-900 text-red-200' } :
    dropPercent >= 15 ? { label: `▼${dropPercent.toFixed(1)}%`, className: 'bg-orange-900 text-orange-200' } :
    { label: `▼${dropPercent.toFixed(1)}%`, className: 'bg-yellow-900 text-yellow-200' };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

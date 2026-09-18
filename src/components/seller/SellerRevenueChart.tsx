type RevenuePoint = { day: string; revenue: number };

export default function SellerRevenueChart({ weekly }: { weekly: RevenuePoint[] }) {
  const width = 640;
  const height = 224;
  const padding = { top: 16, right: 12, bottom: 32, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(1, ...weekly.map((point) => point.revenue));
  const columnWidth = weekly.length ? Math.min(52, chartWidth / weekly.length * 0.58) : 0;

  if (weekly.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Revenue data will appear after delivered orders.</div>;
  }

  return (
    <div className="h-full" role="img" aria-label="Revenue for the last seven days">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight * (1 - ratio);
          return <g key={ratio}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="currentColor" className="text-border" strokeDasharray="3 3" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px]">${Math.round(maximum * ratio)}</text>
          </g>;
        })}
        {weekly.map((point, index) => {
          const valueHeight = chartHeight * (point.revenue / maximum);
          const x = padding.left + chartWidth * ((index + 0.5) / weekly.length) - columnWidth / 2;
          const y = padding.top + chartHeight - valueHeight;
          return <g key={point.day}>
            <title>{`${point.day}: $${point.revenue.toFixed(2)}`}</title>
            <rect x={x} y={y} width={columnWidth} height={valueHeight} rx="6" className="fill-primary" />
            <text x={x + columnWidth / 2} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">{point.day}</text>
          </g>;
        })}
      </svg>
    </div>
  );
}

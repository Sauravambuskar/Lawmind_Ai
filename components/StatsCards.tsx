export interface StatsCardsData {
  total: number;
  hot: number;
  warm: number;
  avgScore: number;
}

export function StatsCards({ stats }: { stats: StatsCardsData }) {
  const cards = [
    { label: "Total Leads", value: stats.total, accent: "text-slate-900" },
    { label: "Hot Leads", value: stats.hot, accent: "text-red-600" },
    { label: "Warm Leads", value: stats.warm, accent: "text-amber-600" },
    { label: "Average Lead Score", value: stats.avgScore, accent: "text-blue-600" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">{card.label}</p>
          <p className={`mt-2 text-3xl font-semibold ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

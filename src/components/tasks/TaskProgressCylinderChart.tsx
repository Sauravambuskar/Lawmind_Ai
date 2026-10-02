import { useEffect, useRef } from "react";
import Highcharts from "highcharts";
import Highcharts3D from "highcharts/highcharts-3d";

const ChartEngine = Highcharts3D || Highcharts;

const CHART_COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#e11d48",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

export interface TaskProgressChartItem {
  name: string;
  progress: number;
  openTasks: number;
  completedTasks: number;
}

export function TaskProgressCylinderChart({ data }: { data: TaskProgressChartItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const dark = document.documentElement.classList.contains("dark");
    const textColor = dark ? "#e5e7eb" : "#334155";
    const mutedColor = dark ? "#94a3b8" : "#64748b";
    const gridColor = dark ? "rgba(148, 163, 184, 0.16)" : "rgba(100, 116, 139, 0.16)";

    const chart = ChartEngine.chart(containerRef.current, {
      chart: {
        type: "cylinder",
        backgroundColor: "transparent",
        height: 330,
        marginTop: 24,
        options3d: {
          enabled: true,
          alpha: 15,
          beta: 15,
          depth: 50,
          viewDistance: 25,
        },
        scrollablePlotArea: {
          minWidth: Math.max(680, data.length * 95),
          scrollPositionX: 0,
        },
      },
      title: { text: undefined },
      subtitle: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      colors: CHART_COLORS,
      xAxis: {
        categories: data.map(item => item.name),
        lineColor: gridColor,
        tickColor: gridColor,
        title: { text: undefined },
        labels: {
          skew3d: true,
          style: {
            color: textColor,
            fontSize: "11px",
            fontWeight: "600",
            textOverflow: "ellipsis",
          },
        },
      },
      yAxis: {
        min: 0,
        max: 100,
        tickInterval: 20,
        gridLineColor: gridColor,
        title: {
          margin: 18,
          text: "Task progress (%)",
          style: { color: mutedColor, fontSize: "11px", fontWeight: "600" },
        },
        labels: {
          skew3d: true,
          format: "{value}%",
          style: { color: mutedColor, fontSize: "10px" },
        },
      },
      tooltip: {
        useHTML: true,
        headerFormat: "<b>{category}</b><br/>",
        pointFormatter: function () {
          const item = data[this.index];
          return `<span style="color:${this.color}">●</span> <b>${this.y}% complete</b><br/>${item.openTasks} open / ${item.completedTasks} done`;
        },
      },
      plotOptions: {
        series: {
          depth: 28,
          colorByPoint: true,
          animation: { duration: 650 },
          borderWidth: 0,
          dataLabels: {
            enabled: true,
            format: "{y}%",
            style: {
              color: textColor,
              fontSize: "11px",
              fontWeight: "700",
              textOutline: "none",
            },
          },
        },
      },
      series: [{
        type: "cylinder",
        name: "Task progress",
        showInLegend: false,
        data: data.map((item, index) => ({
          y: item.progress,
          color: CHART_COLORS[index % CHART_COLORS.length],
        })),
      }],
    });

    return () => chart.destroy();
  }, [data]);

  if (data.length === 0) {
    return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No team task progress available.</div>;
  }

  return (
    <>
      <div ref={containerRef} className="min-h-[330px] w-full" aria-label="Team task progress cylinder chart" />
      <ul className="sr-only">
        {data.map(item => (
          <li key={item.name}>{item.name}: {item.progress}% task progress</li>
        ))}
      </ul>
    </>
  );
}

type MetricName = "CLS" | "FCP" | "INP" | "LCP" | "TTFB";

interface PerformanceMetric {
  name: MetricName;
  value: number;
  route: string;
  recordedAt: string;
}

const endpoint = import.meta.env.VITE_PERFORMANCE_ENDPOINT as string | undefined;

function report(name: MetricName, value: number): void {
  if (!Number.isFinite(value)) return;

  const metric: PerformanceMetric = {
    name,
    value: Math.round(value * 100) / 100,
    route: window.location.pathname,
    recordedAt: new Date().toISOString(),
  };

  if (import.meta.env.DEV) console.debug("[performance]", metric);
  if (!endpoint) return;

  const body = JSON.stringify(metric);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(endpoint, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => undefined);
}

function observe(type: string, callback: (entry: PerformanceEntry) => void): void {
  try {
    const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
    observer.observe({ type, buffered: true });
  } catch {
    // Older browsers simply skip unsupported metrics.
  }
}

/** Starts lightweight Core Web Vitals collection without adding a dependency. */
export function startPerformanceMonitoring(): void {
  if (typeof window === "undefined" || !("PerformanceObserver" in window)) return;

  observe("paint", (entry) => {
    if (entry.name === "first-contentful-paint") report("FCP", entry.startTime);
  });
  observe("largest-contentful-paint", (entry) => report("LCP", entry.startTime));

  let cls = 0;
  observe("layout-shift", (entry) => {
    const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
    if (!shift.hadRecentInput) cls += shift.value || 0;
  });

  let inp = 0;
  observe("event", (entry) => {
    if (entry.duration > inp) inp = entry.duration;
  });

  const flush = () => {
    report("CLS", cls);
    if (inp > 0) report("INP", inp);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });

  window.addEventListener("load", () => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation) report("TTFB", navigation.responseStart);
  }, { once: true });
}

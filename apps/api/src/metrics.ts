/** Minimal Prometheus-style counters. Enough for Phase B; a full metrics library can come in Phase G. */
export class Metrics {
  private counters = new Map<string, number>();

  inc(name: string, labels: Record<string, string> = {}, by = 1): void {
    const key = name + labelString(labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  render(): string {
    const lines = [...this.counters.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k} ${v}`);
    return lines.join('\n') + '\n';
  }
}

function labelString(labels: Record<string, string>): string {
  const entries = Object.entries(labels);
  if (entries.length === 0) return '';
  return '{' + entries.map(([k, v]) => `${k}="${v.replace(/"/g, '')}"`).join(',') + '}';
}

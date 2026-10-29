import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DailyUsage {
  day: string;
  total_tokens: number;
  prompt_tokens: number;
  output_tokens: number;
  request_count: number;
}

export function UsageChart() {
  const [data, setData] = useState<DailyUsage[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = async () => {
      setFailed(false);
      const { data: rows, error } = await supabase
        .from('gemini_daily_usage')
        .select('day, total_tokens, prompt_tokens, output_tokens, request_count')
        .order('day', { ascending: true })
        .limit(7);
      if (error) { setFailed(true); return; }
      setData(rows ?? []);
    };
    load();
  }, []);

  const today = new Date();
  const last7: { date: Date; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    last7.push({
      date: d,
      label: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    });
  }

  const byDay = new Map<string, DailyUsage>();
  data?.forEach((row) => byDay.set(row.day, row));

  const chartData = last7.map(({ date, label }) => {
    const key = date.toISOString().slice(0, 10);
    const row = byDay.get(key);
    return {
      label,
      total: row?.total_tokens ?? 0,
      prompt: row?.prompt_tokens ?? 0,
      output: row?.output_tokens ?? 0,
      requests: row?.request_count ?? 0,
    };
  });

  const maxTokens = Math.max(1, ...chartData.map((d) => d.total));
  const weekTotal = chartData.reduce((sum, d) => sum + d.total, 0);
  const weekRequests = chartData.reduce((sum, d) => sum + d.requests, 0);

  if (failed) {
    return (
      <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={16} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-white">Daily Token Consumption (7 days)</h4>
        </div>
        <p className="text-xs text-slate-400">Could not load usage data.</p>
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={16} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-white">Daily Token Consumption (7 days)</h4>
        </div>
        <p className="text-xs text-slate-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-amber-400" />
          <h4 className="text-sm font-semibold text-white">Daily Token Consumption (7 days)</h4>
        </div>
        <div className="text-[11px] text-slate-400">
          <span className="text-slate-300">{weekTotal.toLocaleString()}</span> tokens · <span className="text-slate-300">{weekRequests}</span> requests
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 h-32">
        {chartData.map((d, i) => {
          const heightPct = (d.total / maxTokens) * 100;
          const promptPct = d.total > 0 ? (d.prompt / d.total) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="relative w-full flex flex-col justify-end h-24">
                <div className="relative w-full mx-auto rounded-t-md overflow-hidden transition-all duration-300" style={{ height: `${Math.max(heightPct, d.total > 0 ? 4 : 0)}%` }}>
                  <div className="absolute bottom-0 w-full bg-amber-500/60" style={{ height: `${promptPct}%` }} />
                  <div className="absolute top-0 w-full bg-amber-400" style={{ height: `${100 - promptPct}%` }} />
                </div>
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white z-10">
                  {d.total.toLocaleString()} tokens · {d.requests} req
                </div>
              </div>
              <span className="text-[10px] text-slate-500">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/60" /> Input</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" /> Output</span>
      </div>
    </div>
  );
}

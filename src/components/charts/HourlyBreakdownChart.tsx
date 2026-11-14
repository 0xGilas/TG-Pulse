import React from 'react';
import type { ParsedStatsGraph } from '../../types/analytics';

interface HourlyBreakdownChartProps {
  graph: ParsedStatsGraph;
  title: string;
}

export const HourlyBreakdownChart: React.FC<HourlyBreakdownChartProps> = ({ graph, title }) => {
  const primary = graph.series[0];
  const secondary = graph.series[1];

  if (!primary || primary.values.length === 0) {
    return (
      <div className="tg-panel rounded-2xl p-5">
        <h3 className="text-[13px] font-semibold text-[#5eb5f7]">{title}</h3>
        <p className="text-xs text-[#7f91a4] mt-3">No hourly activity data available yet.</p>
      </div>
    );
  }

  const maxVal = Math.max(1, ...primary.values, ...(secondary?.values ?? [0]));
  const peakIdx = primary.values.indexOf(Math.max(...primary.values));

  return (
    <section className="tg-panel rounded-2xl p-5" aria-label={title}>
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <h3 className="text-[13px] font-semibold text-[#5eb5f7]">{title}</h3>
        <span dir="ltr" className="text-xs text-[#7f91a4] font-mono-num">
          Peak: {String(peakIdx).padStart(2, '0')}:00 UTC ({primary.values[peakIdx]})
        </span>
      </div>

      <div className="grid grid-cols-12 sm:grid-cols-24 gap-1.5 items-end h-36 pt-4" dir="ltr">
        {primary.values.map((val, hour) => {
          const pct = Math.max(4, Math.round((val / maxVal) * 100));
          const isPeak = hour === peakIdx;
          return (
            <div key={hour} className="flex flex-col items-center justify-end h-full group relative">
              <div
                className={`w-full rounded-t-sm transition-colors ${
                  isPeak ? 'bg-[#3390ec]' : 'bg-[#3390ec]/40 group-hover:bg-[#5eb5f7]'
                }`}
                style={{ height: `${pct}%` }}
                title={`${String(hour).padStart(2, '0')}:00 UTC — ${val} views`}
              />
              <span className="mt-1.5 text-[10px] text-[#5d6f82] font-mono-num">
                {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import type { ParsedStatsGraph } from '../../types/analytics';
import { formatCompactNumber, formatDateKey } from '../../utils/analyticsMath';

interface TelegramTimeChartProps {
  graph: ParsedStatsGraph;
  subtitle?: string;
  selectedDateKey?: string | null;
  onSelectDate?: (dateKey: string) => void;
  height?: number;
  showRangeSlider?: boolean;
}

function formatAxisDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const TelegramTimeChart: React.FC<TelegramTimeChartProps> = ({
  graph,
  subtitle,
  selectedDateKey,
  onSelectDate,
  height = 240,
  showRangeSlider = true,
}) => {
  const totalPoints = graph.timestamps.length;
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(() => Math.max(0, totalPoints - 1));
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const clampedStart = Math.max(0, Math.min(rangeStart, Math.max(0, totalPoints - 2)));
  const clampedEnd = Math.max(clampedStart + 1, Math.min(rangeEnd, Math.max(0, totalPoints - 1)));

  const visibleIndices = useMemo(() => {
    if (totalPoints === 0) return [];
    const arr: number[] = [];
    for (let i = clampedStart; i <= clampedEnd; i += 1) {
      arr.push(i);
    }
    return arr;
  }, [totalPoints, clampedStart, clampedEnd]);

  const activeSeries = useMemo(
    () => graph.series.filter((s) => !hiddenSeries[s.key]),
    [graph.series, hiddenSeries],
  );

  const { maxVal, minVal } = useMemo(() => {
    let max = 1;
    let min = 0;
    if (graph.type === 'stacked_bar') {
      for (const idx of visibleIndices) {
        const sum = activeSeries.reduce((acc, s) => acc + (s.values[idx] ?? 0), 0);
        if (sum > max) max = sum;
      }
      return { maxVal: max, minVal: 0 };
    }
    let foundAny = false;
    for (const s of activeSeries) {
      for (const idx of visibleIndices) {
        const v = s.values[idx] ?? 0;
        if (!foundAny) {
          max = v;
          min = v;
          foundAny = true;
        } else {
          if (v > max) max = v;
          if (v < min) min = v;
        }
      }
    }
    if (graph.type === 'bar' || min > 0) {
      min = graph.series.length === 1 && min > 10 ? Math.floor(min * 0.92) : 0;
    }
    if (max === min) max = min + 1;
    return { maxVal: max, minVal: min };
  }, [activeSeries, visibleIndices, graph.type, graph.series.length]);

  const svgWidth = 760;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const getX = (localIdx: number) => {
    if (visibleIndices.length <= 1) return padLeft + plotW / 2;
    return padLeft + (localIdx / (visibleIndices.length - 1)) * plotW;
  };

  const getY = (val: number) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return padTop + plotH - ratio * plotH;
  };

  const toggleSeries = (key: string) => {
    setHiddenSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const remaining = graph.series.filter((s) => !next[s.key]);
      if (remaining.length === 0) return prev;
      return next;
    });
  };

  if (totalPoints === 0) {
    return (
      <div className="tg-panel rounded-2xl p-5">
        <div className="text-[13px] font-semibold text-[#5eb5f7]">{graph.title}</div>
        <div className="mt-3 text-xs text-[#7f91a4]">
          {graph.error || 'No chart data available for this period.'}
        </div>
      </div>
    );
  }

  const activeHoverGlobalIdx =
    hoverIdx !== null && visibleIndices[hoverIdx] !== undefined ? visibleIndices[hoverIdx] : null;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(minVal + t * (maxVal - minVal)));

  return (
    <section className="tg-panel rounded-2xl p-4 sm:p-5" aria-label={graph.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-[#5eb5f7]">{graph.title}</h3>
          {subtitle && <p className="text-xs text-[#7f91a4] mt-0.5">{subtitle}</p>}
        </div>
        <div dir="ltr" className="text-xs text-[#7f91a4] font-mono-num">
          {formatAxisDate(graph.timestamps[clampedStart])} — {formatAxisDate(graph.timestamps[clampedEnd])}
        </div>
      </div>

      <div className="relative select-none" dir="ltr">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label={`${graph.title} interactive chart`}
        >
          {/* Horizontal Grid Lines */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={svgWidth - padRight}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#5d6f82] text-[10px] font-mono-num"
                >
                  {formatCompactNumber(tick)}
                </text>
              </g>
            );
          })}

          {/* Selected Date Vertical Highlight */}
          {selectedDateKey &&
            visibleIndices.map((globalIdx, localIdx) => {
              if (formatDateKey(graph.timestamps[globalIdx]) !== selectedDateKey) return null;
              const x = getX(localIdx);
              return (
                <g key={`sel-${globalIdx}`}>
                  <rect
                    x={x - 14}
                    y={padTop}
                    width={28}
                    height={plotH}
                    rx={6}
                    fill="rgba(245, 166, 35, 0.12)"
                  />
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={padTop + plotH}
                    stroke="#f5a623"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                </g>
              );
            })}

          {/* Hover Crosshair */}
          {hoverIdx !== null && visibleIndices[hoverIdx] !== undefined && (
            <line
              x1={getX(hoverIdx)}
              y1={padTop}
              x2={getX(hoverIdx)}
              y2={padTop + plotH}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1}
            />
          )}

          {/* Bars or Lines */}
          {graph.type === 'bar' || graph.type === 'stacked_bar'
            ? visibleIndices.map((globalIdx, localIdx) => {
                const slotWidth = Math.max(8, Math.min(34, plotW / visibleIndices.length - 8));
                const centerX = getX(localIdx);

                if (graph.type === 'stacked_bar') {
                  let accY = padTop + plotH;
                  return (
                    <g key={globalIdx}>
                      {activeSeries.map((s) => {
                        const val = s.values[globalIdx] ?? 0;
                        const barH = (val / (maxVal || 1)) * plotH;
                        accY -= barH;
                        return (
                          <rect
                            key={s.key}
                            x={centerX - slotWidth / 2}
                            y={accY}
                            width={slotWidth}
                            height={Math.max(0, barH)}
                            fill={s.color}
                            opacity={0.9}
                          />
                        );
                      })}
                    </g>
                  );
                }

                const subWidth = slotWidth / Math.max(1, activeSeries.length);
                return (
                  <g key={globalIdx}>
                    {activeSeries.map((s, sIdx) => {
                      const val = s.values[globalIdx] ?? 0;
                      const y = getY(val);
                      const barH = Math.max(2, padTop + plotH - y);
                      return (
                        <rect
                          key={s.key}
                          x={centerX - slotWidth / 2 + sIdx * subWidth}
                          y={y}
                          width={Math.max(3, subWidth - 2)}
                          height={barH}
                          rx={2}
                          fill={s.color}
                          opacity={0.92}
                        />
                      );
                    })}
                  </g>
                );
              })
            : activeSeries.map((s) => {
                const points = visibleIndices
                  .map((globalIdx, localIdx) => `${getX(localIdx)},${getY(s.values[globalIdx] ?? 0)}`)
                  .join(' ');
                return (
                  <g key={s.key}>
                    <polyline
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2.25}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={points}
                    />
                    {visibleIndices.map((globalIdx, localIdx) => {
                      const dateKey = formatDateKey(graph.timestamps[globalIdx]);
                      const isSelected = selectedDateKey === dateKey;
                      const isHovered = hoverIdx === localIdx;
                      if (!isSelected && !isHovered && visibleIndices.length > 16) return null;
                      return (
                        <circle
                          key={`${s.key}-${globalIdx}`}
                          cx={getX(localIdx)}
                          cy={getY(s.values[globalIdx] ?? 0)}
                          r={isSelected || isHovered ? 4 : 2.75}
                          fill="#17212b"
                          stroke={s.color}
                          strokeWidth={2}
                        />
                      );
                    })}
                  </g>
                );
              })}

          {/* X Axis Labels */}
          {visibleIndices.map((globalIdx, localIdx) => {
            const step = visibleIndices.length > 10 ? Math.ceil(visibleIndices.length / 7) : 1;
            if (localIdx % step !== 0 && localIdx !== visibleIndices.length - 1) return null;
            const dateKey = formatDateKey(graph.timestamps[globalIdx]);
            const isSelected = selectedDateKey === dateKey;
            return (
              <text
                key={`x-${globalIdx}`}
                x={getX(localIdx)}
                y={height - 8}
                textAnchor="middle"
                className={`text-[10px] font-mono-num ${
                  isSelected ? 'fill-[#f5a623] font-semibold' : 'fill-[#5d6f82]'
                }`}
              >
                {formatAxisDate(graph.timestamps[globalIdx])}
              </text>
            );
          })}

          {/* Clickable / Hoverable Vertical Slots */}
          {visibleIndices.map((globalIdx, localIdx) => {
            const colW = plotW / Math.max(1, visibleIndices.length);
            const dateKey = formatDateKey(graph.timestamps[globalIdx]);
            return (
              <rect
                key={`hit-${globalIdx}`}
                x={getX(localIdx) - colW / 2}
                y={padTop}
                width={colW}
                height={plotH + 22}
                fill="transparent"
                className={onSelectDate ? 'cursor-pointer' : 'cursor-crosshair'}
                onMouseEnter={() => setHoverIdx(localIdx)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => onSelectDate?.(dateKey)}
              />
            );
          })}
        </svg>

        {/* Floating Liquid Glass Tooltip (Matches native Telegram popover) */}
        {activeHoverGlobalIdx !== null && (
          <div
            className="pointer-events-none absolute top-2 right-2 tg-sheet-glass rounded-xl px-3 py-2"
            style={{ minWidth: 148 }}
          >
            <div className="text-[11px] font-medium text-[#7f91a4] font-mono-num mb-1">
              {formatAxisDate(graph.timestamps[activeHoverGlobalIdx])}
            </div>
            <div className="space-y-1">
              {activeSeries.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4 text-xs">
                  <span className="text-[#f5f7fa]">{s.label}</span>
                  <span className="font-mono-num font-semibold" style={{ color: s.color }}>
                    {(s.values[activeHoverGlobalIdx] ?? 0).toLocaleString('en-US')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Telegram-style Range Slider */}
      {showRangeSlider && totalPoints > 4 && (
        <div className="mt-2 pt-2.5 border-t border-white/[0.06] flex items-center gap-3" dir="ltr">
          <span className="text-[11px] text-[#5d6f82] whitespace-nowrap">Range</span>
          <input
            type="range"
            aria-label={`${graph.title} start range`}
            min={0}
            max={Math.max(0, totalPoints - 2)}
            value={clampedStart}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRangeStart(Math.min(v, clampedEnd - 1));
            }}
            className="w-full accent-[#3390ec] h-1 bg-[#111923] rounded-lg cursor-pointer"
          />
          <input
            type="range"
            aria-label={`${graph.title} end range`}
            min={1}
            max={Math.max(1, totalPoints - 1)}
            value={clampedEnd}
            onChange={(e) => {
              const v = Number(e.target.value);
              setRangeEnd(Math.max(v, clampedStart + 1));
            }}
            className="w-full accent-[#3390ec] h-1 bg-[#111923] rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Native Telegram Series Toggle Chips + Clickable Share Dates */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {graph.series.map((s) => {
            const active = !hiddenSeries[s.key];
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSeries(s.key)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'text-[#0e1621]'
                    : 'border border-white/10 bg-transparent text-[#7f91a4] hover:text-[#f5f7fa]'
                }`}
                style={active ? { backgroundColor: s.color } : undefined}
              >
                {active && <Check className="w-3 h-3 stroke-[2.5]" />}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        {onSelectDate && (
          <div className="flex flex-wrap items-center gap-1.5" dir="ltr">
            {visibleIndices
              .filter((idx) => {
                const shareSeries =
                  graph.series.find((s) => /share|forward/i.test(s.label)) ?? graph.series[1];
                return shareSeries && (shareSeries.values[idx] ?? 0) > 0;
              })
              .map((idx) => {
                const dateKey = formatDateKey(graph.timestamps[idx]);
                const shareSeries =
                  graph.series.find((s) => /share|forward/i.test(s.label)) ?? graph.series[1];
                const sharesVal = shareSeries?.values[idx] ?? 0;
                const isSelected = selectedDateKey === dateKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => onSelectDate(dateKey)}
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-mono-num transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'border-[#f5a623] bg-[#f5a623]/15 text-[#f5a623]'
                        : 'border-white/[0.08] bg-[#111923] text-[#7f91a4] hover:text-[#f5f7fa]'
                    }`}
                  >
                    {formatAxisDate(graph.timestamps[idx])}: +{sharesVal}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
};

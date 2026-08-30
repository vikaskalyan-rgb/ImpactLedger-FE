import { useMemo } from "react";
import { Flame } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ActivityHeatmapProps {
  heatmap: Record<string, number>;
  weeks?: number;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreaks(heatmap: Record<string, number>): { current: number; longest: number } {
  const activeDays = new Set(Object.keys(heatmap).filter((k) => heatmap[k] > 0));
  if (activeDays.size === 0) return { current: 0, longest: 0 };

  // Longest streak: walk all active dates in sorted order
  const sorted = Array.from(activeDays).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // Current streak: walk backward from today (or yesterday, so a day not yet logged doesn't break it)
  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If today has no activity yet, start checking from yesterday instead — otherwise
  // a streak would falsely reset to 0 every day before you've had a chance to log anything.
  if (!activeDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (activeDays.has(toDateKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, longest };
}

function intensityClass(count: number): string {
  if (count === 0) return "bg-surface-hover";
  if (count === 1) return "bg-brand/30";
  if (count === 2) return "bg-brand/55";
  if (count === 3) return "bg-brand/80";
  return "bg-brand";
}

export function ActivityHeatmap({ heatmap, weeks = 18 }: ActivityHeatmapProps) {
  const { columns, monthLabels, streaks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Align the grid to end on the most recent Saturday so weeks read Sun-Sat like GitHub's.
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()));

    const totalDays = weeks * 7;
    const start = new Date(endOfWeek);
    start.setDate(endOfWeek.getDate() - totalDays + 1);

    const cols: { date: Date; key: string; count: number }[][] = [];
    const labels: { weekIndex: number; label: string }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < weeks; w++) {
      const col: { date: Date; key: string; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(start.getDate() + w * 7 + d);
        const key = toDateKey(date);
        col.push({ date, key, count: heatmap[key] ?? 0 });
        if (d === 0 && date.getMonth() !== lastMonth && date <= today) {
          lastMonth = date.getMonth();
          labels.push({ weekIndex: w, label: date.toLocaleDateString(undefined, { month: "short" }) });
        }
      }
      cols.push(col);
    }

    return { columns: cols, monthLabels: labels, streaks: computeStreaks(heatmap) };
  }, [heatmap, weeks]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2 sm:pb-2">
        <CardTitle className="text-foreground text-base font-semibold">Activity</CardTitle>
        {streaks.current > 0 && (
          <div className="flex items-center gap-1.5 text-sm font-medium text-warning">
            <Flame className="h-4 w-4" />
            {streaks.current} day{streaks.current === 1 ? "" : "s"} streak
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex flex-col gap-1">
            <div className="flex gap-[3px] pl-0 text-[10px] text-muted-foreground" style={{ height: 12 }}>
              {columns.map((_, i) => {
                const label = monthLabels.find((m) => m.weekIndex === i);
                return (
                  <div key={i} className="w-[11px] shrink-0">
                    {label ? label.label : ""}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              {columns.map((col, i) => (
                <div key={i} className="flex flex-col gap-[3px]">
                  {col.map((day) => (
                    <div
                      key={day.key}
                      title={`${day.key}: ${day.count} task${day.count === 1 ? "" : "s"}`}
                      className={`h-[11px] w-[11px] rounded-[2px] ${intensityClass(day.count)}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>Longest streak: {streaks.longest} day{streaks.longest === 1 ? "" : "s"}</span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            <div className="h-[10px] w-[10px] rounded-[2px] bg-surface-hover" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-brand/30" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-brand/55" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-brand/80" />
            <div className="h-[10px] w-[10px] rounded-[2px] bg-brand" />
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

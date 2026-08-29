import type { ReactNode } from "react";
import { Document, Page, View, Text, Svg, Path, Rect, Font, StyleSheet } from "@react-pdf/renderer";
import type { AppraisalType, PdfMode, Priority, Recognition, Task } from "@/types";

// Registers Inter to match the web app's own font-sans exactly. Only reachable
// with real internet access (works fine once deployed; Google Fonts isn't
// reachable from every sandboxed dev environment, but that's not a concern here).
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.ttf", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50SmZi_lu3-nn0.ttf", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50VXTa_lu3-nn0.ttf", fontWeight: 700 },
  ],
});

// ---- Palette — identical hex values to the web app's CSS variables ----
const COLORS = {
  ink: "#1A1D23",
  muted: "#616B79",
  mutedForeground: "#8D97A5",
  border: "#E2E5EA",
  borderStrong: "#C9C9C9",
  brand: "#1D70A8",
  headerTint: "#F3F6FA",
  p1: "#D33A3A",
  p2: "#B7791F",
  p3: "#1D70A8",
  minor: "#6B7280",
  success: "#1F8A54",
  gold: "#B8862E",
};

const CHART_PALETTE = ["#1D70A8", "#3E92CC", "#C9A45C", "#B5657A", "#7A9E7E", "#8A93A6", "#A07AB5"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function priorityColor(p?: Priority | string | null): string {
  return { P1: COLORS.p1, P2: COLORS.p2, P3: COLORS.p3, MINOR: COLORS.minor }[p as string] ?? COLORS.minor;
}

function crisp(text: string | null | undefined, limit: number): string {
  if (!text) return "\u2014";
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > limit ? clean.slice(0, limit).trim() + "\u2026" : clean;
}

function referenceDate(t: Task): string | null {
  return t.endDate ?? t.startDate;
}

function quarterOf(t: Task): number | null {
  const ref = referenceDate(t);
  if (!ref) return null;
  const month = Number(ref.slice(5, 7));
  return Math.ceil(month / 3);
}

// ---- Stats (mirrors the backend's StatsService.buildStats logic) ----
interface Stats {
  byPriority: Record<string, number>;
  byTaskType: Record<string, number>;
  byMonth: Record<string, number>; // completed tasks only
  byTech: Record<string, number>;
}

function computeStats(tasks: Task[]): Stats {
  const byPriority: Record<string, number> = {};
  const byTaskType: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  const byTech: Record<string, number> = {};

  tasks.forEach((t) => {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
    (t.taskTypes || []).forEach((tt) => { byTaskType[tt] = (byTaskType[tt] || 0) + 1; });
    const ref = referenceDate(t);
    if (ref && t.status === "COMPLETED") {
      const ym = ref.slice(0, 7);
      byMonth[ym] = (byMonth[ym] || 0) + 1;
    }
    (t.techStack || []).forEach((tech) => { byTech[tech] = (byTech[tech] || 0) + 1; });
  });

  return { byPriority, byTaskType, byMonth, byTech };
}

// ---- SVG donut chart geometry ----
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function ringSlicePath(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const gap = 1.5;
  const s = startAngle + gap / 2;
  const e = endAngle - gap / 2;
  const p1 = polarToCartesian(cx, cy, outerR, e);
  const p2 = polarToCartesian(cx, cy, outerR, s);
  const p3 = polarToCartesian(cx, cy, innerR, s);
  const p4 = polarToCartesian(cx, cy, innerR, e);
  const largeArc = e - s <= 180 ? 0 : 1;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
}

// ---- Styles ----
const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, color: COLORS.ink, paddingTop: 40, paddingBottom: 44, paddingHorizontal: 40 },
  coverName: { fontSize: 30, fontWeight: 700, textAlign: "center", marginTop: 60 },
  coverTitle: { fontSize: 11, color: COLORS.muted, textAlign: "center", marginTop: 6, textTransform: "uppercase", letterSpacing: 1 },
  coverPeriod: { fontSize: 11, color: COLORS.muted, textAlign: "center", marginTop: 2 },
  statRow: { flexDirection: "row", marginTop: 34, gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 3, padding: 12, alignItems: "center" },
  statNumber: { fontSize: 20, fontWeight: 700 },
  statLabel: { fontSize: 7, color: COLORS.muted, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  docsLine: { fontSize: 8, color: COLORS.muted, textAlign: "center", marginTop: 10, fontStyle: "italic" },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginTop: 22, marginBottom: 8 },
  sectionMarker: { width: 4, height: 13, backgroundColor: COLORS.brand, marginRight: 7 },
  sectionTitle: { fontSize: 12.5, fontWeight: 700 },
  sectionRule: { borderBottomWidth: 1, borderBottomColor: COLORS.borderStrong, marginBottom: 12 },

  overviewRow: { flexDirection: "row", gap: 40 },
  overviewCol: { flex: 1 },
  chartTitle: { fontSize: 9.5, fontWeight: 700, marginBottom: 8 },
  donutRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  legend: { flexDirection: "column", gap: 5 },
  legendRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
  swatch: { width: 8, height: 8, marginTop: 2, borderRadius: 1.5 },
  legendLabel: { fontSize: 7.5, fontWeight: 700 },
  legendSub: { fontSize: 7, color: COLORS.muted },

  barChartRow: { flexDirection: "row", gap: 6 },
  yAxisCol: { justifyContent: "space-between", width: 16 },
  axisLabel: { fontSize: 6, color: COLORS.mutedForeground, textAlign: "right" },
  barLabels: { flexDirection: "row", marginTop: 2 },
  barLabel: { fontSize: 7, color: COLORS.mutedForeground, textAlign: "center" },

  techLabel: { fontSize: 7, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16 },
  techLine: { fontSize: 7.5, color: COLORS.muted, marginTop: 3, lineHeight: 1.5 },

  quarterMetaTable: { marginBottom: 10 },
  quarterMetaHeaderRow: { flexDirection: "row", backgroundColor: COLORS.headerTint, borderBottomWidth: 1, borderBottomColor: COLORS.borderStrong },
  quarterMetaHeaderCell: { flex: 1, fontSize: 6.5, fontWeight: 700, color: COLORS.muted, padding: 5, textTransform: "uppercase" },
  quarterMetaRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  quarterMetaCell: { flex: 1, fontSize: 8, padding: 5 },

  table: { marginTop: 4 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.headerTint, borderBottomWidth: 1, borderBottomColor: COLORS.borderStrong },
  th: { fontSize: 6.5, fontWeight: 700, color: COLORS.muted, padding: 6, textTransform: "uppercase" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  td: { padding: 6, fontSize: 8 },
  taskTitle: { fontSize: 8.5, fontWeight: 600 },
  taskTicket: { fontSize: 7, color: COLORS.mutedForeground, marginTop: 1 },
  priorityText: { fontSize: 8, fontWeight: 700 },
  linkText: { fontSize: 7.5, color: COLORS.brand },
  mutedText: { fontSize: 7.5, color: COLORS.muted },

  highlightTitle: { fontSize: 10, fontWeight: 700 },
  highlightTicket: { fontSize: 8, color: COLORS.muted, fontStyle: "italic" },
  highlightImpact: { fontSize: 9, marginTop: 3, marginBottom: 10 },
  recognitionMeta: { fontSize: 9, fontWeight: 700 },
  recognitionMessage: { fontSize: 9, marginBottom: 6 },

  pageFooter: { position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: COLORS.mutedForeground },
});

function SectionHeading({ children }: { children: string }) {
  return (
    <>
      <View style={s.sectionHeaderRow}>
        <View style={s.sectionMarker} />
        <Text style={s.sectionTitle}>{children}</Text>
      </View>
      <View style={s.sectionRule} />
    </>
  );
}

function DonutWithLegend({
  title, dataMap, order, colors, size = 100,
}: {
  title: string;
  dataMap: Record<string, number>;
  order?: string[];
  colors: string[];
  size?: number;
}) {
  const entries = (order ?? Object.keys(dataMap)).filter((k) => dataMap[k] > 0);
  const total = entries.reduce((sum, k) => sum + dataMap[k], 0);
  const cx = size / 2, cy = size / 2, outerR = size * 0.46, innerR = size * 0.27;

  let cursor = 0;
  const slices = entries.map((key, i) => {
    const value = dataMap[key];
    const angle = (value / total) * 360;
    const path = ringSlicePath(cx, cy, outerR, innerR, cursor, cursor + angle);
    cursor += angle;
    return <Path key={key} d={path} fill={colors[i % colors.length]} />;
  });

  return (
    <View style={s.overviewCol}>
      <Text style={s.chartTitle}>{title}</Text>
      <View style={s.donutRow}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {slices}
        </Svg>
        <View style={s.legend}>
          {entries.map((key, i) => {
            const value = dataMap[key];
            const pct = Math.round((value / total) * 100);
            return (
              <View key={key} style={s.legendRow}>
                <View style={{ ...s.swatch, backgroundColor: colors[i % colors.length] }} />
                <View>
                  <Text style={s.legendLabel}>{key}  {pct}%</Text>
                  <Text style={s.legendSub}>{value} task{value === 1 ? "" : "s"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function BarChart({
  title, dataMap, chartW = 140, chartH = 70, barW = 14,
}: {
  title: string;
  dataMap: Record<string, number>;
  chartW?: number;
  chartH?: number;
  barW?: number;
}) {
  const entries = Object.entries(dataMap).sort(([a], [b]) => a.localeCompare(b));
  const rawMax = Math.max(...entries.map(([, v]) => v), 1);
  const axisMax = niceMax(rawMax);
  const tickCount = 5;
  const scale = chartH / axisMax;
  const barSlot = chartW / entries.length;
  const actualBarW = Math.min(barW, barSlot * 0.5);

  const gridlines = [];
  const tickValues: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    const value = Math.round((axisMax / tickCount) * i);
    const y = chartH - value * scale;
    gridlines.push(<Path key={`grid-${i}`} d={`M 0 ${y} L ${chartW} ${y}`} stroke={COLORS.border} strokeWidth={0.5} />);
    tickValues.push(value);
  }
  tickValues.reverse();

  const bars = entries.map(([month, value], i) => {
    const slotX = i * barSlot + (barSlot - actualBarW) / 2;
    const barH = value * scale;
    return <Rect key={month} x={slotX} y={chartH - barH} width={actualBarW} height={barH} fill={COLORS.brand} rx={2} />;
  });

  return (
    <View style={s.overviewCol}>
      <Text style={s.chartTitle}>{title}</Text>
      <View style={s.barChartRow}>
        <View style={{ ...s.yAxisCol, height: chartH }}>
          {tickValues.map((v, i) => <Text key={i} style={s.axisLabel}>{v}</Text>)}
        </View>
        <View>
          <Svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`}>
            {gridlines}
            {bars}
          </Svg>
          <View style={s.barLabels}>
            {entries.map(([month]) => (
              <Text key={month} style={{ ...s.barLabel, width: barSlot }}>{monthLabel(month)}</Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function OverviewSection({ tasks }: { tasks: Task[] }) {
  const stats = computeStats(tasks);
  const priorityOrder = ["P1", "P2", "P3", "MINOR"];
  const priorityColors = [COLORS.p1, COLORS.p2, COLORS.p3, COLORS.minor];
  const typeOrder = Object.keys(stats.byTaskType);
  const techLine = Object.entries(stats.byTech)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k]) => k)
    .join("   \u00b7   ");

  return (
    <>
      <SectionHeading>Overview</SectionHeading>
      <View style={s.overviewRow}>
        <DonutWithLegend title="By Priority" dataMap={stats.byPriority} order={priorityOrder} colors={priorityColors} size={130} />
        <DonutWithLegend title="By Task Type" dataMap={stats.byTaskType} order={typeOrder} colors={CHART_PALETTE} size={130} />
      </View>

      {Object.keys(stats.byMonth).length > 0 && (
        <>
          <View style={{ height: 20 }} />
          <BarChart title="Completed by Month" dataMap={stats.byMonth} chartW={460} chartH={130} barW={40} />
        </>
      )}

      {techLine && (
        <>
          <Text style={s.techLabel}>Tech Touched</Text>
          <Text style={s.techLine}>{techLine}</Text>
        </>
      )}
    </>
  );
}

function StatStrip({ tasks }: { tasks: Task[] }) {
  const totalPrs = tasks.reduce((sum, t) => sum + (t.prLinks?.length ?? 0), 0);
  const totalDocs = tasks.filter((t) => t.designDocLink && t.designDocLink.trim() !== "").length;
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const p1s = tasks.filter((t) => t.priority === "P1").length;

  const cards = [
    { number: tasks.length, label: "Tasks Delivered", accent: COLORS.brand },
    { number: completed, label: "Completed", accent: COLORS.success },
    { number: p1s, label: "P1 Initiatives", accent: COLORS.p1 },
    { number: totalPrs, label: "PRs Merged", accent: COLORS.gold },
  ];

  return (
    <>
      <View style={s.statRow}>
        {cards.map((c) => (
          <View key={c.label} style={{ ...s.statCard, borderTopColor: c.accent }}>
            <Text style={s.statNumber}>{c.number}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.docsLine}>{totalDocs} design docs authored or updated</Text>
    </>
  );
}

function CoverPage({ name, title, periodLabel, tasks }: { name: string; title: string; periodLabel: string; tasks: Task[] }) {
  return (
    <>
      <Text style={s.coverName}>{name}</Text>
      <Text style={s.coverTitle}>{title}</Text>
      <Text style={s.coverPeriod}>{periodLabel}</Text>
      <StatStrip tasks={tasks} />
      <OverviewSection tasks={tasks} />
    </>
  );
}

function LinksCell({ task }: { task: Task }) {
  const links: ReactNode[] = [];
  if (task.prLinks && task.prLinks.length === 1) {
    links.push(<Text key="pr" style={s.linkText}>View PR</Text>);
  } else if (task.prLinks && task.prLinks.length > 1) {
    links.push(<Text key="pr" style={s.mutedText}>{task.prLinks.length} PRs merged</Text>);
  }
  if (task.designDocLink) {
    links.push(<Text key="doc" style={s.linkText}>View Doc</Text>);
  }
  if (links.length === 0) links.push(<Text key="none" style={s.mutedText}>\u2014</Text>);
  return <View style={{ ...s.td, flex: 1.5 }}>{links}</View>;
}

function TaskRow({ task }: { task: Task }) {
  return (
    <View style={s.tr} wrap={false}>
      <View style={{ ...s.td, flex: 2.6 }}>
        <Text style={s.taskTitle}>{task.title}</Text>
        <Text style={s.taskTicket}>{task.ticketId}</Text>
      </View>
      <View style={{ ...s.td, flex: 0.9 }}>
        <Text style={{ ...s.priorityText, color: priorityColor(task.priority) }}>{task.priority}</Text>
      </View>
      <View style={{ ...s.td, flex: 3.3 }}>
        <Text>{crisp(task.impact || task.description, 150)}</Text>
      </View>
      <LinksCell task={task} />
    </View>
  );
}

function TaskTable({ tasks }: { tasks: Task[] }) {
  const sorted = [...tasks].sort((a, b) => (referenceDate(b) ?? "").localeCompare(referenceDate(a) ?? ""));
  return (
    <View style={s.table}>
      <View style={s.tableHeaderRow}>
        <Text style={{ ...s.th, flex: 2.6 }}>Task</Text>
        <Text style={{ ...s.th, flex: 0.9 }}>Priority</Text>
        <Text style={{ ...s.th, flex: 3.3 }}>Impact</Text>
        <Text style={{ ...s.th, flex: 1.5 }}>Links</Text>
      </View>
      {sorted.map((t) => <TaskRow key={t.id} task={t} />)}
    </View>
  );
}

function QuarterSection({ label, tasks }: { label: string; tasks: Task[] }) {
  const byMonth: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    const ref = referenceDate(t);
    if (!ref) return;
    const ym = ref.slice(0, 7);
    (byMonth[ym] = byMonth[ym] || []).push(t);
  });
  const monthEntries = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a));

  return (
    <>
      <SectionHeading>{label}</SectionHeading>
      <View style={s.quarterMetaTable}>
        <View style={s.quarterMetaHeaderRow}>
          <Text style={s.quarterMetaHeaderCell}>Month</Text>
          <Text style={s.quarterMetaHeaderCell}>Tasks</Text>
          <Text style={s.quarterMetaHeaderCell}>P1 / Major</Text>
          <Text style={s.quarterMetaHeaderCell}>PRs Merged</Text>
        </View>
        {monthEntries.map(([ym, mTasks]) => (
          <View key={ym} style={s.quarterMetaRow}>
            <Text style={s.quarterMetaCell}>{monthLabel(ym)}</Text>
            <Text style={s.quarterMetaCell}>{mTasks.length}</Text>
            <Text style={s.quarterMetaCell}>{mTasks.filter((t) => t.priority === "P1" || t.complexity === "MAJOR").length}</Text>
            <Text style={s.quarterMetaCell}>{mTasks.reduce((sum, t) => sum + (t.prLinks?.length ?? 0), 0)}</Text>
          </View>
        ))}
      </View>
      <TaskTable tasks={tasks} />
    </>
  );
}

function HighlightsAndRecognition({ tasks, recognitions }: { tasks: Task[]; recognitions: Recognition[] }) {
  const highlights = tasks.filter((t) => t.highlight);
  if (highlights.length === 0 && recognitions.length === 0) return null;

  return (
    <Page size="A4" style={s.page}>
      {highlights.length > 0 && (
        <>
          <SectionHeading>Highlights</SectionHeading>
          {highlights.map((t) => (
            <View key={t.id} wrap={false}>
              <Text style={s.highlightTitle}>
                {t.title} <Text style={s.highlightTicket}>({t.ticketId})</Text>
              </Text>
              <Text style={s.highlightImpact}>{crisp(t.impact || t.description, 220)}</Text>
            </View>
          ))}
        </>
      )}
      {recognitions.length > 0 && (
        <>
          <SectionHeading>Recognition</SectionHeading>
          {recognitions.map((r) => (
            <View key={r.id} wrap={false} style={{ marginBottom: 6 }}>
              <Text style={s.recognitionMeta}>{r.date} \u2014 {r.source}</Text>
              <Text style={s.recognitionMessage}>{r.message}</Text>
            </View>
          ))}
        </>
      )}
      <Text style={s.pageFooter} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
    </Page>
  );
}

// ---- Public API ----

export interface ReportOptions {
  mode: PdfMode;
  appraisalType?: AppraisalType;
  year: number;
  month?: number;
  profileName: string;
  profileTitle: string;
  tasks: Task[];
  recognitions: Recognition[];
}

export function ReportDocument({ mode, appraisalType, year, month, profileName, profileTitle, tasks, recognitions }: ReportOptions) {
  const periodLabel =
    mode === "APPRAISAL"
      ? appraisalType === "MIDYEAR"
        ? `Mid-Year Review ${year} \u00b7 Jan\u2013Jun`
        : `Year-End Review ${year}`
      : month
      ? `Progress Update \u00b7 ${MONTH_NAMES[month - 1]} ${year}`
      : `Progress Update \u00b7 ${year}`;

  if (mode === "MONTHLY") {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <CoverPage name={profileName} title={profileTitle} periodLabel={periodLabel} tasks={tasks} />
          <Text style={s.pageFooter} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
        </Page>
        <Page size="A4" style={s.page}>
          <SectionHeading>Tasks This Period</SectionHeading>
          <TaskTable tasks={tasks} />
          <Text style={s.pageFooter} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
        </Page>
        <HighlightsAndRecognition tasks={tasks} recognitions={recognitions} />
      </Document>
    );
  }

  // APPRAISAL mode: group into quarters
  const maxQuarter = appraisalType === "MIDYEAR" ? 2 : 4;
  const quarters: Record<number, Task[]> = {};
  tasks.forEach((t) => {
    const q = quarterOf(t);
    if (q !== null && q <= maxQuarter) (quarters[q] = quarters[q] || []).push(t);
  });
  const quarterKeys = Object.keys(quarters).map(Number).sort((a, b) => a - b);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <CoverPage name={profileName} title={profileTitle} periodLabel={periodLabel} tasks={tasks} />
        <Text style={s.pageFooter} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
      </Page>
      {quarterKeys.map((q) => (
        <Page key={q} size="A4" style={s.page}>
          <QuarterSection label={`Q${q} ${year} Highlights`} tasks={quarters[q]} />
          <Text style={s.pageFooter} render={({ pageNumber }) => `Page ${pageNumber}`} fixed />
        </Page>
      ))}
      <HighlightsAndRecognition tasks={tasks} recognitions={recognitions} />
    </Document>
  );
}

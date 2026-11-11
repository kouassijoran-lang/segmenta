"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { SEGMENT_COLORS, SEGMENTS, formatInteger, type DashboardMetrics, type SegmentProfile } from "@/lib/analytics"

const segmentConfig = Object.fromEntries(SEGMENTS.map((segment) => [segment, {
  label: `Segment ${segment}`,
  color: SEGMENT_COLORS[segment],
}])) satisfies ChartConfig

const spendingConfig = {
  Low: { label: "Faibles", color: "#35ad88" },
  Average: { label: "Moyennes", color: "#dfa94f" },
  High: { label: "Élevées", color: "#4d83cf" },
} satisfies ChartConfig

export function SegmentDistributionChart({ profiles }: { profiles: SegmentProfile[] }) {
  const data = profiles.filter((profile) => profile.count > 0).map((profile) => ({
    segment: profile.segment,
    count: profile.count,
    fill: SEGMENT_COLORS[profile.segment],
  }))
  const total = data.reduce((sum, item) => sum + item.count, 0)

  if (!total) return <p className="chart-empty">Aucun segment étiqueté dans le jeu filtré.</p>

  return (
    <div className="donut-layout">
      <ChartContainer config={segmentConfig} className="h-[250px] w-full">
        <PieChart accessibilityLayer>
          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
          <Pie data={data} dataKey="count" nameKey="segment" innerRadius={70} outerRadius={95} paddingAngle={3} stroke="none">
            {data.map((entry) => <Cell key={entry.segment} fill={entry.fill} />)}
          </Pie>
          <ChartLegend content={<ChartLegendContent />} />
        </PieChart>
      </ChartContainer>
      <div className="donut-center" aria-label={`${formatInteger(total)} clients dans les segments affichés`}>
        <strong>{formatInteger(total)}</strong>
        <span>clients</span>
      </div>
    </div>
  )
}

export function SpendingBySegmentChart({ metrics }: { metrics: DashboardMetrics }) {
  if (!metrics.spendingKey || !metrics.spendingBySegment.some((row) => SEGMENTS.some((segment) => row[segment] > 0))) {
    return <p className="chart-empty">Aucune donnée de dépenses catégorielle exploitable.</p>
  }

  return (
    <ChartContainer config={spendingConfig} className="h-[250px] w-full">
      <BarChart data={metrics.spendingBySegment} accessibilityLayer margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="score" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => formatInteger(value)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {SEGMENTS.map((segment) => (
          <Bar key={segment} dataKey={segment} name={`Segment ${segment}`} stackId="segments" fill={SEGMENT_COLORS[segment]} radius={segment === "D" ? [4, 4, 0, 0] : undefined} />
        ))}
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

export function AgeBySegmentChart({ metrics }: { metrics: DashboardMetrics }) {
  if (!metrics.ageKey || !metrics.ageDistribution.some((row) => row.A + row.B + row.C + row.D > 0)) {
    return <p className="chart-empty">Aucune colonne d’âge disponible pour cette comparaison.</p>
  }

  return (
    <ChartContainer config={segmentConfig} className="h-[270px] w-full">
      <BarChart data={metrics.ageDistribution} accessibilityLayer margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="range" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => formatInteger(value)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {SEGMENTS.map((segment) => <Bar key={segment} dataKey={segment} name={`Segment ${segment}`} stackId="age" fill={SEGMENT_COLORS[segment]} />)}
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

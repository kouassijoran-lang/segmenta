"use client"

import { Activity, ArrowUpRight, BriefcaseBusiness, Database, UsersRound } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SegmentDistributionChart, SpendingBySegmentChart } from "@/components/dashboard-charts"
import { formatDecimal, formatInteger, formatPercent, SEGMENTS, type DashboardMetrics } from "@/lib/analytics"

export function OverviewSection({ metrics, sourceTotal, filter }: { metrics: DashboardMetrics; sourceTotal: number; filter: string }) {
  const largest = [...metrics.segmentProfiles].sort((a, b) => b.count - a.count)[0]
  const leader = largest?.count ? largest : undefined
  const medianAges = metrics.segmentProfiles.filter((profile) => profile.medianAge !== undefined)
  const youngest = [...medianAges].sort((a, b) => (a.medianAge ?? Infinity) - (b.medianAge ?? Infinity))[0]
  const oldest = [...medianAges].sort((a, b) => (b.medianAge ?? -Infinity) - (a.medianAge ?? -Infinity))[0]
  const ageGap = youngest && oldest ? (oldest.medianAge ?? 0) - (youngest.medianAge ?? 0) : 0
  const missingCustomers = metrics.missingByColumn.reduce((max, item) => Math.max(max, item.missing), 0)

  const cards = [
    { label: "Clients analysés", value: formatInteger(metrics.total), detail: filter === "Tous" ? "lignes historiques du CSV" : `segment ${filter} · ${formatPercent(metrics.total / Math.max(sourceTotal, 1))} du fichier`, icon: UsersRound, tint: "mint" },
    { label: "Segment dominant", value: leader ? `Segment ${leader.segment}` : "—", detail: leader ? `${formatInteger(leader.count)} clients · ${formatPercent(leader.share)}` : "Aucun segment étiqueté", icon: Activity, tint: "blue" },
    { label: "Âge moyen", value: metrics.averageAge === undefined ? "—" : `${formatDecimal(metrics.averageAge)} ans`, detail: metrics.medianAge === undefined ? "colonne d’âge indisponible" : `médiane ${formatDecimal(metrics.medianAge)} ans`, icon: BriefcaseBusiness, tint: "gold" },
    { label: "Qualité des données", value: formatPercent(metrics.missingRate), detail: `${formatInteger(metrics.missingCells)} champs vides · pic ${formatInteger(missingCustomers)} / champ`, icon: Database, tint: "lilac" },
  ]

  return (
    <div className="view-stack">
      <div className="view-intro">
        <div>
          <p className="eyebrow">VUE GÉNÉRALE</p>
          <h2>Comprendre vos clients, en un regard.</h2>
          <p className="muted-copy">Les indicateurs sont calculés en direct à partir des lignes historiques étiquetées.</p>
        </div>
        {filter !== "Tous" && <span className="filter-chip">Filtre actif · Segment {filter}</span>}
      </div>

      <div className="kpi-grid">
        {cards.map(({ label, value, detail, icon: Icon, tint }) => (
          <Card className="kpi-card" key={label}>
            <CardContent className="kpi-content">
              <div className={`kpi-icon ${tint}`}><Icon aria-hidden="true" /></div>
              <p className="kpi-label">{label}</p>
              <p className="kpi-value">{value}</p>
              <p className="kpi-detail">{detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="dashboard-grid dashboard-grid-main">
        <Card className="panel-card">
          <CardHeader className="panel-heading">
            <div><p className="eyebrow">COMPOSITION</p><CardTitle>Répartition des segments</CardTitle></div>
            <span className="panel-meta">{formatInteger(metrics.total)} clients</span>
          </CardHeader>
          <CardContent className="panel-content"><SegmentDistributionChart profiles={metrics.segmentProfiles} /></CardContent>
        </Card>
        <Card className="panel-card">
          <CardHeader className="panel-heading">
            <div><p className="eyebrow">COMPORTEMENT</p><CardTitle>Niveau de dépenses par segment</CardTitle></div>
            <span className="panel-meta">effectifs</span>
          </CardHeader>
          <CardContent className="panel-content"><SpendingBySegmentChart metrics={metrics} /></CardContent>
        </Card>
      </div>

      <Card className="insight-banner">
        <CardContent className="insight-banner-content">
          <div className="insight-banner-icon"><ArrowUpRight aria-hidden="true" /></div>
          <div>
            <p className="eyebrow">À RETENIR · OBSERVATION DESCRIPTIVE</p>
            <p className="insight-banner-title">
              {leader
                ? `${leader.name} est le groupe le plus représenté (${formatPercent(leader.share)}).`
                : "Aucune ligne étiquetée ne peut être comparée."}
            </p>
            <p className="insight-banner-copy">
              {youngest && oldest && ageGap > 0
                ? `La médiane d’âge varie de ${formatDecimal(youngest.medianAge ?? 0)} ans pour le segment ${youngest.segment} à ${formatDecimal(oldest.medianAge ?? 0)} ans pour le segment ${oldest.segment}. C’est une association descriptive, pas une explication causale.`
                : "Le fichier ne contient pas assez de données d’âge pour comparer les segments."}
            </p>
          </div>
          <div className="insight-segment-dots" aria-label={`Segments présents : ${SEGMENTS.join(", ")}`}>
            {SEGMENTS.map((segment) => <span className={`segment-dot segment-${segment.toLowerCase()}`} key={segment}>{segment}</span>)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { ArrowRight, UserRound } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AgeBySegmentChart } from "@/components/dashboard-charts"
import { formatDecimal, formatInteger, formatPercent, SEGMENTS, type DashboardMetrics } from "@/lib/analytics"

export function SegmentsSection({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="view-stack">
      <div className="view-intro">
        <div><p className="eyebrow">LECTURE DES GROUPES</p><h2>Quatre profils, des priorités différentes.</h2><p className="muted-copy">Les profils ci-dessous décrivent des fréquences observées, sans inférer de causalité.</p></div>
      </div>

      <div className="segment-card-grid">
        {metrics.segmentProfiles.map((profile) => (
          <Card className="segment-profile-card" key={profile.segment}>
            <CardHeader className="segment-profile-header">
              <div className={`segment-letter segment-${profile.segment.toLowerCase()}`}>{profile.segment}</div>
              <div className="segment-profile-name"><CardTitle>{profile.name}</CardTitle><span>{formatPercent(profile.share)} de la sélection</span></div>
              <strong className="segment-count">{formatInteger(profile.count)}</strong>
            </CardHeader>
            <CardContent className="segment-profile-content">
              <div className="segment-stat-line"><span>Âge médian</span><strong>{profile.medianAge === undefined ? "Non disponible" : `${formatDecimal(profile.medianAge, 0)} ans`}</strong></div>
              <div className="segment-stat-line"><span>Profession la plus fréquente</span><strong>{profile.topProfession ?? "Non renseignée"}</strong></div>
              <div className="segment-stat-line"><span>Dépense la plus fréquente</span><strong>{profile.topSpending ?? "Non renseignée"}{profile.topSpendingShare === undefined ? "" : ` · ${formatPercent(profile.topSpendingShare)}`}</strong></div>
              <div className="segment-progress-track" aria-label={`Part du segment ${profile.segment} : ${formatPercent(profile.share)}`}><span className={`segment-progress-fill segment-${profile.segment.toLowerCase()}`} style={{ width: `${Math.min(100, profile.share * 100)}%` }} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="panel-card">
        <CardHeader className="panel-heading"><div><p className="eyebrow">STRUCTURE PAR ÂGE</p><CardTitle>Âges observés au sein des segments</CardTitle></div><span className="panel-meta">effectifs par tranche</span></CardHeader>
        <CardContent className="panel-content"><AgeBySegmentChart metrics={metrics} /></CardContent>
      </Card>

      <Card className="panel-card table-card">
        <CardHeader className="panel-heading"><div><p className="eyebrow">COMPARAISON</p><CardTitle>Repères par segment</CardTitle></div></CardHeader>
        <CardContent className="table-scroll">
          <table className="data-table">
            <caption className="sr-only">Effectifs et caractéristiques descriptives des segments A à D</caption>
            <thead><tr><th>Segment</th><th>Clients</th><th>Part</th><th>Âge médian</th><th>Profession dominante</th><th>Dépense dominante</th></tr></thead>
            <tbody>{metrics.segmentProfiles.map((profile) => (
              <tr key={profile.segment}>
                <td><span className={`table-segment segment-${profile.segment.toLowerCase()}`}>{profile.segment}</span></td>
                <td>{formatInteger(profile.count)}</td><td>{formatPercent(profile.share)}</td>
                <td>{profile.medianAge === undefined ? "—" : `${formatDecimal(profile.medianAge, 0)} ans`}</td>
                <td>{profile.topProfession ?? "—"}</td>
                <td>{profile.topSpending ?? "—"}</td>
              </tr>
            ))}</tbody>
          </table>
          {metrics.segmentProfiles.every((profile) => !profile.count) && <p className="table-empty"><UserRound aria-hidden="true" /> Les lignes affichées ne comportent pas de segment exploitable.</p>}
        </CardContent>
      </Card>
      <div className="note-line"><ArrowRight aria-hidden="true" /><span>Les valeurs sont calculées sur le filtre actuel. Le segment historique n’est pas une mesure de performance commerciale.</span></div>
    </div>
  )
}

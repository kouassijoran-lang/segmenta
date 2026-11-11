"use client"

import { useState } from "react"
import { AlertCircle, ArrowUpRight, BrainCircuit, Lightbulb, LoaderCircle, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatDecimal, formatInteger, formatPercent, type DashboardMetrics } from "@/lib/analytics"

export function InsightsSection({ metrics }: { metrics: DashboardMetrics }) {
  const [generatedText, setGeneratedText] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState("")
  const topSegment = [...metrics.segmentProfiles].sort((a, b) => b.count - a.count)[0]
  const youngest = [...metrics.segmentProfiles].filter((item) => item.medianAge !== undefined).sort((a, b) => (a.medianAge ?? 0) - (b.medianAge ?? 0))[0]
  const oldest = [...metrics.segmentProfiles].filter((item) => item.medianAge !== undefined).sort((a, b) => (b.medianAge ?? 0) - (a.medianAge ?? 0))[0]
  const mostLowSpending = [...metrics.segmentProfiles].filter((item) => item.spendingLowShare !== undefined).sort((a, b) => (b.spendingLowShare ?? 0) - (a.spendingLowShare ?? 0))[0]

  async function generateInsights() {
    setIsGenerating(true)
    setError("")
    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          summary: {
            total: metrics.total,
            missingRate: metrics.missingRate,
            productColumns: metrics.productColumns,
            segmentProfiles: metrics.segmentProfiles.map(({ segment, count, share, medianAge, topProfession, topSpending, topSpendingShare, spendingLowShare, spendingHighShare }) => ({
              segment, count, share, medianAge, topProfession, topSpending, topSpendingShare, spendingLowShare, spendingHighShare,
            })),
            associations: metrics.strongestAssociations,
          },
        }),
      })
      const result = await response.json()
      if (!response.ok || typeof result.text !== "string") throw new Error(result.error || "Le service d’analyse est momentanément indisponible.")
      setGeneratedText(result.text)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de générer les recommandations pour le moment.")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="view-stack">
      <div className="view-intro"><div><p className="eyebrow">ANALYSE INTELLIGENTE</p><h2>Des observations vérifiables, pas des certitudes.</h2><p className="muted-copy">Les tendances sont calculées sur les données historiques; l’IA ne reçoit que des agrégats, jamais des fiches clients.</p></div><Button className="ai-action" onClick={generateInsights} disabled={isGenerating || metrics.total === 0}>{isGenerating ? <LoaderCircle className="spin-icon" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}{isGenerating ? "Analyse en cours" : "Générer l’analyse IA"}</Button></div>

      <Card className="ai-summary-card"><CardHeader className="ai-summary-header"><div className="ai-mark"><BrainCircuit aria-hidden="true" /></div><div><p className="eyebrow">LECTURE AUTOMATIQUE DES AGRÉGATS</p><CardTitle>Ce qui ressort du fichier</CardTitle></div></CardHeader>
        <CardContent>
          <div className="finding-list">
            {topSegment?.count ? <div className="finding-item"><span className="finding-index">01</span><div><strong>Répartition</strong><p>Le segment {topSegment.segment} est le plus représenté : {formatInteger(topSegment.count)} clients, soit {formatPercent(topSegment.share)} de la sélection analysée.</p></div></div> : <div className="finding-item"><span className="finding-index">01</span><div><strong>Répartition</strong><p>Aucun segment historique exploitable dans la sélection.</p></div></div>}
            {youngest && oldest && youngest.segment !== oldest.segment ? <div className="finding-item"><span className="finding-index">02</span><div><strong>Âge et segment</strong><p>Les médianes d’âge s’étendent de {formatDecimal(youngest.medianAge ?? 0, 0)} ans (segment {youngest.segment}) à {formatDecimal(oldest.medianAge ?? 0, 0)} ans (segment {oldest.segment}). Cette différence décrit une association; elle n’explique pas à elle seule les comportements.</p></div></div> : null}
            {mostLowSpending ? <div className="finding-item"><span className="finding-index">03</span><div><strong>Score de dépenses</strong><p>La part de scores « Low » la plus élevée apparaît dans le segment {mostLowSpending.segment} ({formatPercent(mostLowSpending.spendingLowShare ?? 0)}). Ce score n’est pas un montant de dépense.</p></div></div> : <div className="finding-item"><span className="finding-index">03</span><div><strong>Score de dépenses</strong><p>Aucune colonne de score de dépenses exploitable.</p></div></div>}
            {metrics.strongestAssociations.length ? <div className="finding-item"><span className="finding-index">04</span><div><strong>Relation numérique la plus marquée</strong><p>{metrics.strongestAssociations[0].first} et {metrics.strongestAssociations[0].second} : corrélation de Pearson r = {formatDecimal(metrics.strongestAssociations[0].correlation, 2)} (n = {formatInteger(metrics.strongestAssociations[0].observations)} valeurs complètes). Corrélation ne signifie pas causalité.</p></div></div> : null}
          </div>
          <div className="recommendation-strip"><Lightbulb aria-hidden="true" /><p><strong>Piste à tester :</strong> comparer les messages et offres par segment dans une campagne contrôlée. Mesurer les conversions réelles avant de généraliser; le CSV ne permet pas d’estimer l’effet d’une campagne.</p></div>
        </CardContent>
      </Card>

      {generatedText && <Card className="ai-response-card"><CardHeader className="ai-summary-header"><div className="ai-mark"><Sparkles aria-hidden="true" /></div><div><p className="eyebrow">SYNTHÈSE GÉNÉRÉE · GEMINI</p><CardTitle>Analyse en langage naturel</CardTitle></div></CardHeader><CardContent><div className="ai-response-text">{generatedText}</div></CardContent></Card>}
      {error && <div className="error-callout" role="alert"><AlertCircle aria-hidden="true" /><span>{error}</span></div>}

      <Card className="panel-card"><CardHeader className="panel-heading"><div><p className="eyebrow">PRUDENCE STATISTIQUE</p><CardTitle>À lire comme une aide à la décision</CardTitle></div><ArrowUpRight aria-hidden="true" /></CardHeader><CardContent className="caveat-grid"><p>La segmentation observée est une étiquette existante, pas une preuve de besoins ou de préférences.</p><p>Les données manquantes sont imputées pour la classification; les indicateurs descriptifs excluent les cellules vides des calculs concernés.</p><p>Sans ventes ni résultats de campagne, aucune relation produit ou recommandation de revenu ne peut être établie.</p></CardContent></Card>
    </div>
  )
}

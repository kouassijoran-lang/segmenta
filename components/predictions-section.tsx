"use client"

import { useRef, useState } from "react"
import Papa from "papaparse"
import { AlertCircle, Check, Download, Gauge, LoaderCircle, ShieldCheck, Target, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { displayColumnName, findColumn, formatDecimal, formatInteger, formatPercent, normalizeHeader, SEGMENTS, type CustomerRow, type Segment } from "@/lib/analytics"
import { scoreCustomer, trainAndEvaluate, type FeatureSpec, type ModelEvaluation, type ScoredPrediction } from "@/lib/classifier"

type PredictionRow = { source: CustomerRow; prediction: ScoredPrediction; index: number }

function safeSpreadsheetCell(value: string) {
  return /^[\u0000-\u0020]*[=+\-@]/.test(value) ? `'${value}` : value
}

function confidenceText(confidence: number) {
  if (confidence >= 0.7) return "Indice de confiance relativement élevé"
  if (confidence >= 0.45) return "Confiance modérée · vérifier les profils proches"
  return "Confiance faible · à vérifier manuellement"
}

export function PredictionsSection({ rows, headers }: { rows: CustomerRow[]; headers: string[] }) {
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null)
  const [isTraining, setIsTraining] = useState(false)
  const [trainingError, setTrainingError] = useState("")
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [singleResult, setSingleResult] = useState<ScoredPrediction | null>(null)
  const [batchRows, setBatchRows] = useState<PredictionRow[]>([])
  const [batchMessage, setBatchMessage] = useState("")
  const [batchError, setBatchError] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const targetKey = findColumn(headers, "Segmentation", "Segment", "Customer_Segment")
  const labeledCount = targetKey ? rows.filter((row) => SEGMENTS.includes(row[targetKey]?.trim().toUpperCase() as Segment)).length : 0
  const testAccuracy = evaluation ? evaluation.accuracy : undefined

  function evaluateModel() {
    setIsTraining(true)
    setTrainingError("")
    setSingleResult(null)
    setBatchRows([])
    window.setTimeout(() => {
      try {
        setEvaluation(trainAndEvaluate(rows, headers))
      } catch (error) {
        setTrainingError(error instanceof Error ? error.message : "L’évaluation du modèle a échoué.")
      } finally {
        setIsTraining(false)
      }
    })
  }

  function predictSingle() {
    if (!evaluation) return
    const input = Object.fromEntries(evaluation.model.features.map((feature) => [feature.key, formValues[feature.key] ?? ""]))
    setSingleResult(scoreCustomer(evaluation.model, input))
  }

  function predictFile(file: File) {
    setBatchError("")
    setBatchMessage("")
    setBatchRows([])
    if (file.size > 10_000_000) {
      setBatchError("Le fichier des nouveaux clients dépasse la limite d’import de 10 Mo.")
      return
    }
    Papa.parse<CustomerRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      worker: true,
      complete: ({ data, meta, errors }) => {
        if (errors.length) {
          setBatchError(`Impossible de lire le CSV : ${errors[0].message}`)
          return
        }
        const fileHeaders = meta.fields ?? []
        if (!data.length || !fileHeaders.length) {
          setBatchError("Le fichier est vide ou ne contient pas d’en-têtes de colonnes.")
          return
        }
        if (findColumn(fileHeaders, "Segmentation", "Segment", "Customer_Segment")) {
          setBatchError("Ce fichier contient déjà un segment historique. Importez ici uniquement des clients sans étiquette.")
          return
        }
        const sharedFeatures = evaluation?.model.features.filter((feature) => fileHeaders.some((header) => normalizeHeader(header) === normalizeHeader(feature.key))) ?? []
        if (!sharedFeatures.length) {
          setBatchError("Aucune colonne ne correspond aux variables du modèle. Vérifiez les noms de champs de votre CSV.")
          return
        }
        const completeRows = data.filter((row) => Object.values(row).some((value) => value?.trim()))
        if (completeRows.length > 10000) {
          setBatchError("Le fichier dépasse la limite de 10 000 nouveaux clients par import.")
          return
        }
        const predictions = completeRows.map((row, index) => ({ source: row, prediction: scoreCustomer(evaluation!.model, row), index: index + 1 }))
        setBatchRows(predictions)
        setBatchMessage(`${formatInteger(predictions.length)} nouveaux clients évalués localement. Les segments restent des estimations, pas des certitudes.`)
      },
      error: (error) => setBatchError(error.message),
    })
  }

  function exportPredictions() {
    if (!batchRows.length) return
    const records = batchRows.map(({ source, prediction, index }) => {
      const cleanSource = Object.fromEntries(Object.entries(source).map(([key, value]) => [key, safeSpreadsheetCell(value ?? "")]))
      return {
        ...cleanSource,
        Numero_ligne: index,
        Segment_estime: prediction.segment,
        Confiance_maximale: formatPercent(prediction.confidence),
        Interprétation: confidenceText(prediction.confidence),
        ...Object.fromEntries(SEGMENTS.map((segment) => [`Probabilite_${segment}`, formatPercent(prediction.probabilities[segment] ?? 0)])),
      }
    })
    const csv = `\uFEFF${Papa.unparse(records)}`
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "predictions-segmentation-clients.csv"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="view-stack">
      <div className="view-intro"><div><p className="eyebrow">CLASSIFICATION SUPERVISÉE</p><h2>Évaluer. Puis classer les nouveaux profils.</h2><p className="muted-copy">Régression logistique multiclasse · variables historiques uniquement · champs manquants imputés.</p></div></div>

      <Card className="model-intro-card"><CardContent className="model-intro-content"><div className="model-icon"><Target aria-hidden="true" /></div><div className="model-intro-copy"><p className="eyebrow">PROTOCOLE D’ÉVALUATION</p><h3>Un test tenu à l’écart avant la prédiction.</h3><p>{formatInteger(labeledCount)} exemples étiquetés éligibles. Un échantillon stratifié de 20 % sert au test; l’ajustement et les prédictions s’effectuent dans votre navigateur. L’identifiant client n’entre pas dans les variables explicatives.</p></div><Button onClick={evaluateModel} disabled={isTraining || labeledCount < 20}>{isTraining ? <LoaderCircle className="spin-icon" data-icon="inline-start" /> : <Gauge data-icon="inline-start" />}{isTraining ? "Évaluation…" : evaluation ? "Réévaluer le modèle" : "Évaluer et entraîner"}</Button></CardContent></Card>
      {trainingError && <div className="error-callout" role="alert"><AlertCircle aria-hidden="true" />{trainingError}</div>}

      {evaluation && <div className="evaluation-grid">
        <Card className="evaluation-kpi"><CardContent><div className="evaluation-icon"><Check aria-hidden="true" /></div><p className="kpi-label">Exactitude · test</p><p className="kpi-value">{formatPercent(testAccuracy ?? 0)}</p><p className="kpi-detail">{formatInteger(evaluation.testCount)} clients tenus à l’écart</p></CardContent></Card>
        <Card className="evaluation-kpi"><CardContent><div className="evaluation-icon"><Gauge aria-hidden="true" /></div><p className="kpi-label">F1 macro · test</p><p className="kpi-value">{formatPercent(evaluation.macroF1)}</p><p className="kpi-detail">moyenne équilibrée entre les segments</p></CardContent></Card>
        <Card className="evaluation-table-card"><CardHeader className="panel-heading"><div><p className="eyebrow">MATRICE DE CONFUSION</p><CardTitle>Segment réel (lignes) · prédit (colonnes)</CardTitle></div></CardHeader><CardContent className="table-scroll"><table className="data-table confusion-table"><thead><tr><th>Réel \ Prédit</th>{evaluation.model.labels.map((segment) => <th key={segment}>{segment}</th>)}</tr></thead><tbody>{evaluation.model.labels.map((segment, rowIndex) => <tr key={segment}><th scope="row">{segment}</th>{evaluation.model.labels.map((_, columnIndex) => <td key={columnIndex}>{formatInteger(evaluation.confusion[rowIndex][columnIndex])}</td>)}</tr>)}</tbody></table></CardContent></Card>
        <div className="evaluation-disclaimer"><ShieldCheck aria-hidden="true" /><span>Mesure sur un seul découpage stratifié; elle ne garantit pas les performances futures. Consultez les résultats par classe et vérifiez les prédictions avant toute décision.</span></div>
      </div>}

      <div className="prediction-grid">
        <Card className="panel-card prediction-form-card"><CardHeader className="panel-heading"><div><p className="eyebrow">PRÉDICTION INDIVIDUELLE</p><CardTitle>Décrire un nouveau client</CardTitle></div></CardHeader><CardContent>
          {evaluation ? <>
            <div className="prediction-fields">{evaluation.model.features.map((feature: FeatureSpec) => (
              <label className="prediction-field" key={feature.key}><span>{displayColumnName(feature.key)}{feature.kind === "number" ? "" : ""}</span>
                {feature.kind === "number" ? <input type="number" step="any" value={formValues[feature.key] ?? ""} onChange={(event) => setFormValues((current) => ({ ...current, [feature.key]: event.target.value }))} placeholder="Non renseigné" /> : <select value={formValues[feature.key] ?? ""} onChange={(event) => setFormValues((current) => ({ ...current, [feature.key]: event.target.value }))}><option value="">Non renseigné</option>{feature.categories.map((category) => <option value={category} key={category}>{category}</option>)}</select>}
              </label>
            ))}</div>
            <Button className="full-width-button" onClick={predictSingle}><Target data-icon="inline-start" />Estimer le segment</Button>
            {singleResult && <div className="single-result-card" role="status"><span className={`result-letter segment-${singleResult.segment.toLowerCase()}`}>{singleResult.segment}</span><div className="result-copy"><strong>Segment {singleResult.segment} le plus probable</strong><span>{formatPercent(singleResult.confidence)} · {confidenceText(singleResult.confidence)}</span><div className="probability-list">{SEGMENTS.map((segment) => <span key={segment}>{segment} <b>{formatPercent(singleResult.probabilities[segment] ?? 0)}</b></span>)}</div></div></div>}
          </> : <p className="prediction-empty">Évaluez d’abord le modèle pour activer la prédiction individuelle.</p>}
        </CardContent></Card>

        <Card className="panel-card prediction-batch-card"><CardHeader className="panel-heading"><div><p className="eyebrow">IMPORT EN LOT</p><CardTitle>Nouveaux clients sans étiquette</CardTitle></div></CardHeader><CardContent>
          <p className="batch-description">Choisissez un CSV sans colonne <code>Segmentation</code>. Le fichier est lu et traité localement dans ce navigateur.</p>
          <input ref={fileInput} className="visually-hidden-input" type="file" accept=".csv,text/csv" aria-label="Importer un CSV de nouveaux clients" disabled={!evaluation} onChange={(event) => { const file = event.target.files?.[0]; if (file) predictFile(file); event.currentTarget.value = "" }} />
          <Button variant="outline" className="upload-batch-button" onClick={() => fileInput.current?.click()} disabled={!evaluation}><Upload data-icon="inline-start" />Importer les nouveaux clients</Button>
          {batchError && <div className="error-callout compact-error" role="alert"><AlertCircle aria-hidden="true" />{batchError}</div>}
          {batchMessage && <div className="batch-success" role="status"><Check aria-hidden="true" />{batchMessage}</div>}
          {batchRows.length > 0 && <>
            <div className="batch-result-header"><span>Premiers résultats · {formatInteger(batchRows.length)} lignes</span><Button variant="outline" size="sm" onClick={exportPredictions}><Download data-icon="inline-start" />Exporter le CSV</Button></div>
            <div className="table-scroll batch-results-scroll"><table className="data-table batch-results-table"><thead><tr><th>Ligne</th><th>Segment estimé</th><th>Probabilité max.</th><th>À interpréter</th></tr></thead><tbody>{batchRows.slice(0, 50).map((item) => <tr key={item.index}><td>{item.index}</td><td><span className={`table-segment segment-${item.prediction.segment.toLowerCase()}`}>{item.prediction.segment}</span></td><td>{formatPercent(item.prediction.confidence)}</td><td>{confidenceText(item.prediction.confidence)}</td></tr>)}</tbody></table></div>
            {batchRows.length > 50 && <p className="kpi-detail">L’export CSV comprend les {formatInteger(batchRows.length)} résultats; 50 lignes sont affichées ici.</p>}
          </>}
        </CardContent></Card>
      </div>
      <div className="evaluation-disclaimer"><ShieldCheck aria-hidden="true" /><span>Les probabilités expriment le niveau relatif du modèle, jamais une certitude ni une décision automatique. Validez les données et l’adéquation métier avec un spécialiste.</span></div>
    </div>
  )
}

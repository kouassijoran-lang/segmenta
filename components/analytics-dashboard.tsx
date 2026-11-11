"use client"

import { useMemo, useRef, useState } from "react"
import Papa from "papaparse"
import {
  AlertCircle,
  BarChart3,
  CarFront,
  Check,
  ChevronRight,
  Database,
  LayoutDashboard,
  PackageSearch,
  ScanLine,
  Sparkles,
  Upload,
  UsersRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CommercialSection } from "@/components/commercial-section"
import { InsightsSection } from "@/components/insights-section"
import { OverviewSection } from "@/components/overview-section"
import { PredictionsSection } from "@/components/predictions-section"
import { SegmentsSection } from "@/components/segments-section"
import { calculateAnalytics, findColumn, SEGMENTS, type CustomerRow, type Segment } from "@/lib/analytics"

type View = "overview" | "segments" | "commercial" | "insights" | "predictions"
type Dataset = { rows: CustomerRow[]; headers: string[]; name: string; version: number }

const navigation: Array<{ id: View; label: string; icon: typeof LayoutDashboard; overline?: string }> = [
  { id: "overview", label: "Vue générale", icon: LayoutDashboard, overline: "ANALYSE" },
  { id: "segments", label: "Segments clients", icon: UsersRound },
  { id: "commercial", label: "Analyse commerciale", icon: PackageSearch, overline: "DÉCISION" },
  { id: "insights", label: "Analyse intelligente", icon: Sparkles },
  { id: "predictions", label: "Prédiction clients", icon: ScanLine, overline: "MODÈLE" },
]

const pageTitles: Record<View, { eyebrow: string; title: string }> = {
  overview: { eyebrow: "ESPACE D’ANALYSE", title: "AUTOMOTIVE CUSTOMER SEGMENTATION ANALYTICS" },
  segments: { eyebrow: "PORTRAIT CLIENT", title: "Analyse des segments" },
  commercial: { eyebrow: "PERFORMANCE COMMERCIALE", title: "Analyse des produits" },
  insights: { eyebrow: "INTELLIGENCE & CONSEIL", title: "Tendances et recommandations" },
  predictions: { eyebrow: "MODÈLE DE CLASSIFICATION", title: "Prédiction de nouveaux clients" },
}

function parseCsvText(csv: string, name: string, version: number): Dataset {
  const parsed = Papa.parse<CustomerRow>(csv, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  })
  return {
    rows: parsed.data.filter((row) => Object.values(row).some((value) => value?.trim())),
    headers: parsed.meta.fields ?? [],
    name,
    version,
  }
}

export function AnalyticsDashboard({ initialCsv }: { initialCsv: string }) {
  const [dataset, setDataset] = useState(() => parseCsvText(initialCsv, "DS_CustSegment.csv", 0))
  const [activeView, setActiveView] = useState<View>("overview")
  const [selectedSegment, setSelectedSegment] = useState("Tous")
  const [error, setError] = useState("")
  const [importNotice, setImportNotice] = useState("")
  const historyInput = useRef<HTMLInputElement>(null)
  const fullMetrics = useMemo(() => calculateAnalytics(dataset.rows, dataset.headers), [dataset])
  const overviewRows = selectedSegment === "Tous"
    ? dataset.rows
    : dataset.rows.filter((row) => row[fullMetrics.segmentKey ?? ""]?.trim().toUpperCase() === selectedSegment)
  const overviewMetrics = useMemo(() => selectedSegment === "Tous" ? fullMetrics : calculateAnalytics(overviewRows, dataset.headers), [dataset.headers, fullMetrics, overviewRows, selectedSegment])
  const currentPage = pageTitles[activeView]
  const segmentCounts = fullMetrics.segmentCounts
  const hasRows = dataset.rows.length > 0 && dataset.headers.length > 0

  function handleHistoryUpload(file: File) {
    setError("")
    setImportNotice("")
    if (file.size > 15_000_000) {
      setError("Le fichier historique dépasse la limite d’import de 15 Mo.")
      return
    }
    Papa.parse<CustomerRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      transform: (value) => value.trim(),
      complete: ({ data, meta, errors }) => {
        if (errors.length) {
          setError(`Lecture interrompue : ${errors[0].message}`)
          return
        }
        const nextRows = data.filter((row) => Object.values(row).some((value) => value?.trim()))
        const headers = meta.fields ?? []
        const targetKey = findColumn(headers, "Segmentation", "Segment", "Customer_Segment")
        const labeledRows = targetKey ? nextRows.filter((row) => SEGMENTS.includes(row[targetKey]?.trim().toUpperCase() as Segment)) : []
        if (!headers.length || labeledRows.length < 20) {
          setError("Ce fichier doit contenir des colonnes d’en-tête et au moins 20 clients historiques étiquetés A, B, C ou D. Le jeu actuel est conservé.")
          return
        }
        setDataset((current) => ({ rows: nextRows, headers, name: file.name, version: current.version + 1 }))
        setSelectedSegment("Tous")
        setImportNotice(`${labeledRows.length.toLocaleString("fr-FR")} clients étiquetés chargés depuis ${file.name}.`)
      },
      error: (parseError) => setError(parseError.message),
    })
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <a className="brand-lockup" href="#dashboard" onClick={(event) => { event.preventDefault(); setActiveView("overview") }} aria-label="Automotive Insights — vue générale">
          <span className="brand-mark"><CarFront aria-hidden="true" /></span>
          <span className="brand-copy"><strong>automotive<span>.</span></strong><small>CUSTOMER INTELLIGENCE</small></span>
        </a>

        <div className="sidebar-workspace"><span className="workspace-indicator" /><span>ESPACE CLIENTS</span><ChevronRight aria-hidden="true" /></div>
        <nav className="sidebar-nav" aria-label="Navigation principale">
          {navigation.map(({ id, label, icon: Icon, overline }) => (
            <div key={id}>
              {overline && <p className="nav-overline">{overline}</p>}
              <button type="button" className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => setActiveView(id)} aria-current={activeView === id ? "page" : undefined}>
                <Icon aria-hidden="true" /><span>{label}</span>{activeView === id && <span className="nav-active-dot" />}
              </button>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-mark"><Database aria-hidden="true" /></div>
          <div><strong>Données confidentielles</strong><span>Traitement local dans le navigateur</span></div>
        </div>
      </aside>

      <div className="dashboard-body" id="dashboard">
        <header className="dashboard-topbar">
          <div className="topbar-breadcrumb"><span>Automotive</span><ChevronRight aria-hidden="true" /><strong>{navigation.find((item) => item.id === activeView)?.label}</strong></div>
          <div className="topbar-actions">
            <label className="segment-filter" htmlFor="segment-filter"><span>Segment</span><select id="segment-filter" value={selectedSegment} onChange={(event) => setSelectedSegment(event.target.value)}><option value="Tous">Tous les segments</option>{SEGMENTS.map((segment) => <option value={segment} key={segment}>Segment {segment} · {segmentCounts[segment].toLocaleString("fr-FR")}</option>)}</select></label>
            <input ref={historyInput} className="visually-hidden-input" type="file" accept=".csv,text/csv" aria-label="Importer un fichier historique étiqueté" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleHistoryUpload(file); event.currentTarget.value = "" }} />
            <Button className="import-button" size="sm" onClick={() => historyInput.current?.click()}><Upload data-icon="inline-start" />Importer un CSV</Button>
          </div>
        </header>

        <main className="dashboard-main">
          <div className="dashboard-page-heading">
            <div><p className="eyebrow">{currentPage.eyebrow}</p><h1>{currentPage.title}</h1></div>
            <div className="data-status"><span className="status-dot" /><span>{dataset.rows.length.toLocaleString("fr-FR")} clients historiques</span></div>
          </div>

          {error && <div className="error-callout top-callout" role="alert"><AlertCircle aria-hidden="true" /><span>{error}</span><button type="button" aria-label="Fermer le message d’erreur" onClick={() => setError("")}>×</button></div>}
          {importNotice && <div className="import-success" role="status"><Check aria-hidden="true" /><span>{importNotice}</span><button type="button" aria-label="Fermer le message de confirmation" onClick={() => setImportNotice("")}>×</button></div>}

          {!hasRows && <div className="error-callout" role="alert">Le fichier ne contient aucune ligne exploitable.</div>}
          <section hidden={activeView !== "overview"} aria-label="Vue générale des indicateurs"><OverviewSection metrics={overviewMetrics} sourceTotal={dataset.rows.length} filter={selectedSegment} /></section>
          <section hidden={activeView !== "segments"} aria-label="Comparaison des segments"><SegmentsSection metrics={fullMetrics} /></section>
          <section hidden={activeView !== "commercial"} aria-label="Analyse commerciale"><CommercialSection metrics={fullMetrics} /></section>
          <section hidden={activeView !== "insights"} aria-label="Tendances et recommandations"><InsightsSection key={`insights-${dataset.version}`} metrics={fullMetrics} /></section>
          <section hidden={activeView !== "predictions"} aria-label="Prédiction de nouveaux clients"><PredictionsSection key={`predictions-${dataset.version}`} rows={dataset.rows} headers={dataset.headers} /></section>

          <footer className="dashboard-footer"><span>Source active : <strong>{dataset.name}</strong></span><span>Les prédictions sont des estimations, non des certitudes.</span></footer>
        </main>
      </div>
    </div>
  )
}

import { BarChart3, CircleHelp, Database, PackageSearch } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInteger, type DashboardMetrics } from "@/lib/analytics"

export function CommercialSection({ metrics }: { metrics: DashboardMetrics }) {
  if (metrics.productColumns.length > 0) {
    return (
      <div className="view-stack">
        <div className="view-intro"><div><p className="eyebrow">ANALYSE COMMERCIALE</p><h2>Champs produit repérés dans le fichier.</h2><p className="muted-copy">Les colonnes disponibles varient selon le CSV. Les mesures affichées sont les noms de champs, pas des ventes présumées.</p></div></div>
        <Card className="panel-card"><CardHeader className="panel-heading"><div><p className="eyebrow">CHAMPS DÉTECTÉS</p><CardTitle>Produits et indicateurs commerciaux disponibles</CardTitle></div></CardHeader><CardContent className="product-field-list">
          {metrics.productColumns.map((field) => <div className="product-field-row" key={field}><div className="product-icon"><BarChart3 aria-hidden="true" /></div><span>{field}</span><span className="field-observation">{formatInteger(metrics.total)} lignes dans le fichier</span></div>)}
          <div className="data-caveat"><CircleHelp aria-hidden="true" /><p>Vérifiez la définition et l’unité de ces champs avant toute conclusion sur le chiffre d’affaires ou les préférences.</p></div>
        </CardContent></Card>
      </div>
    )
  }

  return (
    <div className="view-stack">
      <div className="view-intro"><div><p className="eyebrow">ANALYSE COMMERCIALE</p><h2>Les produits P1 à P5 ne figurent pas dans ce CSV.</h2><p className="muted-copy">Le fichier importé décrit le profil des clients, mais ne contient pas de lignes de ventes ni de préférence produit.</p></div></div>
      <Card className="commercial-empty-state">
        <CardContent className="commercial-empty-content">
          <div className="commercial-empty-icon"><PackageSearch aria-hidden="true" /></div>
          <div className="commercial-empty-copy">
            <p className="eyebrow">COUVERTURE DU FICHIER</p>
            <h3>Aucun indicateur produit ne peut être calculé sans données de vente.</h3>
            <p>Pour comparer P1–P5, importez une table contenant un identifiant client et des champs produit tels que les unités vendues, les commandes, le montant ou un indicateur de préférence. Aucun chiffre de vente n’est inventé ici.</p>
            <div className="suggested-fields"><span><Database aria-hidden="true" /> Champs présents</span><div>{metrics.headers.slice(0, 10).map((field) => <code key={field}>{field}</code>)}</div></div>
          </div>
        </CardContent>
      </Card>
      <div className="data-caveat"><CircleHelp aria-hidden="true" /><p>Profession, dépenses déclarées et produit acheté sont des variables distinctes. Les premières ne remplacent pas l’historique de ventes.</p></div>
    </div>
  )
}

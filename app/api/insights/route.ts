import { generateText } from "ai"
import { z } from "zod"

const segmentSchema = z.object({
  segment: z.enum(["A", "B", "C", "D"]),
  count: z.number().int().min(0).max(10_000_000),
  share: z.number().min(0).max(1),
  medianAge: z.number().min(0).max(150).optional(),
  topProfession: z.string().max(120).optional(),
  topSpending: z.string().max(120).optional(),
  topSpendingShare: z.number().min(0).max(1).optional(),
  spendingLowShare: z.number().min(0).max(1).optional(),
  spendingHighShare: z.number().min(0).max(1).optional(),
}).strict()

const summarySchema = z.object({
  summary: z.object({
    total: z.number().int().min(0).max(10_000_000),
    missingRate: z.number().min(0).max(1),
    productColumns: z.array(z.string().max(120)).max(40),
    segmentProfiles: z.array(segmentSchema).max(4),
    associations: z.array(z.object({
      first: z.string().max(120),
      second: z.string().max(120),
      correlation: z.number().min(-1).max(1),
      observations: z.number().int().min(0).max(10_000_000),
    }).strict()).max(5),
  }).strict(),
}).strict()

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")
  if (origin && host) {
    try {
      if (new URL(origin).host !== host) {
        return Response.json({ error: "Requête d’origine non autorisée." }, { status: 403 })
      }
    } catch {
      return Response.json({ error: "Requête d’origine non autorisée." }, { status: 403 })
    }
  }

  const rawBody = await request.text()
  if (rawBody.length > 20_000) {
    return Response.json({ error: "Le résumé des données est trop volumineux." }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: "Le résumé envoyé n’est pas un JSON valide." }, { status: 400 })
  }

  const parsed = summarySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: "Le résumé des indicateurs ne respecte pas le format attendu." }, { status: 400 })
  }

  try {
    const { text } = await generateText({
      model: "google/gemini-3.5-flash",
      maxOutputTokens: 480,
      abortSignal: AbortSignal.timeout(25_000),
      system: "Tu es un analyste senior spécialisé en segmentation client automobile. Réponds en français, avec des phrases simples, sobres et brèves. Utilise UNIQUEMENT les agrégats fournis. Distingue clairement observations et pistes à tester. N'affirme jamais de causalité, de revenu, de vente, de préférence produit ou de tendance temporelle qui n'apparaît pas dans les données. Si productColumns est vide, précise explicitement que les ventes et P1–P5 ne peuvent pas être comparés avec ce fichier et recommande de collecter un historique transactionnel. N'identifie aucun individu et ne présente jamais un segment estimé comme certain. Cite les chiffres qui étayent chaque observation.",
      prompt: `Analyse ces statistiques calculées depuis un CSV historique et fournis trois blocs courts : « Constats observés », « Relations entre variables » et « Recommandations à tester ». Mentionne les limites des données et le taux de valeurs manquantes. Données : ${JSON.stringify(parsed.data.summary)}`,
    })
    return Response.json({ text })
  } catch {
    return Response.json({ error: "Le service IA est indisponible pour le moment. Les analyses calculées localement restent accessibles." }, { status: 503 })
  }
}

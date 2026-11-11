export type CustomerRow = Record<string, string>
export type Segment = "A" | "B" | "C" | "D"

export const SEGMENTS: Segment[] = ["A", "B", "C", "D"]
export const SEGMENT_COLORS: Record<Segment, string> = {
  A: "#3778d4",
  B: "#25a985",
  C: "#dda34d",
  D: "#8671c9",
}

const segmentNames: Record<Segment, string> = {
  A: "Segment A",
  B: "Segment B",
  C: "Segment C",
  D: "Segment D",
}

export function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase("fr").replace(/[^a-z0-9]/g, "")
}

export function findColumn(headers: string[], ...candidates: string[]) {
  const byNormalizedName = new Map(headers.map((header) => [normalizeHeader(header), header]))
  for (const candidate of candidates) {
    const found = byNormalizedName.get(normalizeHeader(candidate))
    if (found) return found
  }
  return undefined
}

export function displayColumnName(key: string) {
  const labels: Record<string, string> = {
    id: "Identifiant",
    gender: "Genre",
    evermarried: "Situation familiale",
    age: "Âge",
    graduated: "Diplôme obtenu",
    profession: "Profession",
    workexperience: "Expérience professionnelle",
    spendingscore: "Niveau de dépenses",
    familysize: "Taille du foyer",
    var1: "Catégorie client",
    segmentation: "Segment historique",
  }
  return labels[normalizeHeader(key)] ?? key.replaceAll("_", " ")
}

export function toFiniteNumber(value: string | undefined) {
  if (value == null || value.trim() === "") return undefined
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : undefined
}

function median(values: number[]) {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function mostFrequent(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
}

function isProductColumn(header: string) {
  return /^(?:p[1-5]|product(?:[_ -]?p?[1-5])?|(?:units?|quantity|sales|revenue)[_ -]?(?:p[1-5]))$/i.test(header.trim())
}

export type NumericMetric = {
  key: string
  label: string
  mean: number
  median: number
  missing: number
  observed: number
}

export type SegmentProfile = {
  segment: Segment
  name: string
  count: number
  share: number
  medianAge?: number
  averageAge?: number
  topProfession?: string
  topProfessionShare?: number
  topSpending?: string
  topSpendingShare?: number
  spendingLowShare?: number
  spendingHighShare?: number
}

export type DashboardMetrics = {
  total: number
  headers: string[]
  segmentKey?: string
  segmentCounts: Record<Segment, number>
  segmentProfiles: SegmentProfile[]
  ageKey?: string
  averageAge?: number
  medianAge?: number
  ageMissing: number
  numericMetrics: NumericMetric[]
  missingCells: number
  totalCells: number
  missingRate: number
  missingByColumn: Array<{ key: string; label: string; missing: number; rate: number }>
  spendingKey?: string
  spendingBySegment: Array<{ score: string; A: number; B: number; C: number; D: number }>
  ageDistribution: Array<{ range: string; A: number; B: number; C: number; D: number }>
  productColumns: string[]
  strongestAssociations: Array<{ first: string; second: string; correlation: number; observations: number }>
}

function pearson(rows: CustomerRow[], first: string, second: string) {
  const pairs = rows.flatMap((row) => {
    const x = toFiniteNumber(row[first])
    const y = toFiniteNumber(row[second])
    return x === undefined || y === undefined ? [] : [[x, y] as const]
  })
  if (pairs.length < 10) return undefined
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length
  const numerator = pairs.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0)
  const denominatorX = pairs.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0)
  const denominatorY = pairs.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0)
  const denominator = Math.sqrt(denominatorX * denominatorY)
  return denominator === 0 ? undefined : { correlation: numerator / denominator, observations: pairs.length }
}

export function calculateAnalytics(rows: CustomerRow[], headers: string[]): DashboardMetrics {
  const total = rows.length
  const segmentKey = findColumn(headers, "Segmentation", "Segment", "Customer_Segment")
  const ageKey = findColumn(headers, "Age", "Customer_Age")
  const spendingKey = findColumn(headers, "Spending_Score", "Spending Score", "Spending")
  const professionKey = findColumn(headers, "Profession", "Occupation")
  const segmentCounts = Object.fromEntries(SEGMENTS.map((segment) => [segment, 0])) as Record<Segment, number>

  if (segmentKey) {
    for (const row of rows) {
      const segment = row[segmentKey]?.trim().toUpperCase() as Segment
      if (SEGMENTS.includes(segment)) segmentCounts[segment] += 1
    }
  }

  const numericMetrics = headers.flatMap((key) => {
    if (/^(?:id|customerid|clientid)$/i.test(normalizeHeader(key))) return []
    const observed = rows.map((row) => toFiniteNumber(row[key])).filter((value): value is number => value !== undefined)
    if (!observed.length || observed.length / Math.max(total, 1) < 0.55) return []
    const average = observed.reduce((sum, value) => sum + value, 0) / observed.length
    const medianValue = median(observed)
    if (medianValue === undefined) return []
    return [{ key, label: displayColumnName(key), mean: average, median: medianValue, missing: total - observed.length, observed: observed.length }]
  })

  const metricFor = (...names: string[]) => {
    const key = findColumn(headers, ...names)
    return numericMetrics.find((metric) => metric.key === key)
  }
  const ageMetric = metricFor("Age", "Customer_Age")
  const ageValues = ageKey ? rows.map((row) => toFiniteNumber(row[ageKey])) : []
  const observedAges = ageValues.filter((value): value is number => value !== undefined)
  const totalCells = total * headers.length
  const missingByColumn = headers.map((key) => {
    const missing = rows.reduce((count, row) => count + (row[key] == null || row[key].trim() === "" ? 1 : 0), 0)
    return { key, label: displayColumnName(key), missing, rate: total ? missing / total : 0 }
  }).filter((item) => item.missing > 0).sort((a, b) => b.missing - a.missing)
  const missingCells = missingByColumn.reduce((sum, item) => sum + item.missing, 0)

  const segmentProfiles = SEGMENTS.map((segment): SegmentProfile => {
    const group = segmentKey
      ? rows.filter((row) => row[segmentKey]?.trim().toUpperCase() === segment)
      : []
    const ages = ageKey ? group.map((row) => toFiniteNumber(row[ageKey])).filter((value): value is number => value !== undefined) : []
    const topProfession = professionKey ? mostFrequent(group.map((row) => row[professionKey]?.trim()).filter(Boolean)) : undefined
    const topSpending = spendingKey ? mostFrequent(group.map((row) => row[spendingKey]?.trim()).filter(Boolean)) : undefined
    const lowCount = spendingKey ? group.filter((row) => row[spendingKey]?.trim().toLowerCase() === "low").length : 0
    const highCount = spendingKey ? group.filter((row) => row[spendingKey]?.trim().toLowerCase() === "high").length : 0
    return {
      segment,
      name: segmentNames[segment],
      count: segmentCounts[segment],
      share: total ? segmentCounts[segment] / total : 0,
      medianAge: median(ages),
      averageAge: ages.length ? ages.reduce((sum, age) => sum + age, 0) / ages.length : undefined,
      topProfession: topProfession?.[0],
      topProfessionShare: group.length && topProfession ? topProfession[1] / group.length : undefined,
      topSpending: topSpending?.[0],
      topSpendingShare: group.length && topSpending ? topSpending[1] / group.length : undefined,
      spendingLowShare: group.length && spendingKey ? lowCount / group.length : undefined,
      spendingHighShare: group.length && spendingKey ? highCount / group.length : undefined,
    }
  })

  const spendingBySegment = spendingKey
    ? ["Low", "Average", "High"].map((score) => ({
        score,
        ...Object.fromEntries(SEGMENTS.map((segment) => [segment, rows.filter((row) => row[segmentKey ?? ""]?.trim().toUpperCase() === segment && row[spendingKey]?.trim().toLowerCase() === score.toLowerCase()).length])),
      }) as { score: string; A: number; B: number; C: number; D: number })
    : []

  const ageRanges = [
    { range: "18–29 ans", min: 18, max: 29 },
    { range: "30–39 ans", min: 30, max: 39 },
    { range: "40–49 ans", min: 40, max: 49 },
    { range: "50–59 ans", min: 50, max: 59 },
    { range: "60 ans et +", min: 60, max: Number.POSITIVE_INFINITY },
  ]
  const ageDistribution = ageKey
    ? ageRanges.map(({ range, min, max }) => ({
        range,
        ...Object.fromEntries(SEGMENTS.map((segment) => [segment, rows.filter((row) => {
          const age = toFiniteNumber(row[ageKey])
          return row[segmentKey ?? ""]?.trim().toUpperCase() === segment && age !== undefined && age >= min && age <= max
        }).length])),
      }) as { range: string; A: number; B: number; C: number; D: number })
    : []

  const numericForCorrelations = numericMetrics.filter((metric) => metric.observed / Math.max(total, 1) >= 0.7)
  const strongestAssociations: DashboardMetrics["strongestAssociations"] = []
  for (let i = 0; i < numericForCorrelations.length; i += 1) {
    for (let j = i + 1; j < numericForCorrelations.length; j += 1) {
      const first = numericForCorrelations[i]
      const second = numericForCorrelations[j]
      if (/^(?:id|customerid|clientid)$/i.test(normalizeHeader(first.key)) || /^(?:id|customerid|clientid)$/i.test(normalizeHeader(second.key))) continue
      const result = pearson(rows, first.key, second.key)
      if (result) strongestAssociations.push({ first: first.label, second: second.label, ...result })
    }
  }
  strongestAssociations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))

  return {
    total,
    headers,
    segmentKey,
    segmentCounts,
    segmentProfiles,
    ageKey,
    averageAge: ageMetric?.mean,
    medianAge: ageMetric?.median,
    ageMissing: ageMetric?.missing ?? (ageKey ? total - observedAges.length : total),
    numericMetrics,
    missingCells,
    totalCells,
    missingRate: totalCells ? missingCells / totalCells : 0,
    missingByColumn,
    spendingKey,
    spendingBySegment,
    ageDistribution,
    productColumns: headers.filter(isProductColumn),
    strongestAssociations: strongestAssociations.slice(0, 3),
  }
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)
}

export function formatPercent(value: number, digits = 1) {
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

export function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value)
}

import {
  findColumn,
  normalizeHeader,
  SEGMENTS,
  toFiniteNumber,
  type CustomerRow,
  type Segment,
} from "@/lib/analytics"

export type FeatureSpec =
  | { key: string; kind: "number"; median: number; mean: number; scale: number }
  | { key: string; kind: "category"; categories: string[] }

export type LogisticModel = {
  labels: Segment[]
  features: FeatureSpec[]
  weights: number[][]
}

export type ModelEvaluation = {
  accuracy: number
  macroF1: number
  testCount: number
  trainingCount: number
  confusion: number[][]
  model: LogisticModel
}

export type ScoredPrediction = {
  segment: Segment
  confidence: number
  probabilities: Record<Segment, number>
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function makeFeatures(rows: CustomerRow[], headers: string[], targetKey: string): FeatureSpec[] {
  const features: FeatureSpec[] = []
  for (const key of headers) {
    const normalized = normalizeHeader(key)
    if (key === targetKey || /^(?:id|customerid|clientid|recordid)$/i.test(normalized)) continue
    const observed = rows.map((row) => row[key]?.trim()).filter(Boolean)
    if (!observed.length) continue
    const numeric = observed.map((value) => Number(value.replace(",", ".")))
    const numericCount = numeric.filter(Number.isFinite).length
    if (numericCount / observed.length >= 0.9) {
      const values = numeric.filter(Number.isFinite)
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      const scale = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length) || 1
      features.push({ key, kind: "number", median: median(values), mean, scale })
      continue
    }
    const categories = [...new Set(observed)].sort((a, b) => a.localeCompare(b, "fr"))
    if (categories.length <= 100) features.push({ key, kind: "category", categories })
  }
  return features
}

function encode(row: CustomerRow, features: FeatureSpec[]) {
  const result: number[] = []
  for (const feature of features) {
    if (feature.kind === "number") {
      const value = toFiniteNumber(row[feature.key]) ?? feature.median
      result.push((value - feature.mean) / feature.scale)
    } else {
      const value = row[feature.key]?.trim() ?? ""
      result.push(...feature.categories.map((category) => Number(value === category)))
      result.push(Number(!value))
    }
  }
  return result
}

function softmax(scores: number[]) {
  const maximum = Math.max(...scores)
  const exponentials = scores.map((score) => Math.exp(Math.max(-40, score - maximum)))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / total)
}

function fitLogistic(rows: CustomerRow[], labels: Segment[], features: FeatureSpec[]): LogisticModel {
  const encoded = rows.map((row) => encode(row, features))
  const columns = (encoded[0]?.length ?? 0) + 1
  const weights = labels.map(() => Array.from({ length: columns }, () => 0))
  const classByRow = rows.map((row) => labels.indexOf(row.__modelLabel as Segment))
  const epochs = 95
  const learningRate = 0.3

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradients = labels.map(() => Array.from({ length: columns }, () => 0))
    for (let index = 0; index < encoded.length; index += 1) {
      const input = encoded[index]
      const actual = classByRow[index]
      const scores = weights.map((classWeights) => classWeights[0] + input.reduce((sum, value, featureIndex) => sum + classWeights[featureIndex + 1] * value, 0))
      const probabilities = softmax(scores)
      for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
        const error = probabilities[classIndex] - Number(classIndex === actual)
        gradients[classIndex][0] += error
        for (let featureIndex = 0; featureIndex < input.length; featureIndex += 1) {
          gradients[classIndex][featureIndex + 1] += error * input[featureIndex]
        }
      }
    }
    const regularization = 0.0008
    for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
      for (let column = 0; column < columns; column += 1) {
        const averageGradient = gradients[classIndex][column] / Math.max(encoded.length, 1)
        weights[classIndex][column] -= learningRate * (averageGradient + (column === 0 ? 0 : regularization * weights[classIndex][column]))
      }
    }
  }
  return { labels, features, weights }
}

function shuffled<T>(items: T[], seed: number) {
  const output = [...items]
  let current = seed >>> 0
  for (let index = output.length - 1; index > 0; index -= 1) {
    current = (current * 1664525 + 1013904223) >>> 0
    const swapIndex = current % (index + 1)
    ;[output[index], output[swapIndex]] = [output[swapIndex], output[index]]
  }
  return output
}

export function scoreCustomer(model: LogisticModel, row: CustomerRow): ScoredPrediction {
  const encoded = encode(row, model.features)
  const scores = model.weights.map((classWeights) => classWeights[0] + encoded.reduce((sum, value, index) => sum + classWeights[index + 1] * value, 0))
  const probabilities = softmax(scores)
  const predictedIndex = probabilities.reduce((best, probability, index) => probability > probabilities[best] ? index : best, 0)
  const probabilityMap = Object.fromEntries(model.labels.map((label, index) => [label, probabilities[index]])) as Record<Segment, number>
  return { segment: model.labels[predictedIndex], confidence: probabilities[predictedIndex], probabilities: probabilityMap }
}

export function trainAndEvaluate(rows: CustomerRow[], headers: string[]): ModelEvaluation {
  const targetKey = findColumn(headers, "Segmentation", "Segment", "Customer_Segment")
  if (!targetKey) throw new Error("Aucune colonne de segment historique (Segmentation) n’a été trouvée.")
  const labeledRows = rows.flatMap((row) => {
    const label = row[targetKey]?.trim().toUpperCase() as Segment
    return SEGMENTS.includes(label) ? [{ ...row, __modelLabel: label }] : []
  })
  const labels = SEGMENTS.filter((label) => labeledRows.some((row) => row.__modelLabel === label))
  if (labels.length < 2 || labeledRows.length < 20) throw new Error("Il faut au moins 20 clients étiquetés appartenant à 2 segments pour évaluer le modèle.")
  const features = makeFeatures(labeledRows, headers, targetKey)
  if (!features.length) throw new Error("Aucune variable explicative utilisable n’a été trouvée en dehors de l’identifiant et du segment.")

  const groups: Partial<Record<Segment, CustomerRow[]>> = {}
  for (const label of labels) {
    groups[label] = shuffled(labeledRows.filter((row) => row.__modelLabel === label), label.charCodeAt(0) * 193)
  }
  const trainingRows: CustomerRow[] = []
  const testingRows: CustomerRow[] = []
  for (const label of labels) {
    const group = groups[label] ?? []
    const testSize = Math.max(1, Math.round(group.length * 0.2))
    testingRows.push(...group.slice(0, testSize))
    trainingRows.push(...group.slice(testSize))
  }

  const trainingFeatures = makeFeatures(trainingRows, headers, targetKey)
  const trainingModel = fitLogistic(trainingRows, labels, trainingFeatures)
  const confusion = labels.map(() => labels.map(() => 0))
  let correct = 0
  const classF1 = labels.map(() => ({ truePositive: 0, falsePositive: 0, falseNegative: 0 }))
  for (const row of testingRows) {
    const actual = labels.indexOf(row.__modelLabel as Segment)
    const predicted = labels.indexOf(scoreCustomer(trainingModel, row).segment)
    confusion[actual][predicted] += 1
    if (actual === predicted) correct += 1
    for (let index = 0; index < labels.length; index += 1) {
      if (actual === index && predicted === index) classF1[index].truePositive += 1
      else if (predicted === index) classF1[index].falsePositive += 1
      else if (actual === index) classF1[index].falseNegative += 1
    }
  }
  const macroF1 = classF1.reduce((sum, item) => {
    const denominator = 2 * item.truePositive + item.falsePositive + item.falseNegative
    return sum + (denominator ? (2 * item.truePositive) / denominator : 0)
  }, 0) / classF1.length

  return {
    accuracy: correct / testingRows.length,
    macroF1,
    testCount: testingRows.length,
    trainingCount: trainingRows.length,
    confusion,
    model: fitLogistic(labeledRows, labels, makeFeatures(labeledRows, headers, targetKey)),
  }
}

import { readFile } from "node:fs/promises"
import path from "node:path"
import { AnalyticsDashboard } from "@/components/analytics-dashboard"

export default async function Page() {
  const initialCsv = await readFile(path.join(process.cwd(), "data/customer-segments.csv"), "utf8")
  return <AnalyticsDashboard initialCsv={initialCsv} />
}

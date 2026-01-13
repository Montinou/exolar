"use client"

import { useState } from "react"
import { TopPatternsChart } from "./charts/top-patterns-chart"
import { CategoryDistributionChart } from "./charts/category-distribution-chart"
import { PatternTrendsChart } from "./charts/pattern-trends-chart"
import { FailingTestsCard } from "./failing-tests-card"

export function ClustersTabContent() {
  const [days, setDays] = useState(30)

  const handleDaysChange = (newDays: number) => {
    setDays(newDays)
  }

  return (
    <div className="space-y-6">
      {/* Top Patterns - full width with shared filter */}
      <TopPatternsChart
        days={days}
        onDaysChange={handleDaysChange}
        showFilter={true}
      />

      {/* Category Distribution & Trends Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDistributionChart days={days} showFilter={false} />
        <PatternTrendsChart days={days} showFilter={false} />
      </div>

      {/* Failing Tests Card */}
      <FailingTestsCard days={days} />
    </div>
  )
}

import Link from "next/link"
import { CHANGELOG_ENTRIES } from "@/lib/changelog/data"
import type { ChangelogEntry } from "@/lib/changelog/data"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata = {
  title: "What's New - Exolar QA",
  description: "Latest updates, features, and improvements to Exolar QA Testing Dashboard",
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function getTypeBadgeVariant(type: ChangelogEntry["type"]) {
  switch (type) {
    case "feature":
      return "default"
    case "improvement":
      return "secondary"
    case "fix":
      return "outline"
    case "breaking":
      return "destructive"
  }
}

function getTypeBadgeLabel(type: ChangelogEntry["type"]) {
  switch (type) {
    case "feature":
      return "New Feature"
    case "improvement":
      return "Improvement"
    case "fix":
      return "Bug Fix"
    case "breaking":
      return "Breaking Change"
  }
}

export default function WhatsNewPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
          What&apos;s New
        </h1>
        <p className="text-lg text-muted-foreground">
          Latest updates, features, and improvements to Exolar QA
        </p>
      </div>

      {/* Timeline */}
      <div className="relative space-y-8 pt-6">
        {/* Vertical timeline line */}
        <div className="absolute left-4 md:left-6 top-8 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/30 to-transparent" />

        {CHANGELOG_ENTRIES.map((entry, index) => (
          <div key={entry.id} className="relative pl-12 md:pl-16">
            {/* Timeline dot */}
            <div className="absolute left-0 md:left-2 top-1 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center shadow-lg">
              <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
            </div>

            {/* Entry Card */}
            <Card className="border-primary/20">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={getTypeBadgeVariant(entry.type)}>
                      {getTypeBadgeLabel(entry.type)}
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      {entry.version}
                    </Badge>
                  </div>
                  <time className="text-sm text-muted-foreground">
                    {formatDate(entry.date)}
                  </time>
                </div>
                <CardTitle className="text-2xl">{entry.title}</CardTitle>
                <CardDescription className="text-base mt-2">
                  {entry.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Features Grid */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    What&apos;s Included
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {entry.features.map((feature, featureIndex) => (
                      <div
                        key={featureIndex}
                        className="group relative rounded-lg border border-border/40 bg-card/50 p-4 hover:border-primary/50 hover:bg-card transition-all"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl" aria-hidden="true">
                            {feature.icon}
                          </span>
                          <div className="flex-1 space-y-1">
                            <h4 className="font-semibold text-sm leading-none">
                              {feature.title}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {feature.description}
                            </p>
                            {feature.docsUrl && (
                              <Link
                                href={feature.docsUrl}
                                className="inline-flex items-center text-xs text-primary hover:underline mt-2"
                              >
                                Learn more →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Migration Guide (if applicable) */}
                {entry.migration && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                    <h3 className="text-sm font-semibold text-amber-500 mb-3 flex items-center gap-2">
                      <span>⚠️</span>
                      {entry.migration.title}
                    </h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {entry.migration.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-2">
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={entry.migration.docsUrl}
                      className="inline-flex items-center text-sm text-amber-500 hover:underline mt-3"
                    >
                      View migration guide →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* No more updates indicator */}
        {CHANGELOG_ENTRIES.length > 0 && (
          <div className="relative pl-12 md:pl-16 text-sm text-muted-foreground">
            <div className="absolute left-0 md:left-2 top-0 w-8 h-8 rounded-full bg-muted/50 border-2 border-border flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            </div>
            <p className="italic">Launched {formatDate(CHANGELOG_ENTRIES[CHANGELOG_ENTRIES.length - 1].date)}</p>
          </div>
        )}
      </div>

      {/* Empty State (if no entries) */}
      {CHANGELOG_ENTRIES.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-center">
              No updates yet. Check back soon for the latest features and improvements!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

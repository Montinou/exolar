"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface ToolParameter {
  name: string
  type: string
  required?: boolean
  default?: string
  description: string
}

interface ToolCardProps {
  name: string
  description: string
  category?: "core" | "analysis" | "flakiness" | "performance" | "metadata"
  parameters?: ToolParameter[]
  responseFields?: string[]
  example?: string
  className?: string
}

const categoryColors = {
  core: "bg-blue-500/10 text-blue-500",
  analysis: "bg-green-500/10 text-green-500",
  flakiness: "bg-amber-500/10 text-amber-500",
  performance: "bg-purple-500/10 text-purple-500",
  metadata: "bg-gray-500/10 text-gray-400",
}

export function ToolCard({
  name,
  description,
  category,
  parameters = [],
  responseFields = [],
  example,
  className,
}: ToolCardProps) {
  return (
    <div className={cn("p-4 sm:p-6 rounded-xl glass-card", className)}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <code className="text-sm font-mono bg-muted/50 px-2 py-1 rounded text-primary">
          {name}
        </code>
        {category && (
          <Badge variant="secondary" className={cn("text-xs", categoryColors[category])}>
            {category}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <Accordion type="multiple" className="w-full">
        {parameters.length > 0 && (
          <AccordionItem value="parameters" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              Parameters ({parameters.length})
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                {parameters.map((param) => (
                  <div
                    key={param.name}
                    className="p-2 rounded-lg glass-panel text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <code className="text-primary">{param.name}</code>
                      <span className="text-xs text-muted-foreground">
                        ({param.type})
                      </span>
                      {param.required && (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          required
                        </Badge>
                      )}
                      {param.default && (
                        <span className="text-xs text-muted-foreground">
                          default: <code className="px-1 rounded bg-muted">{param.default}</code>
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{param.description}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {responseFields.length > 0 && (
          <AccordionItem value="response" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              Response Fields
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1 pt-2 text-sm text-muted-foreground">
                {responseFields.map((field, i) => (
                  <li key={i}>• {field}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {example && (
          <AccordionItem value="example" className="border-b-0">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              Example Usage
            </AccordionTrigger>
            <AccordionContent>
              <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto mt-2">
                <code>{example}</code>
              </pre>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}

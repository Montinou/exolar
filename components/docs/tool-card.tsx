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
  core: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  analysis: "bg-green-500/10 text-green-500 border-green-500/30",
  flakiness: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  performance: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  metadata: "bg-gray-500/10 text-gray-400 border-gray-500/30",
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
    <div className={cn("p-4 sm:p-6 rounded-xl glass-card glass-card-glow", className)}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
        {category && (
          <span
            className={cn(
              "px-2 py-1 rounded text-xs font-mono font-semibold border",
              categoryColors[category]
            )}
          >
            {category}
          </span>
        )}
        <code className="text-xs sm:text-sm font-mono break-all text-primary">
          {name}
        </code>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <Accordion type="multiple" className="w-full">
        {parameters.length > 0 && (
          <AccordionItem value="parameters" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              Parameters ({parameters.length})
            </AccordionTrigger>
            <AccordionContent>
              {/* Mobile: Card layout */}
              <div className="sm:hidden space-y-2 pt-2">
                {parameters.map((param) => (
                  <div key={param.name} className="p-2 rounded-lg glass-panel">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-primary text-sm">{param.name}</code>
                      <span className="text-xs text-muted-foreground">({param.type})</span>
                      {param.required && (
                        <span className="text-xs px-1 py-0.5 rounded bg-red-500/10 text-red-500">
                          required
                        </span>
                      )}
                    </div>
                    {param.default && (
                      <p className="text-xs text-muted-foreground mb-1">
                        Default: <code className="px-1 rounded bg-muted">{param.default}</code>
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{param.description}</p>
                  </div>
                ))}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden sm:block overflow-x-auto pt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium">Name</th>
                      <th className="text-left py-2 px-2 font-medium">Type</th>
                      <th className="text-left py-2 px-2 font-medium">Default</th>
                      <th className="text-left py-2 px-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {parameters.map((param) => (
                      <tr key={param.name}>
                        <td className="py-2 px-2">
                          <code className="text-primary">{param.name}</code>
                          {param.required && (
                            <span className="ml-1 text-xs text-red-500">*</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{param.type}</td>
                        <td className="py-2 px-2 text-muted-foreground">
                          {param.default || "-"}
                        </td>
                        <td className="py-2 px-2 text-muted-foreground">{param.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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


"use client"

import { cn } from "@/lib/utils"
import { CodeBlock } from "./code-block"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

interface APIParameter {
  name: string
  type: string
  required?: boolean
  default?: string
  description: string
}

interface APIEndpointProps {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  path: string
  description: string
  parameters?: APIParameter[]
  requestBody?: string
  responseExample?: string
  curlExample?: string
  className?: string
}

const methodColors = {
  GET: "bg-green-500/10 text-green-500 border-green-500/30",
  POST: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  PUT: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  DELETE: "bg-red-500/10 text-red-500 border-red-500/30",
  PATCH: "bg-purple-500/10 text-purple-500 border-purple-500/30",
}

export function APIEndpoint({
  method,
  path,
  description,
  parameters = [],
  requestBody,
  responseExample,
  curlExample,
  className,
}: APIEndpointProps) {
  return (
    <div className={cn("p-4 sm:p-6 rounded-xl glass-card", className)}>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
        <span
          className={cn(
            "px-2 py-1 rounded text-xs font-mono font-semibold border",
            methodColors[method]
          )}
        >
          {method}
        </span>
        <code className="text-xs sm:text-sm font-mono break-all">{path}</code>
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

        {requestBody && (
          <AccordionItem value="request" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              Request Body
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <CodeBlock code={requestBody} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {responseExample && (
          <AccordionItem value="response" className="border-border/50">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              Response Example
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <CodeBlock code={responseExample} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {curlExample && (
          <AccordionItem value="curl" className="border-b-0">
            <AccordionTrigger className="text-sm hover:no-underline py-2">
              cURL Example
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <CodeBlock code={curlExample} />
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}

"use client"

import { useState, useCallback } from "react"
import { Play, Copy, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

interface TestEndpointModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  baseUrl: string
  routes?: Array<{ path_pattern: string; method: string }>
}

interface TestResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
}

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"]

export function TestEndpointModal({
  open,
  onOpenChange,
  baseUrl,
  routes = [],
}: TestEndpointModalProps) {
  const [method, setMethod] = useState("GET")
  const [path, setPath] = useState("/")
  const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}')
  const [body, setBody] = useState("")
  const [response, setResponse] = useState<TestResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)

  const fullUrl = `${baseUrl}${path.startsWith("/") ? path : "/" + path}`

  const handleSend = useCallback(async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    const startTime = Date.now()

    try {
      // Parse headers
      let parsedHeaders: Record<string, string> = {}
      try {
        parsedHeaders = JSON.parse(headers)
      } catch {
        throw new Error("Invalid headers JSON")
      }

      // Make request
      const res = await fetch(fullUrl, {
        method,
        headers: parsedHeaders,
        body: ["POST", "PUT", "PATCH"].includes(method) && body ? body : undefined,
      })

      // Read response
      const responseBody = await res.text()
      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: responseBody,
        duration: Date.now() - startTime,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setLoading(false)
    }
  }, [method, fullUrl, headers, body])

  const copyUrl = async () => {
    await navigator.clipboard.writeText(fullUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "bg-green-500/20 text-green-500"
    if (status >= 300 && status < 400) return "bg-yellow-500/20 text-yellow-500"
    if (status >= 400 && status < 500) return "bg-orange-500/20 text-orange-500"
    return "bg-red-500/20 text-red-500"
  }

  const formatJson = (str: string): string => {
    try {
      return JSON.stringify(JSON.parse(str), null, 2)
    } catch {
      return str
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" style={{ color: "var(--exolar-cyan)" }} />
            Test Endpoint
          </DialogTitle>
          <DialogDescription>
            Send a test request to your mock endpoint
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* URL Bar */}
          <div className="flex items-center gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1 relative">
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/endpoint"
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={copyUrl}
              >
                {copiedUrl ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <Button onClick={handleSend} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-2">Send</span>
            </Button>
          </div>

          {/* Route hints */}
          {routes.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-xs text-muted-foreground">Routes:</span>
              {routes.slice(0, 5).map((route, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-muted"
                  onClick={() => {
                    setPath(route.path_pattern)
                    if (route.method !== "*") {
                      setMethod(route.method)
                    }
                  }}
                >
                  {route.method !== "*" && (
                    <span className="mr-1 opacity-60">{route.method}</span>
                  )}
                  {route.path_pattern}
                </Badge>
              ))}
              {routes.length > 5 && (
                <span className="text-xs text-muted-foreground">
                  +{routes.length - 5} more
                </span>
              )}
            </div>
          )}

          {/* Request/Response Tabs */}
          <Tabs defaultValue="request" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="request">Request</TabsTrigger>
              <TabsTrigger value="response">
                Response
                {response && (
                  <Badge
                    variant="outline"
                    className={`ml-2 ${getStatusColor(response.status)}`}
                  >
                    {response.status}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="request" className="flex-1 space-y-4 overflow-auto">
              <div className="space-y-2">
                <Label>Headers (JSON)</Label>
                <Textarea
                  value={headers}
                  onChange={(e) => setHeaders(e.target.value)}
                  placeholder='{"Content-Type": "application/json"}'
                  className="font-mono text-sm h-24"
                />
              </div>

              {["POST", "PUT", "PATCH"].includes(method) && (
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    className="font-mono text-sm h-32"
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="response" className="flex-1 overflow-hidden">
              {error && (
                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              {response && (
                <div className="space-y-4 h-full flex flex-col">
                  {/* Status bar */}
                  <div className="flex items-center gap-4 text-sm">
                    <Badge className={getStatusColor(response.status)}>
                      {response.status} {response.statusText}
                    </Badge>
                    <span className="text-muted-foreground">
                      {response.duration}ms
                    </span>
                  </div>

                  {/* Response content */}
                  <Tabs defaultValue="body" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="w-fit">
                      <TabsTrigger value="body">Body</TabsTrigger>
                      <TabsTrigger value="headers">
                        Headers ({Object.keys(response.headers).length})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="body" className="flex-1 min-h-0">
                      <ScrollArea className="h-[200px] rounded-lg border bg-muted/30">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                          {formatJson(response.body)}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="headers" className="flex-1 min-h-0">
                      <ScrollArea className="h-[200px] rounded-lg border bg-muted/30">
                        <div className="p-4 text-xs font-mono space-y-1">
                          {Object.entries(response.headers).map(([key, value]) => (
                            <div key={key}>
                              <span className="text-muted-foreground">{key}:</span>{" "}
                              {value}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {!error && !response && (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  Send a request to see the response
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}

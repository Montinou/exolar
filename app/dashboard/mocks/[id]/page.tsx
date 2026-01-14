"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Plus,
  Copy,
  Check,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Clock,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  MockInterface,
  MockRouteWithRuleCount,
  MockResponseRule,
  MockRequestLog,
} from "@/lib/types"

interface MockInterfaceWithRoutes extends MockInterface {
  public_url: string
  routes: MockRouteWithRuleCount[]
}

export default function MockDetailPage() {
  const params = useParams()
  const router = useRouter()
  const interfaceId = params.id as string

  const [mockInterface, setMockInterface] = useState<MockInterfaceWithRoutes | null>(null)
  const [logs, setLogs] = useState<MockRequestLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logsLoading, setLogsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Route dialog state
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false)
  const [creatingRoute, setCreatingRoute] = useState(false)
  const [newRoute, setNewRoute] = useState({ path_pattern: "/", method: "GET", description: "" })

  // Rule dialog state
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false)
  const [creatingRule, setCreatingRule] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null)
  const [newRule, setNewRule] = useState({
    name: "",
    response_status: 200,
    response_body: '{"message": "Hello World"}',
    response_headers: '{"Content-Type": "application/json"}',
    response_delay_ms: 0,
  })

  // Expanded routes state
  const [expandedRoutes, setExpandedRoutes] = useState<Set<number>>(new Set())

  // Route rules cache
  const [routeRules, setRouteRules] = useState<Record<number, MockResponseRule[]>>({})

  // Delete state
  const [deleteRouteId, setDeleteRouteId] = useState<number | null>(null)
  const [deletingRoute, setDeletingRoute] = useState(false)

  // Copy state
  const [copied, setCopied] = useState(false)

  const fetchInterface = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/mocks/${interfaceId}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/dashboard/mocks")
          return
        }
        throw new Error("Failed to fetch mock interface")
      }
      const data = await res.json()
      setMockInterface(data.interface)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [interfaceId, router])

  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true)
      const res = await fetch(`/api/mocks/${interfaceId}/logs?limit=50`)
      if (!res.ok) throw new Error("Failed to fetch logs")
      const data = await res.json()
      setLogs(data.logs)
    } catch (err) {
      console.error("Error fetching logs:", err)
    } finally {
      setLogsLoading(false)
    }
  }, [interfaceId])

  const fetchRulesForRoute = async (routeId: number) => {
    try {
      const res = await fetch(`/api/mocks/${interfaceId}/routes/${routeId}/rules`)
      if (!res.ok) throw new Error("Failed to fetch rules")
      const data = await res.json()
      setRouteRules((prev) => ({ ...prev, [routeId]: data.rules }))
    } catch (err) {
      console.error("Error fetching rules:", err)
    }
  }

  useEffect(() => {
    fetchInterface()
  }, [fetchInterface])

  const toggleRoute = (routeId: number) => {
    const newExpanded = new Set(expandedRoutes)
    if (newExpanded.has(routeId)) {
      newExpanded.delete(routeId)
    } else {
      newExpanded.add(routeId)
      // Fetch rules if not already loaded
      if (!routeRules[routeId]) {
        fetchRulesForRoute(routeId)
      }
    }
    setExpandedRoutes(newExpanded)
  }

  const handleCreateRoute = async () => {
    if (!newRoute.path_pattern) return

    try {
      setCreatingRoute(true)
      const res = await fetch(`/api/mocks/${interfaceId}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRoute),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create route")
      }

      setIsRouteDialogOpen(false)
      setNewRoute({ path_pattern: "/", method: "GET", description: "" })
      await fetchInterface()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setCreatingRoute(false)
    }
  }

  const handleCreateRule = async () => {
    if (!selectedRouteId || !newRule.name) return

    try {
      setCreatingRule(true)

      // Parse headers
      let headers = {}
      try {
        headers = JSON.parse(newRule.response_headers || "{}")
      } catch {
        throw new Error("Invalid JSON in response headers")
      }

      const res = await fetch(
        `/api/mocks/${interfaceId}/routes/${selectedRouteId}/rules`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newRule.name,
            response_status: newRule.response_status,
            response_body: newRule.response_body,
            response_headers: headers,
            response_delay_ms: newRule.response_delay_ms,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create rule")
      }

      setIsRuleDialogOpen(false)
      setNewRule({
        name: "",
        response_status: 200,
        response_body: '{"message": "Hello World"}',
        response_headers: '{"Content-Type": "application/json"}',
        response_delay_ms: 0,
      })
      setSelectedRouteId(null)

      // Refresh rules for this route
      await fetchRulesForRoute(selectedRouteId)
      await fetchInterface()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setCreatingRule(false)
    }
  }

  const handleDeleteRoute = async () => {
    if (!deleteRouteId) return

    try {
      setDeletingRoute(true)
      const res = await fetch(`/api/mocks/${interfaceId}/routes/${deleteRouteId}`, {
        method: "DELETE",
      })

      if (!res.ok) throw new Error("Failed to delete route")

      setDeleteRouteId(null)
      await fetchInterface()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setDeletingRoute(false)
    }
  }

  const copyUrl = async () => {
    if (!mockInterface) return
    await navigator.clipboard.writeText(mockInterface.public_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  }

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-green-500/20 text-green-400",
      POST: "bg-blue-500/20 text-blue-400",
      PUT: "bg-yellow-500/20 text-yellow-400",
      DELETE: "bg-red-500/20 text-red-400",
      PATCH: "bg-purple-500/20 text-purple-400",
      "*": "bg-gray-500/20 text-gray-400",
    }
    return colors[method] || colors["*"]
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    )
  }

  if (!mockInterface) {
    return (
      <div className="p-6">
        <p>Mock interface not found</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/mocks">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{mockInterface.name}</h1>
          {mockInterface.description && (
            <p className="text-muted-foreground">{mockInterface.description}</p>
          )}
        </div>
        <Badge variant={mockInterface.is_active ? "default" : "secondary"}>
          {mockInterface.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-destructive">
          {error}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Public URL Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Public Endpoint</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
              {mockInterface.public_url}
            </code>
            <Button variant="outline" size="icon" onClick={copyUrl}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button variant="outline" size="icon" asChild>
              <a href={mockInterface.public_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Rate limit: {mockInterface.rate_limit_rpm} requests/minute
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="routes" onValueChange={(v) => v === "logs" && fetchLogs()}>
        <TabsList>
          <TabsTrigger value="routes">
            Routes ({mockInterface.routes.length})
          </TabsTrigger>
          <TabsTrigger value="logs">
            <Activity className="h-4 w-4 mr-1" />
            Request Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="routes" className="space-y-4">
          {/* Add Route Button */}
          <div className="flex justify-end">
            <Dialog open={isRouteDialogOpen} onOpenChange={setIsRouteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Route
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card">
                <DialogHeader>
                  <DialogTitle>Add Route</DialogTitle>
                  <DialogDescription>
                    Define a path pattern and HTTP method for this route.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="path">Path Pattern</Label>
                      <Input
                        id="path"
                        placeholder="/users/:id"
                        value={newRoute.path_pattern}
                        onChange={(e) =>
                          setNewRoute((prev) => ({ ...prev, path_pattern: e.target.value }))
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Supports :params and * wildcards
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="method">Method</Label>
                      <Select
                        value={newRoute.method}
                        onValueChange={(v) => setNewRoute((prev) => ({ ...prev, method: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                          <SelectItem value="*">ANY (*)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="routeDesc">Description (optional)</Label>
                    <Input
                      id="routeDesc"
                      placeholder="Get user by ID"
                      value={newRoute.description}
                      onChange={(e) =>
                        setNewRoute((prev) => ({ ...prev, description: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRouteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRoute} disabled={creatingRoute}>
                    {creatingRoute ? "Creating..." : "Create Route"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Routes List */}
          {mockInterface.routes.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">No routes defined yet</p>
                <Button onClick={() => setIsRouteDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Route
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {mockInterface.routes.map((route) => (
                <Collapsible
                  key={route.id}
                  open={expandedRoutes.has(route.id)}
                  onOpenChange={() => toggleRoute(route.id)}
                >
                  <Card className="glass-card">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
                        <div className="flex items-center gap-3">
                          {expandedRoutes.has(route.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <Badge className={getMethodColor(route.method)}>
                            {route.method}
                          </Badge>
                          <code className="font-mono text-sm">{route.path_pattern}</code>
                          <span className="text-muted-foreground text-sm ml-auto">
                            {route.rule_count} {route.rule_count === 1 ? "rule" : "rules"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteRouteId(route.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                        {route.description && (
                          <p className="text-sm text-muted-foreground ml-7">
                            {route.description}
                          </p>
                        )}
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="border-t pt-4 space-y-4">
                          {/* Rules for this route */}
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Response Rules</h4>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRouteId(route.id)
                                setIsRuleDialogOpen(true)
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Rule
                            </Button>
                          </div>

                          {!routeRules[route.id] ? (
                            <Skeleton className="h-20 w-full" />
                          ) : routeRules[route.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No rules defined. Add a rule to configure responses.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {routeRules[route.id].map((rule) => (
                                <div
                                  key={rule.id}
                                  className="bg-muted/30 rounded-lg p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{rule.name}</span>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          rule.response_status < 300
                                            ? "default"
                                            : rule.response_status < 400
                                              ? "secondary"
                                              : "destructive"
                                        }
                                      >
                                        {rule.response_status}
                                      </Badge>
                                      {rule.response_delay_ms > 0 && (
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {rule.response_delay_ms}ms
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {rule.response_body && (
                                    <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-24">
                                      {rule.response_body.slice(0, 200)}
                                      {rule.response_body.length > 200 && "..."}
                                    </pre>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    {rule.hit_count} hits
                                    {rule.last_hit_at && ` · Last: ${formatDate(rule.last_hit_at)}`}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>Last 50 requests to this mock interface</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No requests logged yet
                </p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                    >
                      <Badge className={getMethodColor(log.method)}>{log.method}</Badge>
                      <code className="text-sm flex-1 truncate">{log.path}</code>
                      <Badge
                        variant={
                          log.matched
                            ? log.response_status && log.response_status < 400
                              ? "default"
                              : "destructive"
                            : "secondary"
                        }
                      >
                        {log.response_status || "—"}
                      </Badge>
                      <span className="text-xs text-muted-foreground w-[100px]">
                        {log.response_time_ms}ms
                      </span>
                      <span className="text-xs text-muted-foreground w-[150px]">
                        {formatDate(log.request_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Rule Dialog */}
      <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
        <DialogContent className="glass-card max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Response Rule</DialogTitle>
            <DialogDescription>
              Configure the response that will be returned when this route is matched.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ruleName">Rule Name</Label>
              <Input
                id="ruleName"
                placeholder="Success Response"
                value={newRule.name}
                onChange={(e) => setNewRule((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status Code</Label>
                <Input
                  id="status"
                  type="number"
                  min={100}
                  max={599}
                  value={newRule.response_status}
                  onChange={(e) =>
                    setNewRule((prev) => ({
                      ...prev,
                      response_status: parseInt(e.target.value) || 200,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay">Delay (ms)</Label>
                <Input
                  id="delay"
                  type="number"
                  min={0}
                  max={30000}
                  value={newRule.response_delay_ms}
                  onChange={(e) =>
                    setNewRule((prev) => ({
                      ...prev,
                      response_delay_ms: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="headers">Response Headers (JSON)</Label>
              <Textarea
                id="headers"
                className="font-mono text-sm"
                rows={3}
                value={newRule.response_headers}
                onChange={(e) =>
                  setNewRule((prev) => ({ ...prev, response_headers: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Response Body</Label>
              <Textarea
                id="body"
                className="font-mono text-sm"
                rows={6}
                placeholder='{"message": "Hello World"}'
                value={newRule.response_body}
                onChange={(e) =>
                  setNewRule((prev) => ({ ...prev, response_body: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Supports templating: {"{{request.body.name}}"}, {"{{uuid}}"}, {"{{timestamp}}"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateRule} disabled={creatingRule || !newRule.name}>
              {creatingRule ? "Creating..." : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Route Dialog */}
      <AlertDialog open={!!deleteRouteId} onOpenChange={(open) => !open && setDeleteRouteId(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this route? This will also delete all associated
              rules. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoute}
              disabled={deletingRoute}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRoute ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Webhook, Plus, Trash2, Pencil, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export interface OrgWebhook {
  id: number
  name: string
  url: string
  events: string[]
  filters: { branches?: string[] } | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface WebhookListProps {
  initialWebhooks: OrgWebhook[]
}

const ALL_EVENTS = ["failure", "flake", "healed"] as const

function eventBadgeVariant(event: string): "destructive" | "secondary" | "outline" {
  if (event === "failure") return "destructive"
  if (event === "flake") return "secondary"
  return "outline"
}

export function WebhookList({ initialWebhooks }: WebhookListProps) {
  const [webhooks, setWebhooks] = useState<OrgWebhook[]>(initialWebhooks)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<OrgWebhook | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrgWebhook | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState("")
  const [formUrl, setFormUrl] = useState("")
  const [formEvents, setFormEvents] = useState<string[]>(["failure"])
  const [formBranches, setFormBranches] = useState("")
  const [formSecret, setFormSecret] = useState("")

  const resetForm = () => {
    setFormName("")
    setFormUrl("")
    setFormEvents(["failure"])
    setFormBranches("")
    setFormSecret("")
    setEditTarget(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (webhook: OrgWebhook) => {
    setEditTarget(webhook)
    setFormName(webhook.name)
    setFormUrl(webhook.url)
    setFormEvents(webhook.events)
    setFormBranches(webhook.filters?.branches?.join(", ") ?? "")
    setFormSecret("")
    setDialogOpen(true)
  }

  const toggleEvent = (event: string) => {
    setFormEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    )
  }

  const buildFilters = () => {
    const branches = formBranches
      .split(",")
      .map(b => b.trim())
      .filter(Boolean)
    return branches.length > 0 ? { branches } : {}
  }

  const handleSave = useCallback(async () => {
    if (!formName.trim() || !formUrl.trim()) {
      toast.error("Name and URL are required")
      return
    }
    if (formEvents.length === 0) {
      toast.error("Select at least one event")
      return
    }

    setSaving(true)
    try {
      if (editTarget) {
        const res = await fetch(`/api/ci/webhooks/${editTarget.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            url: formUrl.trim(),
            events: formEvents,
            filters: buildFilters(),
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || "Update failed")
        }
        const { webhook } = await res.json()
        setWebhooks(prev => prev.map(w => (w.id === webhook.id ? webhook : w)))
        toast.success("Webhook updated")
      } else {
        const res = await fetch("/api/ci/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            url: formUrl.trim(),
            events: formEvents,
            filters: buildFilters(),
            secret: formSecret || undefined,
          }),
        })
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.error || "Create failed")
        }
        const { webhook } = await res.json()
        setWebhooks(prev => [webhook, ...prev])
        toast.success("Webhook created")
      }
      setDialogOpen(false)
      resetForm()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }, [editTarget, formName, formUrl, formEvents, formBranches, formSecret])

  const handleToggleActive = async (webhook: OrgWebhook) => {
    try {
      const res = await fetch(`/api/ci/webhooks/${webhook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !webhook.is_active }),
      })
      if (!res.ok) throw new Error("Update failed")
      const { webhook: updated } = await res.json()
      setWebhooks(prev => prev.map(w => (w.id === updated.id ? updated : w)))
    } catch {
      toast.error("Failed to update webhook")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/ci/webhooks/${deleteTarget.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setWebhooks(prev => prev.filter(w => w.id !== deleteTarget.id))
      toast.success("Webhook deleted")
      setDeleteTarget(null)
    } catch {
      toast.error("Failed to delete webhook")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Receive HTTP notifications when CI events occur.
          </p>
          <Button onClick={openCreate} className="btn-amber">
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>

        {webhooks.length === 0 ? (
          <Card className="glass-card glass-card-glow">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Webhook className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">No webhooks configured yet.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Add one to start receiving CI event notifications.
              </p>
            </CardContent>
          </Card>
        ) : (
          webhooks.map(webhook => (
            <Card key={webhook.id} className="glass-card glass-card-glow">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {webhook.name}
                      {!webhook.is_active && (
                        <Badge variant="outline" className="text-xs">inactive</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="truncate mt-1">{webhook.url}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={() => handleToggleActive(webhook)}
                      aria-label="Toggle active"
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(webhook)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(webhook)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {webhook.events.map(event => (
                    <Badge key={event} variant={eventBadgeVariant(event)}>{event}</Badge>
                  ))}
                  {webhook.filters?.branches && webhook.filters.branches.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      branches: {webhook.filters.branches.join(", ")}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => { if (!open) { setDialogOpen(false); resetForm() } else setDialogOpen(true) }}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Webhook" : "Add Webhook"}</DialogTitle>
            <DialogDescription>
              {editTarget ? "Update webhook configuration." : "Configure a new HTTP endpoint to receive CI event notifications."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="wh-name">Name</Label>
              <Input
                id="wh-name"
                placeholder="e.g., Slack CI alerts"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">URL</Label>
              <Input
                id="wh-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="flex gap-3">
                {ALL_EVENTS.map(event => (
                  <label key={event} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={formEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="accent-primary"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-branches">Branches filter <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="wh-branches"
                placeholder="main, develop"
                value={formBranches}
                onChange={e => setFormBranches(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Comma-separated branch names. Leave empty to receive all.</p>
            </div>
            {!editTarget && (
              <div className="space-y-2">
                <Label htmlFor="wh-secret">Secret <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="wh-secret"
                  type="password"
                  placeholder="Used to sign payloads via X-Exolar-Signature"
                  value={formSecret}
                  onChange={e => setFormSecret(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} loading={saving}>
              {saving ? "Saving..." : editTarget ? "Save Changes" : "Create Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.name}&quot;?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

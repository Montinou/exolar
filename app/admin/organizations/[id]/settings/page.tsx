"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { UserMenu } from "@/components/dashboard/user-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, Settings, Loader2, Shield, Trash2 } from "lucide-react"

interface Organization {
  id: number
  name: string
  slug: string
  created_at: string
}

export default function OrgSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [orgId])

  async function loadData() {
    try {
      // Check if user is admin
      const accessRes = await fetch("/api/auth/check-access")
      const accessData = await accessRes.json()

      if (!accessData.authorized || accessData.user?.role !== "admin") {
        setIsAdmin(false)
        setLoading(false)
        return
      }

      setIsAdmin(true)

      // Fetch org details
      const orgRes = await fetch(`/api/organizations/${orgId}`)
      if (orgRes.ok) {
        const orgData = await orgRes.json()
        setOrganization(orgData.organization)
        setName(orgData.organization.name)
        setSlug(orgData.organization.slug)
      }
    } catch (err) {
      console.error("Failed to load data:", err)
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  async function saveChanges() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to save changes")
        return
      }

      setOrganization(data.organization)
      setSuccess("Changes saved successfully")
    } catch (err) {
      console.error("Failed to save changes:", err)
      setError("Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  async function deleteOrganization() {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/organizations/${orgId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        router.push("/admin/organizations")
      } else {
        const data = await res.json()
        setError(data.error || "Failed to delete organization")
      }
    } catch (err) {
      console.error("Failed to delete organization:", err)
      setError("Failed to delete organization")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>
              You need admin privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => router.push("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/admin/organizations")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Settings className="h-6 w-6" />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >{organization?.name || "Organization"} - Settings</span>
                </h1>
                <p className="text-sm text-muted-foreground">
                  Update organization details or delete
                </p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* Organization Details */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Update the name and slug for this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Organization name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) =>
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                placeholder="organization-slug"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button onClick={saveChanges} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="glass-card border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="glass-card">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the organization
                    &ldquo;{organization?.name}&rdquo; and remove all associated data including
                    members and test executions.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={deleteOrganization}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

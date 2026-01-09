"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { UserMenu } from "@/components/dashboard/user-menu"
import { Plus, Users, Settings, ArrowLeft, Building, Loader2, Shield } from "lucide-react"
import Link from "next/link"

interface Organization {
  id: number
  name: string
  slug: string
  created_at: string
  member_count?: number
}

export default function OrganizationsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newOrg, setNewOrg] = useState({ name: "", slug: "" })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

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
      await fetchOrganizations()
    } catch (err) {
      console.error("Failed to load data:", err)
      setError("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  async function fetchOrganizations() {
    const res = await fetch("/api/admin/organizations")
    if (res.ok) {
      const data = await res.json()
      setOrganizations(data.organizations || [])
    }
  }

  async function createOrganization() {
    if (!newOrg.name || !newOrg.slug) {
      setError("Name and slug are required")
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOrg),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create organization")
        return
      }

      setIsCreateOpen(false)
      setNewOrg({ name: "", slug: "" })
      await fetchOrganizations()
    } catch (err) {
      console.error("Failed to create organization:", err)
      setError("Failed to create organization")
    } finally {
      setCreating(false)
    }
  }

  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
    setNewOrg({ name, slug })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-[400px]" />
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
              <Button variant="ghost" size="icon" onClick={() => router.push("/admin")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Building className="h-6 w-6" />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >Organizations</span>
                </h1>
                <p className="text-sm text-muted-foreground">Manage multi-tenant organizations</p>
              </div>
            </div>
            <div className="flex items-center gap-4 self-end sm:self-auto">
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Organization
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass-card">
                  <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                      Create a new organization for multi-tenant data isolation.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Organization Name</Label>
                      <Input
                        id="name"
                        placeholder="Acme Corporation"
                        value={newOrg.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug (URL-friendly)</Label>
                      <Input
                        id="slug"
                        placeholder="acme-corporation"
                        value={newOrg.slug}
                        onChange={(e) =>
                          setNewOrg({
                            ...newOrg,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Lowercase letters, numbers, and hyphens only
                      </p>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={createOrganization} disabled={creating}>
                      {creating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle>All Organizations</CardTitle>
            <CardDescription>
              {organizations.length} organization{organizations.length !== 1 ? "s" : ""} registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            {organizations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No organizations yet. Create one to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-sm">
                        {org.slug}
                      </TableCell>
                      <TableCell>{new Date(org.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{org.member_count || 0}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/admin/organizations/${org.id}/members`}>
                            <Button variant="outline" size="sm">
                              <Users className="h-4 w-4 mr-1" />
                              Members
                            </Button>
                          </Link>
                          <Link href={`/admin/organizations/${org.id}/settings`}>
                            <Button variant="outline" size="sm">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

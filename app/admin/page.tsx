"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserMenu } from "@/components/dashboard/user-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, UserPlus, Trash2, Shield, User, Mail, Loader2, Building } from "lucide-react"
import { BrandLogo } from "@/components/ui/brand-logo"
import Link from "next/link"
import type { DashboardUser, Invite, Organization } from "@/lib/db"

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([]) // Add organizations state
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer")
  const [inviteOrg, setInviteOrg] = useState<string>("") // Add inviteOrg state
  const [invitePassword, setInvitePassword] = useState("") // Add invitePassword state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
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

        // Load users, invites, and organizations
        const [usersRes, invitesRes, orgsRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/invites"),
          fetch("/api/admin/organizations"),
        ])

        const usersData = await usersRes.json()
        const invitesData = await invitesRes.json()
        const orgsData = await orgsRes.json()

        setUsers(usersData.users || [])
        setInvites(invitesData.invites || [])
        setOrganizations(orgsData.organizations || [])
      } catch (err) {
        console.error("Failed to load admin data:", err)
        setError("Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          organizationId: inviteOrg ? parseInt(inviteOrg) : undefined,
          password: invitePassword || undefined
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create invite")
        return
      }

      if (data.user) {
         // User created directly
         setUsers([data.user, ...users])
      } else if (data.invite) {
         // Invite created
         setInvites([data.invite, ...invites])
      }
      
      setInviteEmail("")
      setInviteRole("viewer")
      setInviteOrg("")
      setInvitePassword("")
    } catch (err) {
      console.error("Failed to create invite:", err)
      setError("Failed to create invite")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteInvite = async (inviteId: number) => {
    try {
      const res = await fetch("/api/admin/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      })

      if (res.ok) {
        setInvites(invites.filter((i) => i.id !== inviteId))
      }
    } catch (err) {
      console.error("Failed to delete invite:", err)
    }
  }

  const handleUpdateRole = async (userId: number, newRole: "admin" | "viewer") => {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (res.ok) {
        const data = await res.json()
        setUsers(users.map((u) => (u.id === userId ? data.user : u)))
      }
    } catch (err) {
      console.error("Failed to update role:", err)
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return

    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (res.ok) {
        setUsers(users.filter((u) => u.id !== userId))
      }
    } catch (err) {
      console.error("Failed to delete user:", err)
    }
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
          <div className="space-y-6">
            <Skeleton className="h-[200px]" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <BrandLogo variant="animated-icon" width={24} />
                  <h1
                    className="text-2xl font-bold"
                    style={{
                      background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >Admin Panel</h1>
                </div>
                <p className="text-sm text-muted-foreground">Manage users and invites</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/admin/organizations">
                <Button variant="outline" size="sm" className="sm:size-default">
                  <Building className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Organizations</span>
                </Button>
              </Link>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Invite Form */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite User
            </CardTitle>
            <CardDescription>
              Send an invite to allow a new user to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org">Organization (Optional)</Label>
                  <Select value={inviteOrg} onValueChange={setInviteOrg}>
                    <SelectTrigger id="org">
                      <SelectValue placeholder="Select Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Default (Attorneyshare)</SelectItem>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password (Optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Set password (optional)"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "viewer")}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Invite
                </Button>
              </div>
            </form>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invites
            </CardTitle>
            <CardDescription>
              Users who have been invited but haven&apos;t signed in yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.filter((i) => !i.used).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No pending invites</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="hidden sm:table-cell">Invited At</TableHead>
                    <TableHead className="w-[80px] sm:w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites
                    .filter((i) => !i.used)
                    .map((invite) => {
                      const org = organizations.find(o => o.id === invite.organization_id)
                      return (
                      <TableRow key={invite.id}>
                        <TableCell className="max-w-[150px] truncate sm:max-w-none">{invite.email}</TableCell>
                        <TableCell>
                          <Badge variant={invite.role === "admin" ? "default" : "secondary"}>
                            {invite.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                           {org ? org.name : (invite.organization_id ? `ID: ${invite.organization_id}` : "Default")}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{new Date(invite.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteInvite(invite.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>
              All users with access to the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead className="w-[80px] sm:w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="max-w-[150px] truncate sm:max-w-none">{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleUpdateRole(user.id, v as "admin" | "viewer")}
                      >
                        <SelectTrigger className="w-24 sm:w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

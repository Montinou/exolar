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
import { ArrowLeft, UserPlus, Trash2, Shield, User, Mail, Loader2 } from "lucide-react"
import type { DashboardUser, Invite } from "@/lib/db-users"

export default function AdminPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer")
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

        // Load users and invites
        const [usersRes, invitesRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/invites"),
        ])

        const usersData = await usersRes.json()
        const invitesData = await invitesRes.json()

        setUsers(usersData.users || [])
        setInvites(invitesData.invites || [])
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
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to create invite")
        return
      }

      setInvites([data.invite, ...invites])
      setInviteEmail("")
      setInviteRole("viewer")
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">Manage users and invites</p>
              </div>
            </div>
            <UserMenu />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Invite Form */}
        <Card>
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
            <form onSubmit={handleInvite} className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
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
              <div className="w-40 space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "viewer")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Invite
              </Button>
            </form>
            {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          </CardContent>
        </Card>

        {/* Pending Invites */}
        <Card>
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
                    <TableHead>Invited At</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites
                    .filter((i) => !i.used)
                    .map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>
                          <Badge variant={invite.role === "admin" ? "default" : "secondary"}>
                            {invite.role}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(invite.created_at).toLocaleDateString()}</TableCell>
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
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
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
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleUpdateRole(user.id, v as "admin" | "viewer")}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
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

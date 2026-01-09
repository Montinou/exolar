"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { UserMenu } from "@/components/dashboard/user-menu"
import { ArrowLeft, UserPlus, Trash2, Shield, Loader2, Users, Mail, Building2 } from "lucide-react"

interface Member {
  id: number
  user_id: number
  user_email: string
  role: "owner" | "admin" | "viewer"
  joined_at: string
}

interface Invite {
  id: number
  email: string
  role: string
  created_at: string
}

interface Organization {
  id: number
  name: string
  slug: string
}

export default function TeamSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"admin" | "viewer">("viewer")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const res = await fetch("/api/settings/team")

      if (res.status === 403) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      if (!res.ok) {
        throw new Error("Failed to load team data")
      }

      const data = await res.json()
      setHasAccess(true)
      setOrganization(data.organization)
      setMembers(data.members || [])
      setInvites(data.invites || [])
      setCurrentUserId(data.currentUserId)
      setCurrentUserRole(data.currentUserRole)
    } catch (err) {
      console.error("Failed to load data:", err)
      setError("Failed to load team data")
    } finally {
      setLoading(false)
    }
  }

  async function inviteMember() {
    if (!inviteEmail) {
      setError("Email is required")
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/settings/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to add member")
        return
      }

      setInviteEmail("")
      setInviteRole("viewer")
      setSuccess(data.status === "added" ? "Member added successfully" : "Invitation sent successfully")
      await loadData()
    } catch (err) {
      console.error("Failed to invite member:", err)
      setError("Failed to invite member")
    } finally {
      setSubmitting(false)
    }
  }

  async function updateRole(userId: number, newRole: string) {
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch("/api/settings/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to update role")
        return
      }

      setSuccess("Role updated successfully")
      await loadData()
    } catch (err) {
      console.error("Failed to update role:", err)
      setError("Failed to update role")
    }
  }

  async function removeMember(userId: number, email: string) {
    if (!confirm(`Are you sure you want to remove ${email} from the organization?`)) return

    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/settings/team?userId=${userId}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to remove member")
        return
      }

      setSuccess("Member removed successfully")
      await loadData()
    } catch (err) {
      console.error("Failed to remove member:", err)
      setError("Failed to remove member")
    }
  }

  const roleColors: Record<string, string> = {
    owner: "bg-purple-500 hover:bg-purple-600",
    admin: "bg-blue-500 hover:bg-blue-600",
    viewer: "bg-gray-500 hover:bg-gray-600",
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card/50">
          <div className="container mx-auto px-4 py-6">
            <Skeleton className="h-8 w-64" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md glass-card">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Organization Admin Required</CardTitle>
            <CardDescription>
              You need to be an organization admin or owner to manage team members.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" onClick={() => router.push("/settings")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Settings
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
                onClick={() => router.push("/settings")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Users className="h-6 w-6" />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >Team Management</span>
                </h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {organization?.name || "Organization"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={roleColors[currentUserRole || "viewer"]}>
                Your role: {currentUserRole}
              </Badge>
              <UserMenu />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Status Messages */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        {/* Invite Form */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Member
            </CardTitle>
            <CardDescription>
              Add an existing user or send an invitation to a new user
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && inviteMember()}
                />
              </div>
              <div className="w-full sm:w-32 space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as "admin" | "viewer")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={inviteMember} disabled={submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Invite
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <Card className="glass-card glass-card-glow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Pending Invitations
              </CardTitle>
              <CardDescription>
                Users who have been invited but haven&apos;t signed in yet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Invited At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{invite.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Members List */}
        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members
            </CardTitle>
            <CardDescription>
              {members.length} member{members.length !== 1 ? "s" : ""} in {organization?.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No team members yet. Invite someone to get started.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.user_email}
                          {member.user_id === currentUserId && (
                            <span className="text-muted-foreground ml-2">(you)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[member.role]}>{member.role}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.role !== "owner" && member.user_id !== currentUserId && (
                            <div className="flex justify-end gap-2">
                              <Select
                                value={member.role}
                                onValueChange={(v) => updateRole(member.user_id, v)}
                              >
                                <SelectTrigger className="w-24 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="viewer">Viewer</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => removeMember(member.user_id, member.user_email)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {member.role === "owner" && (
                            <span className="text-muted-foreground text-sm">Owner</span>
                          )}
                          {member.user_id === currentUserId && member.role !== "owner" && (
                            <span className="text-muted-foreground text-sm">You</span>
                          )}
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

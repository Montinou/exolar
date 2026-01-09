"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth/client"
import { Loader2, Lock, ArrowLeft, Users, ChevronRight } from "lucide-react"
import { toast } from "sonner"

export default function SettingsPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [isOrgAdmin, setIsOrgAdmin] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    async function checkOrgAdmin() {
      try {
        const res = await fetch("/api/settings/team")
        if (res.ok) {
          const data = await res.json()
          setIsOrgAdmin(true)
          setOrgName(data.organization?.name || null)
        }
      } catch {
        // User is not org admin, that's fine
      }
    }
    checkOrgAdmin()
  }, [])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setSubmitting(true)

    try {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true
      })

      if (error) {
        toast.error(error.message || "Failed to change password")
      } else {
        toast.success("Password changed successfully")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      }
    } catch (err) {
      console.error("Failed to change password:", err)
      toast.error("An unexpected error occurred")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
           <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1
          className="text-3xl font-bold"
          style={{
            background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >Settings</h1>
      </div>

      <div className="space-y-6">
        {/* Team Management Link - Only for org admins */}
        {isOrgAdmin && (
          <Link href="/settings/team">
            <Card className="glass-card glass-card-glow hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Team Management</CardTitle>
                      <CardDescription>
                        Manage members and invitations{orgName ? ` for ${orgName}` : ""}
                      </CardDescription>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
            </Card>
          </Link>
        )}

        <Card className="glass-card glass-card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

/**
 * Admin - Send Credentials Page
 * Bulk email sending for team members
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Loader2, Mail, CheckCircle2, XCircle, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// Team members from USER_CREDENTIALS.md
const ATTORNEYSHARE_USERS = [
  { name: "George Durzi", email: "george@attorneyshare.com", password: "EaofVmUcF8UwzaS5", role: "admin" as const },
  { name: "Kathy Shulman", email: "kathy@attorneyshare.com", password: "8ktstzNiQcHPA$#t", role: "viewer" as const },
  { name: "Brandon Almeda", email: "brandon@attorneyshare.com", password: "xbE%nZLg#$9BMcnJ", role: "viewer" as const },
  { name: "Jorge Cazares", email: "jorge.cazares@distillery.com", password: "FneR$r6EDQ$X2Qez", role: "viewer" as const },
  { name: "Robert Perez", email: "robertp@attorneyshare.com", password: "zGu@w8a8EJ@YkTFz", role: "viewer" as const },
  { name: "Jenni Labao", email: "jenni@attorneyshare.com", password: "iC%qTbPswLc4MoHo", role: "viewer" as const },
  { name: "Renzo Servera", email: "renzo.servera@distillery.com", password: "W8HFghSgQSm6Tg#X", role: "viewer" as const },
  { name: "Ivan Grosse", email: "ivan.grosse@distillery.com", password: "PVV83!oyQUpWQiLn", role: "viewer" as const },
]

// Example external users for Exolar template testing
const EXOLAR_DEMO_USERS = [
  { name: "Demo User 1", email: "demo1@example.com", password: "DemoPass123!", role: "viewer" as const },
  { name: "Demo User 2", email: "demo2@example.com", password: "DemoPass456!", role: "admin" as const },
]

type User = {
  name: string
  email: string
  password: string
  role: "admin" | "viewer"
}

type SendResult = {
  email: string
  status: "sent" | "failed"
  emailId?: string
}

export default function SendCredentialsPage() {
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isSending, setIsSending] = useState(false)
  const [results, setResults] = useState<SendResult[]>([])
  const [activeTemplate, setActiveTemplate] = useState<"attorneyshare" | "exolar">("attorneyshare")

  const currentUsers = activeTemplate === "attorneyshare" ? ATTORNEYSHARE_USERS : EXOLAR_DEMO_USERS

  const handleSelectAll = () => {
    if (selectedUsers.size === currentUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(currentUsers.map((u) => u.email)))
    }
  }

  const handleToggleUser = (email: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(email)) {
      newSelected.delete(email)
    } else {
      newSelected.add(email)
    }
    setSelectedUsers(newSelected)
  }

  const handleSendEmails = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Please select at least one user")
      return
    }

    setIsSending(true)
    setResults([])

    try {
      const usersToSend = currentUsers.filter((u) => selectedUsers.has(u.email))

      const response = await fetch("/api/admin/send-credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          users: usersToSend,
          template: activeTemplate,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send emails")
      }

      const data = await response.json()
      setResults(data.details)

      // Show summary toast
      if (data.sent > 0 && data.failed === 0) {
        toast.success(`Successfully sent ${data.sent} email${data.sent > 1 ? "s" : ""}!`)
      } else if (data.sent > 0 && data.failed > 0) {
        toast.warning(`Sent ${data.sent} emails, ${data.failed} failed`)
      } else {
        toast.error(`Failed to send all emails`)
      }

      // Clear selection after sending
      setSelectedUsers(new Set())
    } catch (error) {
      console.error("Send emails error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to send emails")
    } finally {
      setIsSending(false)
    }
  }

  const selectedCount = selectedUsers.size
  const sentCount = results.filter((r) => r.status === "sent").length
  const failedCount = results.filter((r) => r.status === "failed").length

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1
          className="text-3xl font-bold mb-2"
          style={{
            background: "linear-gradient(90deg, #22d3ee 0%, #06b6d4 30%, #f97316 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >Send Credentials</h1>
        <p className="text-muted-foreground">
          Bulk email credentials to team members. Select users and choose the appropriate email template.
        </p>
      </div>

      <Tabs value={activeTemplate} onValueChange={(v) => setActiveTemplate(v as "attorneyshare" | "exolar")}>
        <TabsList className="mb-6">
          <TabsTrigger value="attorneyshare">
            AttorneyShare Internal ({ATTORNEYSHARE_USERS.length} users)
          </TabsTrigger>
          <TabsTrigger value="exolar">Exolar Product ({EXOLAR_DEMO_USERS.length} users)</TabsTrigger>
        </TabsList>

        <TabsContent value="attorneyshare">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                AttorneyShare Team Members
              </CardTitle>
              <CardDescription>
                Internal team access to AttorneyShare E2E Test Dashboard. These users will receive the AttorneyShare-branded
                welcome email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserSelectionTable
                users={currentUsers}
                selectedUsers={selectedUsers}
                results={results}
                onSelectAll={handleSelectAll}
                onToggleUser={handleToggleUser}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exolar">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Exolar Product Users
              </CardTitle>
              <CardDescription>
                External customers using Exolar Testing Dashboard as a product. These users will receive the Exolar-branded
                welcome email with product features.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserSelectionTable
                users={currentUsers}
                selectedUsers={selectedUsers}
                results={results}
                onSelectAll={handleSelectAll}
                onToggleUser={handleToggleUser}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Bar */}
      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                <strong>{selectedCount}</strong> user{selectedCount !== 1 ? "s" : ""} selected
              </div>
              {results.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {sentCount} sent
                  </div>
                  {failedCount > 0 && (
                    <div className="flex items-center gap-1 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      {failedCount} failed
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button onClick={handleSendEmails} disabled={selectedCount === 0 || isSending} size="lg">
              {isSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send {selectedCount > 0 ? `to ${selectedCount} user${selectedCount > 1 ? "s" : ""}` : "Emails"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UserSelectionTable({
  users,
  selectedUsers,
  results,
  onSelectAll,
  onToggleUser,
}: {
  users: User[]
  selectedUsers: Set<string>
  results: SendResult[]
  onSelectAll: () => void
  onToggleUser: (email: string) => void
}) {
  const allSelected = selectedUsers.size === users.length && users.length > 0

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox checked={allSelected} onCheckedChange={onSelectAll} />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="w-32">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const isSelected = selectedUsers.has(user.email)
            const result = results.find((r) => r.email === user.email)

            return (
              <TableRow key={user.email} className={isSelected ? "bg-muted/50" : ""}>
                <TableCell>
                  <Checkbox checked={isSelected} onCheckedChange={() => onToggleUser(user.email)} />
                </TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
                </TableCell>
                <TableCell>
                  {result ? (
                    result.status === "sent" ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        Sent
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="h-4 w-4" />
                        Failed
                      </div>
                    )
                  ) : null}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

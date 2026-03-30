"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, ChevronRight, Key } from "lucide-react"
import { EmbeddingStatusCard } from "@/components/settings/embedding-status-card"

export default function SettingsPage() {
  const router = useRouter()
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
          <>
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
            <Link href="/settings/api-keys">
              <Card className="glass-card glass-card-glow hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Key className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">API Keys</CardTitle>
                        <CardDescription>
                          Manage API keys for CI/CD integration
                        </CardDescription>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </>
        )}

        {/* AI Embeddings Status - Only shown to admins */}
        <EmbeddingStatusCard />
      </div>
    </div>
  )
}

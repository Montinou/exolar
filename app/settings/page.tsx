"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronRight, Key, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PageContainer,
  PageHeader,
  PageSection,
  Surface,
} from "@/components/shell"
import { EmbeddingStatusCard } from "@/components/settings/embedding-status-card"

export default function SettingsPage() {
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
        // Not org admin — that's fine, the section just stays hidden.
      }
    }
    checkOrgAdmin()
  }, [])

  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow="Settings"
        title="Account and workspace"
        lede={
          orgName
            ? `You're managing ${orgName}. Keys, members, and AI embeddings live here.`
            : "Account-level configuration. Team and API keys appear once you're an org admin."
        }
        actions={
          <Button variant="ghost" size="icon" asChild aria-label="Back to dashboard">
            <Link href="/dashboard">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        }
      />

      {isOrgAdmin && (
        <PageSection eyebrow="Workspace">
          <div className="grid gap-3">
            <SettingsLink
              href="/settings/team"
              icon={<Users className="size-4" />}
              title="Team management"
              description={`Members and invitations${orgName ? ` for ${orgName}` : ""}`}
            />
            <SettingsLink
              href="/settings/api-keys"
              icon={<Key className="size-4" />}
              title="API keys"
              description="CI/CD ingestion + MCP tokens"
            />
          </div>
        </PageSection>
      )}

      <PageSection eyebrow="AI">
        <EmbeddingStatusCard />
      </PageSection>
    </PageContainer>
  )
}

function SettingsLink({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className="group block transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--exolar-cyan)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Surface
        className="flex items-center justify-between gap-4 transition-colors group-hover:border-[var(--exolar-cyan)]/40"
        padding="default"
      >
        <div className="flex items-center gap-4">
          <span className="flex size-9 items-center justify-center rounded-md border border-border/60 bg-background/60 text-[var(--exolar-cyan)]">
            {icon}
          </span>
          <div>
            <p className="text-base font-medium tracking-tight">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Surface>
    </Link>
  )
}

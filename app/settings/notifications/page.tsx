"use client"

import { useState, useEffect, useCallback } from "react"
import { AnimatedLogo } from "@/components/ui/animated-logo"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Mail,
  MessageSquare,
  Bell,
  ArrowLeft,
  Save,
  TestTube,
  Clock,
  AlertTriangle,
  Check,
  X,
} from "lucide-react"
import Link from "next/link"

interface NotificationConfig {
  emailEnabled: boolean
  emailRecipients: string[]
  emailOnCriticalFailure: boolean
  emailDigestSchedule: "daily" | "weekly" | "none" | null
  emailDigestHour: number
  slackEnabled: boolean
  slackWebhookUrl: string | null
  slackOnCriticalFailure: boolean
  slackOnExecutionComplete: boolean
  slackMentionOnCritical: "@here" | "@channel" | "none" | null
  relevanceThreshold: number
  failureCountThreshold: number
  quietHoursEnabled: boolean
  quietHoursStart: number | null
  quietHoursEnd: number | null
}

const DEFAULT_CONFIG: NotificationConfig = {
  emailEnabled: false,
  emailRecipients: [],
  emailOnCriticalFailure: true,
  emailDigestSchedule: null,
  emailDigestHour: 9,
  slackEnabled: false,
  slackWebhookUrl: null,
  slackOnCriticalFailure: true,
  slackOnExecutionComplete: false,
  slackMentionOnCritical: "none",
  relevanceThreshold: 80,
  failureCountThreshold: 1,
  quietHoursEnabled: false,
  quietHoursStart: null,
  quietHoursEnd: null,
}

export default function NotificationSettingsPage() {
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Email input state
  const [newEmail, setNewEmail] = useState("")
  const [slackWebhookInput, setSlackWebhookInput] = useState("")

  // Slack test state
  const [testingSlack, setTestingSlack] = useState(false)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/notifications/settings")

      if (response.status === 403) {
        setIsAdmin(false)
        setError("Admin access required to manage notifications")
        return
      }

      if (!response.ok) {
        throw new Error("Failed to load notification settings")
      }

      setIsAdmin(true)
      const data = await response.json()
      setConfig(data)
      setSlackWebhookInput(data.slackWebhookUrl || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const saveConfig = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(null)

      const response = await fetch("/api/notifications/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          slackWebhookUrl:
            slackWebhookInput && slackWebhookInput !== "https://hooks.slack.com/***"
              ? slackWebhookInput
              : config.slackWebhookUrl,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save settings")
      }

      const data = await response.json()
      setConfig(data)
      setSlackWebhookInput(data.slackWebhookUrl || "")
      setSuccess("Settings saved successfully")

      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setSaving(false)
    }
  }

  const testSlackWebhook = async () => {
    if (!slackWebhookInput || slackWebhookInput === "https://hooks.slack.com/***") {
      setError("Please enter a valid Slack webhook URL")
      return
    }

    try {
      setTestingSlack(true)
      setError(null)

      const response = await fetch("/api/notifications/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_slack",
          webhookUrl: slackWebhookInput,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Test failed")
      }

      setSuccess("Test message sent to Slack successfully!")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed")
    } finally {
      setTestingSlack(false)
    }
  }

  const addEmail = () => {
    const email = newEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address")
      return
    }
    if (config.emailRecipients.includes(email)) {
      setError("Email already added")
      return
    }
    setConfig({
      ...config,
      emailRecipients: [...config.emailRecipients, email],
    })
    setNewEmail("")
    setError(null)
  }

  const removeEmail = (email: string) => {
    setConfig({
      ...config,
      emailRecipients: config.emailRecipients.filter((e) => e !== email),
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <AnimatedLogo />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
            <p className="text-lg text-muted-foreground">Admin access required</p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your organization admin to manage notification settings.
            </p>
            <Button asChild className="mt-4">
              <Link href="/settings">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notification Settings
          </h1>
          <p className="text-muted-foreground">
            Configure email and Slack notifications for test failures
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
          <X className="h-4 w-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2 text-green-600">
          <Check className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Email Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                <CardTitle>Email Notifications</CardTitle>
              </div>
              <Switch
                checked={config.emailEnabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, emailEnabled: checked })
                }
              />
            </div>
            <CardDescription>
              Receive email alerts for critical test failures and daily/weekly digests
            </CardDescription>
          </CardHeader>
          {config.emailEnabled && (
            <CardContent className="space-y-6">
              {/* Recipients */}
              <div className="space-y-2">
                <Label>Email Recipients</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addEmail()}
                  />
                  <Button onClick={addEmail}>Add</Button>
                </div>
                {config.emailRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {config.emailRecipients.map((email) => (
                      <Badge key={email} variant="secondary" className="gap-1">
                        {email}
                        <button
                          onClick={() => removeEmail(email)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Critical Failure Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Critical Failure Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Immediate email when high-relevance tests fail
                  </p>
                </div>
                <Switch
                  checked={config.emailOnCriticalFailure}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, emailOnCriticalFailure: checked })
                  }
                />
              </div>

              {/* Digest Schedule */}
              <div className="space-y-2">
                <Label>Digest Schedule</Label>
                <div className="flex gap-4">
                  <Select
                    value={config.emailDigestSchedule || "none"}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        emailDigestSchedule: value === "none" ? null : (value as "daily" | "weekly"),
                      })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No digest</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                    </SelectContent>
                  </Select>
                  {config.emailDigestSchedule && (
                    <Select
                      value={String(config.emailDigestHour)}
                      onValueChange={(value) =>
                        setConfig({ ...config, emailDigestHour: parseInt(value) })
                      }
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Hour (UTC)" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {String(i).padStart(2, "0")}:00 UTC
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Slack Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-500" />
                <CardTitle>Slack Notifications</CardTitle>
              </div>
              <Switch
                checked={config.slackEnabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, slackEnabled: checked })
                }
              />
            </div>
            <CardDescription>
              Send notifications to a Slack channel via webhook
            </CardDescription>
          </CardHeader>
          {config.slackEnabled && (
            <CardContent className="space-y-6">
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookInput}
                    onChange={(e) => setSlackWebhookInput(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={testSlackWebhook}
                    disabled={testingSlack}
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    {testingSlack ? "Testing..." : "Test"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Create an{" "}
                  <a
                    href="https://api.slack.com/messaging/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Incoming Webhook
                  </a>{" "}
                  in your Slack workspace
                </p>
              </div>

              {/* Critical Failure Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Critical Failure Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Post when high-relevance tests fail
                  </p>
                </div>
                <Switch
                  checked={config.slackOnCriticalFailure}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, slackOnCriticalFailure: checked })
                  }
                />
              </div>

              {/* Execution Complete */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Execution Complete</Label>
                  <p className="text-sm text-muted-foreground">
                    Post a summary when test execution finishes
                  </p>
                </div>
                <Switch
                  checked={config.slackOnExecutionComplete}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, slackOnExecutionComplete: checked })
                  }
                />
              </div>

              {/* Mention on Critical */}
              {config.slackOnCriticalFailure && (
                <div className="space-y-2">
                  <Label>Mention on Critical Failures</Label>
                  <Select
                    value={config.slackMentionOnCritical || "none"}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        slackMentionOnCritical: value as "@here" | "@channel" | "none",
                      })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select mention" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mention</SelectItem>
                      <SelectItem value="@here">@here</SelectItem>
                      <SelectItem value="@channel">@channel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Alert Thresholds
            </CardTitle>
            <CardDescription>
              Configure when critical failure alerts are triggered
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Relevance Threshold */}
            <div className="space-y-2">
              <Label>Minimum Relevance Score</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={config.relevanceThreshold}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      relevanceThreshold: parseInt(e.target.value) || 80,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  Only notify for tests with relevance score {">="} {config.relevanceThreshold}
                </span>
              </div>
            </div>

            {/* Failure Count Threshold */}
            <div className="space-y-2">
              <Label>Minimum Failures</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={config.failureCountThreshold}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      failureCountThreshold: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  Only notify if {">="} {config.failureCountThreshold} high-relevance test(s) fail
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-500" />
                <CardTitle>Quiet Hours</CardTitle>
              </div>
              <Switch
                checked={config.quietHoursEnabled}
                onCheckedChange={(checked) =>
                  setConfig({ ...config, quietHoursEnabled: checked })
                }
              />
            </div>
            <CardDescription>
              Suppress notifications during specified hours (UTC)
            </CardDescription>
          </CardHeader>
          {config.quietHoursEnabled && (
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <Label>Start</Label>
                  <Select
                    value={String(config.quietHoursStart ?? 22)}
                    onValueChange={(value) =>
                      setConfig({ ...config, quietHoursStart: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-muted-foreground mt-6">to</span>
                <div className="space-y-1">
                  <Label>End</Label>
                  <Select
                    value={String(config.quietHoursEnd ?? 7)}
                    onValueChange={(value) =>
                      setConfig({ ...config, quietHoursEnd: parseInt(value) })
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground ml-4 mt-6">UTC</span>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={saveConfig} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}

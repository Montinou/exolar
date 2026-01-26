-- 027_add_notifications.sql
-- Notification System for Critical Failures and Digests
-- Supports Email (Resend) and Slack webhook notifications

-- ============================================
-- Notification Configuration Table
-- ============================================

CREATE TABLE IF NOT EXISTS notification_configs (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

  -- Email Configuration (Resend)
  email_enabled BOOLEAN DEFAULT false,
  email_recipients TEXT[] DEFAULT '{}',
  email_on_critical_failure BOOLEAN DEFAULT true,
  email_digest_schedule TEXT CHECK (email_digest_schedule IN ('daily', 'weekly', 'none')),
  email_digest_hour INTEGER DEFAULT 9 CHECK (email_digest_hour >= 0 AND email_digest_hour < 24),

  -- Slack Configuration
  slack_enabled BOOLEAN DEFAULT false,
  slack_webhook_url TEXT,
  slack_on_critical_failure BOOLEAN DEFAULT true,
  slack_on_execution_complete BOOLEAN DEFAULT false,
  slack_mention_on_critical TEXT CHECK (slack_mention_on_critical IN ('@here', '@channel', 'none')),

  -- Thresholds
  relevance_threshold INTEGER DEFAULT 80 CHECK (relevance_threshold >= 0 AND relevance_threshold <= 100),
  failure_count_threshold INTEGER DEFAULT 1 CHECK (failure_count_threshold >= 1),

  -- Quiet hours (suppress notifications during certain hours, UTC)
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start INTEGER CHECK (quiet_hours_start >= 0 AND quiet_hours_start < 24),
  quiet_hours_end INTEGER CHECK (quiet_hours_end >= 0 AND quiet_hours_end < 24),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Notification History Table
-- ============================================

CREATE TABLE IF NOT EXISTS notification_history (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Notification details
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'critical_failure',    -- High relevance test failure
    'execution_complete',  -- Test execution completed
    'daily_digest',        -- Daily summary
    'weekly_digest'        -- Weekly summary
  )),

  -- Reference to what triggered it
  execution_id INTEGER REFERENCES test_executions(id) ON DELETE SET NULL,
  test_result_id INTEGER REFERENCES test_results(id) ON DELETE SET NULL,

  -- Notification content
  subject TEXT,
  preview TEXT,  -- Short preview for history display
  recipient_count INTEGER DEFAULT 1,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',     -- Queued
    'sent',        -- Successfully sent
    'failed',      -- Failed to send
    'suppressed'   -- Suppressed by quiet hours or rate limit
  )),
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- Notification Preferences per User (Optional)
-- ============================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES dashboard_users(id) ON DELETE CASCADE,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Per-user overrides
  email_enabled BOOLEAN DEFAULT true,
  slack_enabled BOOLEAN DEFAULT true,

  -- Filter by branch/suite (optional)
  branch_filters TEXT[] DEFAULT '{}',  -- Only notify for these branches (empty = all)
  suite_filters TEXT[] DEFAULT '{}',   -- Only notify for these suites (empty = all)

  UNIQUE(user_id, organization_id)
);

-- ============================================
-- Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notification_configs_org_id
  ON notification_configs(organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_history_org_id
  ON notification_history(organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_history_created_at
  ON notification_history(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_history_status
  ON notification_history(organization_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_history_trigger
  ON notification_history(organization_id, trigger_type);

CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user
  ON user_notification_preferences(user_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE notification_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Notification configs visible to org admins
CREATE POLICY "Admins can view notification configs" ON notification_configs
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = current_setting('app.current_user_id', true)::integer
      AND role IN ('owner', 'admin')
    )
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- Admins can modify notification configs
CREATE POLICY "Admins can modify notification configs" ON notification_configs
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = current_setting('app.current_user_id', true)::integer
      AND role IN ('owner', 'admin')
    )
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- Notification history visible to org members
CREATE POLICY "Members can view notification history" ON notification_history
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = current_setting('app.current_user_id', true)::integer
    )
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- Service accounts can modify notification history
CREATE POLICY "Service accounts can modify notification history" ON notification_history
  FOR ALL
  USING (
    current_setting('app.is_service_account', true)::boolean = true
  );

-- Users can view their own notification preferences
CREATE POLICY "Users can view own notification preferences" ON user_notification_preferences
  FOR SELECT
  USING (
    user_id = current_setting('app.current_user_id', true)::integer
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- Users can modify their own notification preferences
CREATE POLICY "Users can modify own notification preferences" ON user_notification_preferences
  FOR ALL
  USING (
    user_id = current_setting('app.current_user_id', true)::integer
    OR current_setting('app.is_service_account', true)::boolean = true
  );

-- ============================================
-- Trigger for updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_notification_configs_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_configs_updated_at
  BEFORE UPDATE ON notification_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_configs_timestamp();

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE notification_configs IS 'Organization-level notification settings for email and Slack';
COMMENT ON COLUMN notification_configs.email_recipients IS 'Array of email addresses to receive notifications';
COMMENT ON COLUMN notification_configs.slack_webhook_url IS 'Slack incoming webhook URL for the channel';
COMMENT ON COLUMN notification_configs.relevance_threshold IS 'Minimum relevance score (0-100) to trigger critical failure notifications';
COMMENT ON COLUMN notification_configs.email_digest_hour IS 'Hour (0-23 UTC) to send daily digests';
COMMENT ON TABLE notification_history IS 'Log of all sent notifications for auditing';
COMMENT ON TABLE user_notification_preferences IS 'Per-user notification preference overrides';

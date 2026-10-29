/*
# Lumora AI Chat, Support System, Badges & Advertiser Panel

## Summary
This migration adds the database infrastructure for:
1. AI chatbot with API key rotation and admin-controlled system prompts
2. Universal support/report system with human handover
3. Badge/achievement system with tiers
4. Self-service advertiser panel with campaign approval workflow

## New Tables
- chat_sessions: user chat sessions (AI chat + support tickets)
- chat_messages: messages within sessions (user/assistant/admin roles)
- badges: achievement definitions with tier thresholds
- user_badges: badge awards per user
- ad_campaigns: advertiser campaigns with budget and approval workflow
- app_settings extended with gemini_api_keys, ai_system_prompt, ai_active_key_index

## Security
- RLS on all tables, owner-scoped for user data, admin-readable for support
- Admins can read all chat sessions/messages for human handover
- Advertisers can CRUD own campaigns, admins can approve/reject any
- Badges public read, admin-only write; user_badges owner-scoped read
*/

-- Extend app_settings with AI config columns
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS gemini_api_keys jsonb DEFAULT '[]'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_system_prompt text DEFAULT 'You are Lumora AI, a friendly and helpful assistant for the Lumora IT micro-task earning platform. You help users with questions about tasks, earnings, referrals, and platform features. Always respond in the user''s language (Bengali or English). Be concise, friendly, and encouraging. If you don''t know something specific about a user''s account, suggest they check the relevant page or contact human support.';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_active_key_index int DEFAULT 0;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ai_fallback_enabled boolean DEFAULT true;

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'New Chat',
  status text NOT NULL DEFAULT 'active',
  is_support boolean NOT NULL DEFAULT false,
  subject text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON chat_sessions TO authenticated;
GRANT SELECT, UPDATE ON chat_sessions TO service_role;

DROP POLICY IF EXISTS "select_own_chat_sessions" ON chat_sessions;
CREATE POLICY "select_own_chat_sessions" ON chat_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_chat_sessions" ON chat_sessions;
CREATE POLICY "insert_own_chat_sessions" ON chat_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_chat_sessions" ON chat_sessions;
CREATE POLICY "update_own_chat_sessions" ON chat_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_select_all_chat_sessions" ON chat_sessions;
CREATE POLICY "admin_select_all_chat_sessions" ON chat_sessions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON chat_messages TO authenticated;
GRANT SELECT, INSERT ON chat_messages TO service_role;

DROP POLICY IF EXISTS "select_own_chat_messages" ON chat_messages;
CREATE POLICY "select_own_chat_messages" ON chat_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_chat_messages" ON chat_messages;
CREATE POLICY "insert_own_chat_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_sessions WHERE chat_sessions.id = chat_messages.session_id AND chat_sessions.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_select_all_chat_messages" ON chat_messages;
CREATE POLICY "admin_select_all_chat_messages" ON chat_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_chat_messages" ON chat_messages;
CREATE POLICY "admin_insert_chat_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Enable realtime on chat messages and sessions
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_sessions;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  icon text DEFAULT 'Award',
  tier text DEFAULT 'bronze',
  threshold_tasks int DEFAULT 0,
  threshold_coins int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON badges TO authenticated;
GRANT ALL ON badges TO service_role;

DROP POLICY IF EXISTS "authenticated_select_badges" ON badges;
CREATE POLICY "authenticated_select_badges" ON badges FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_manage_badges" ON badges;
CREATE POLICY "admin_manage_badges" ON badges FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- User badges junction table
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at timestamptz DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON user_badges TO authenticated;
GRANT ALL ON user_badges TO service_role;

DROP POLICY IF EXISTS "select_own_user_badges" ON user_badges;
CREATE POLICY "select_own_user_badges" ON user_badges FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_user_badges" ON user_badges;
CREATE POLICY "insert_own_user_badges" ON user_badges FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Ad campaigns table
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_url text NOT NULL,
  budget_coins int NOT NULL DEFAULT 100,
  spent_coins int NOT NULL DEFAULT 0,
  reward_per_view int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON ad_campaigns TO authenticated;
GRANT SELECT, UPDATE ON ad_campaigns TO service_role;

DROP POLICY IF EXISTS "select_own_ad_campaigns" ON ad_campaigns;
CREATE POLICY "select_own_ad_campaigns" ON ad_campaigns FOR SELECT
  TO authenticated USING (
    advertiser_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "insert_own_ad_campaigns" ON ad_campaigns;
CREATE POLICY "insert_own_ad_campaigns" ON ad_campaigns FOR INSERT
  TO authenticated WITH CHECK (advertiser_id = auth.uid());

DROP POLICY IF EXISTS "update_own_ad_campaigns" ON ad_campaigns;
CREATE POLICY "update_own_ad_campaigns" ON ad_campaigns FOR UPDATE
  TO authenticated USING (advertiser_id = auth.uid()) WITH CHECK (advertiser_id = auth.uid());

DROP POLICY IF EXISTS "admin_update_ad_campaigns" ON ad_campaigns;
CREATE POLICY "admin_update_ad_campaigns" ON ad_campaigns FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Add badges column to profiles for quick badge count
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS badge_count int DEFAULT 0;

-- Seed default badges
INSERT INTO badges (name, label, description, icon, tier, threshold_tasks, threshold_coins) VALUES
  ('first_task', 'First Step', 'Complete your first task', 'Footprints', 'bronze', 1, 0),
  ('task_master_10', 'Task Starter', 'Complete 10 tasks', 'TrendingUp', 'bronze', 10, 0),
  ('task_master_50', 'Task Pro', 'Complete 50 tasks', 'Zap', 'silver', 50, 500),
  ('task_master_100', 'Task Expert', 'Complete 100 tasks', 'Award', 'silver', 100, 1000),
  ('coin_collector', 'Coin Collector', 'Earn 1000 LM coins', 'Coins', 'gold', 0, 1000),
  ('streak_warrior', 'Streak Warrior', 'Maintain a 7-day streak', 'Flame', 'gold', 0, 0),
  ('legend', 'Lumora Legend', 'Complete 200 tasks and earn 5000 coins', 'Crown', 'platinum', 200, 5000)
ON CONFLICT (name) DO NOTHING;

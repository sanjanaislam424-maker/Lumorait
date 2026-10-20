/*
# Lumora IT — Core Schema

## Overview
Full schema for a micro-task completion & SMM platform with Lumora Coin currency.
Includes user profiles, tasks, submissions, wallet transactions, check-ins,
lucky spin, referrals, messaging, notifications, ID verification, and app settings.

## Currency
1 BDT = 100 Lumora Coins. Minimum deposit 10 BDT = 1000 coins.

## Tables
1. profiles — extends auth.users: role (user/admin), phone, coins, trust, streak, referral
2. id_verifications — NID/ID upload + admin approval
3. tasks — marketplace tasks (FB/IG/YT/review). Admin tasks have 0 cost + 2x reward badge
4. task_submissions — proof screenshots + notes, lifecycle pending/approved/rejected/challenged
5. transactions — deposits/withdrawals + coin movements
6. check_ins — daily streak
7. spin_history — lucky spin logs
8. messages — in-app chat between poster & doer
9. notifications — broadcast + personal notifications
10. settings — singleton app config (exchange rate, min deposit, spin rewards)

## Security
- RLS on every table.
- authenticated users read own data + public marketplace tasks.
- admin role (checked via profiles) can manage everything.
- 4 separate policies per table (select/insert/update/delete).
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  lumora_coins integer NOT NULL DEFAULT 0,
  trust_score numeric NOT NULL DEFAULT 5.0,
  streak_days integer NOT NULL DEFAULT 0,
  last_check_in date,
  referral_code text UNIQUE,
  referred_by uuid REFERENCES profiles(id),
  referral_earned integer NOT NULL DEFAULT 0,
  spin_used_today integer NOT NULL DEFAULT 0,
  spin_reset_date date,
  banned boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ ID VERIFICATIONS ============
CREATE TABLE IF NOT EXISTS id_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  id_type text NOT NULL DEFAULT 'nid',
  id_number text,
  document_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE id_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_idv" ON id_verifications;
CREATE POLICY "select_idv" ON id_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "insert_own_idv" ON id_verifications;
CREATE POLICY "insert_own_idv" ON id_verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_admin_idv" ON id_verifications;
CREATE POLICY "update_admin_idv" ON id_verifications FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ TASKS ============
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook','instagram','youtube','app_review','tiktok','other')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  target_url text,
  reward_coins integer NOT NULL DEFAULT 25,
  cost_coins integer NOT NULL DEFAULT 25,
  is_admin_task boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
  slots integer NOT NULL DEFAULT 1,
  filled integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tasks" ON tasks;
CREATE POLICY "select_tasks" ON tasks FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_tasks" ON tasks;
CREATE POLICY "insert_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);
DROP POLICY IF EXISTS "update_tasks" ON tasks;
CREATE POLICY "update_tasks" ON tasks FOR UPDATE
  TO authenticated USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "delete_tasks" ON tasks;
CREATE POLICY "delete_tasks" ON tasks FOR DELETE
  TO authenticated USING (auth.uid() = creator_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ TASK SUBMISSIONS ============
CREATE TABLE IF NOT EXISTS task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  doer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  proof_urls text[] NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','challenged')),
  doer_rating integer,
  poster_rating integer,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz
);
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_subs" ON task_submissions;
CREATE POLICY "select_subs" ON task_submissions FOR SELECT
  TO authenticated USING (auth.uid() = doer_id OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.creator_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "insert_own_subs" ON task_submissions;
CREATE POLICY "insert_own_subs" ON task_submissions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = doer_id);
DROP POLICY IF EXISTS "update_subs" ON task_submissions;
CREATE POLICY "update_subs" ON task_submissions FOR UPDATE
  TO authenticated USING (auth.uid() = doer_id OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = task_id AND t.creator_id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','task_spend','task_earn','referral','spin','checkin','bonus','penalty','admin_adjust')),
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  method text,
  note text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_tx" ON transactions;
CREATE POLICY "select_tx" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "insert_own_tx" ON transactions;
CREATE POLICY "insert_own_tx" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_admin_tx" ON transactions;
CREATE POLICY "update_admin_tx" ON transactions FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ CHECK INS ============
CREATE TABLE IF NOT EXISTS check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  reward integer NOT NULL,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, check_date)
);
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_checkin" ON check_ins;
CREATE POLICY "select_checkin" ON check_ins FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "insert_own_checkin" ON check_ins;
CREATE POLICY "insert_own_checkin" ON check_ins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ SPIN HISTORY ============
CREATE TABLE IF NOT EXISTS spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reward integer NOT NULL,
  label text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE spin_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_spin" ON spin_history;
CREATE POLICY "select_spin" ON spin_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_spin" ON spin_history;
CREATE POLICY "insert_own_spin" ON spin_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ MESSAGES ============
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_msgs" ON messages;
CREATE POLICY "select_msgs" ON messages FOR SELECT
  TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
DROP POLICY IF EXISTS "insert_own_msg" ON messages;
CREATE POLICY "insert_own_msg" ON messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "update_own_msg" ON messages;
CREATE POLICY "update_own_msg" ON messages FOR UPDATE
  TO authenticated USING (auth.uid() = receiver_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_broadcast boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_notif" ON notifications;
CREATE POLICY "select_notif" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_broadcast = true);
DROP POLICY IF EXISTS "insert_admin_notif" ON notifications;
CREATE POLICY "insert_admin_notif" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ SETTINGS (singleton) ============
CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  bdt_to_coin integer NOT NULL DEFAULT 100,
  min_deposit_bdt integer NOT NULL DEFAULT 10,
  spin_rewards text NOT NULL DEFAULT '[10,50,100,250,500,0]',
  free_spins_daily integer NOT NULL DEFAULT 2,
  checkin_rewards text NOT NULL DEFAULT '[50,100,150,200,300,400,1000]',
  referral_bonus integer NOT NULL DEFAULT 500,
  referee_bonus integer NOT NULL DEFAULT 200,
  referrer_deposit_pct integer NOT NULL DEFAULT 10,
  updated_at timestamptz DEFAULT now()
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_settings" ON app_settings;
CREATE POLICY "select_settings" ON app_settings FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "update_admin_settings" ON app_settings;
CREATE POLICY "update_admin_settings" ON app_settings FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_subs_task ON task_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_msgs_receiver ON messages(receiver_id);

-- 2026-06-14 RLS hardening migration
-- Adds RLS policies for sensitive tables (user_roles table already exists from older migration)

-- 1) Note: user_roles table already exists from migration 20260506035224
--    It uses app_role ENUM for the role column

-- 2) The has_role function is already created in the earlier migration
--    No need to recreate it here

-- List of tables to protect
-- Enable RLS on each
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payfast_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.agreement_payment_confirmations ENABLE ROW LEVEL SECURITY;

-- -----------------------------
-- profiles policies
-- -----------------------------
-- Allow users to SELECT their own profile row only
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to UPDATE their own row only
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Allow users to INSERT their own row only
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- -----------------------------
-- wallets policies
-- -----------------------------
-- Users can SELECT/UPDATE only their own wallets
DROP POLICY IF EXISTS "wallets_user_only" ON public.wallets;
CREATE POLICY "wallets_user_only" ON public.wallets
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- -----------------------------
-- payments policies
-- -----------------------------
-- Users can SELECT their own payments only
DROP POLICY IF EXISTS "payments_select_user" ON public.payments;
CREATE POLICY "payments_select_user" ON public.payments
  FOR SELECT USING (user_id = auth.uid());

-- Users can INSERT payments for themselves only
DROP POLICY IF EXISTS "payments_insert_user" ON public.payments;
CREATE POLICY "payments_insert_user" ON public.payments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE: blocked for non-admins
DROP POLICY IF EXISTS "payments_admin_modify" ON public.payments;
CREATE POLICY "payments_admin_modify" ON public.payments
  FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "payments_admin_delete" ON public.payments
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- -----------------------------
-- platform_revenue policies
-- -----------------------------
-- Only admins can read or modify platform revenue
DROP POLICY IF EXISTS "platform_revenue_admins" ON public.platform_revenue;
CREATE POLICY "platform_revenue_admins" ON public.platform_revenue
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- -----------------------------
-- payfast_webhook_events policies
-- -----------------------------
-- Admins can SELECT webhook events
DROP POLICY IF EXISTS "payfast_events_select_admin" ON public.payfast_webhook_events;
CREATE POLICY "payfast_events_select_admin" ON public.payfast_webhook_events
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Inserts should come only from service role (service role bypasses RLS); deny normal authenticated inserts
DROP POLICY IF EXISTS "payfast_events_insert_service" ON public.payfast_webhook_events;
CREATE POLICY "payfast_events_insert_service" ON public.payfast_webhook_events
  FOR INSERT WITH CHECK (false);

-- Updates/deletes only by admins
DROP POLICY IF EXISTS "payfast_events_modify_admin" ON public.payfast_webhook_events;
CREATE POLICY "payfast_events_modify_admin" ON public.payfast_webhook_events
  FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "payfast_events_delete_admin" ON public.payfast_webhook_events
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- -----------------------------
-- user_roles policies
-- -----------------------------
-- Users can read their own roles; admins can read all
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Inserts/updates/deletes only by admins
DROP POLICY IF EXISTS "user_roles_admin_modify" ON public.user_roles;
CREATE POLICY "user_roles_admin_modify" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- -----------------------------
-- groups policies
-- -----------------------------
-- Public can read groups
DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
CREATE POLICY "groups_select_public" ON public.groups
  FOR SELECT USING (true);

-- Authenticated users can create groups
DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
CREATE POLICY "groups_insert_auth" ON public.groups
  FOR INSERT WITH CHECK (auth.role() IS NOT NULL OR auth.uid() IS NOT NULL);

-- Update/delete by owner or admin
DROP POLICY IF EXISTS "groups_modify_owner_admin" ON public.groups;
CREATE POLICY "groups_modify_owner_admin" ON public.groups
  FOR UPDATE USING (creator_id = auth.uid() OR has_role(auth.uid(), 'admin')) WITH CHECK (creator_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "groups_delete_owner_admin" ON public.groups
  FOR DELETE USING (creator_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- -----------------------------
-- group_members policies
-- -----------------------------
-- Public can read group membership info
DROP POLICY IF EXISTS "group_members_select_public" ON public.group_members;
CREATE POLICY "group_members_select_public" ON public.group_members
  FOR SELECT USING (true);

-- Authenticated users can insert themselves as members
DROP POLICY IF EXISTS "group_members_insert_self" ON public.group_members;
CREATE POLICY "group_members_insert_self" ON public.group_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Delete: user can delete their own membership; group owner or admin can delete any
DROP POLICY IF EXISTS "group_members_delete" ON public.group_members;
CREATE POLICY "group_members_delete" ON public.group_members
  FOR DELETE USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND (g.creator_id = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- -----------------------------
-- meetups policies
-- -----------------------------
-- Public read
DROP POLICY IF EXISTS "meetups_select_public" ON public.meetups;
CREATE POLICY "meetups_select_public" ON public.meetups
  FOR SELECT USING (true);

-- Authenticated inserts
DROP POLICY IF EXISTS "meetups_insert_auth" ON public.meetups;
CREATE POLICY "meetups_insert_auth" ON public.meetups
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Update/delete by creator or admin
DROP POLICY IF EXISTS "meetups_modify_creator_admin" ON public.meetups;
CREATE POLICY "meetups_modify_creator_admin" ON public.meetups
  FOR UPDATE USING (host_id = auth.uid() OR has_role(auth.uid(), 'admin')) WITH CHECK (host_id = auth.uid() OR has_role(auth.uid(), 'admin'));
CREATE POLICY "meetups_delete_creator_admin" ON public.meetups
  FOR DELETE USING (host_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- -----------------------------
-- content_unlocks, subscriptions, agreement_payment_confirmations
-- -----------------------------
-- Users can SELECT/INSERT their own records only
DROP POLICY IF EXISTS "content_unlocks_user" ON public.content_unlocks;
CREATE POLICY "content_unlocks_user" ON public.content_unlocks
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "content_unlocks_insert_user" ON public.content_unlocks
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "content_unlocks_admin_modify" ON public.content_unlocks;
CREATE POLICY "content_unlocks_admin_modify" ON public.content_unlocks
  FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "content_unlocks_admin_delete" ON public.content_unlocks
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "subscriptions_user" ON public.subscriptions;
CREATE POLICY "subscriptions_user" ON public.subscriptions
  FOR SELECT USING (subscriber_id = auth.uid());
CREATE POLICY "subscriptions_insert_user" ON public.subscriptions
  FOR INSERT WITH CHECK (subscriber_id = auth.uid());
DROP POLICY IF EXISTS "subscriptions_admin_modify" ON public.subscriptions;
CREATE POLICY "subscriptions_admin_modify" ON public.subscriptions
  FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "subscriptions_admin_delete" ON public.subscriptions
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "agreement_payments_user" ON public.agreement_payment_confirmations;
CREATE POLICY "agreement_payments_user" ON public.agreement_payment_confirmations
  FOR SELECT USING (confirmed_by = auth.uid());
CREATE POLICY "agreement_payments_insert_user" ON public.agreement_payment_confirmations
  FOR INSERT WITH CHECK (confirmed_by = auth.uid());
DROP POLICY IF EXISTS "agreement_payments_admin_modify" ON public.agreement_payment_confirmations;
CREATE POLICY "agreement_payments_admin_modify" ON public.agreement_payment_confirmations
  FOR UPDATE USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "agreement_payments_admin_delete" ON public.agreement_payment_confirmations
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- End of migration

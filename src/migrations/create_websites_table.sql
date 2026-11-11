-- ==============================================================================
-- OUTLIERS MEDIA — WEBSITE-ONLY CLIENTS & WEBSITE PROJECTS SCHEMA
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hsiowbfngobhxyfekldl/sql/new

-- 1. Create websites table
CREATE TABLE IF NOT EXISTS public.websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT,
  business_name TEXT NOT NULL,
  website_type TEXT NOT NULL CHECK (
    website_type IN (
      'Portfolio',
      'Business site',
      'Menu or ordering site',
      'Landing page',
      'Other'
    )
  ),
  description TEXT NOT NULL,
  reference_links TEXT,
  preferred_deadline DATE,
  budget NUMERIC,
  agreed_amount NUMERIC,
  contact_number TEXT,
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (
    status IN ('Requested', 'In Progress', 'Delivered', 'Cancelled')
  ),
  live_url TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Indexes & duplicate open-request guard
CREATE INDEX IF NOT EXISTS idx_websites_client_id ON public.websites(client_id);
CREATE INDEX IF NOT EXISTS idx_websites_status ON public.websites(status);
CREATE INDEX IF NOT EXISTS idx_websites_created_at ON public.websites(created_at DESC);

-- Prevent a client from having more than one open ('Requested' / 'In Progress') website request
CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_one_open_per_client
ON public.websites(client_id)
WHERE status IN ('Requested', 'In Progress');

-- 3. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.set_websites_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_websites_updated_at ON public.websites;
CREATE TRIGGER trg_websites_updated_at
BEFORE UPDATE ON public.websites
FOR EACH ROW
EXECUTE FUNCTION public.set_websites_updated_at();

-- 4. Admin identity helper aligned with Outliers Media AuthContext
CREATE OR REPLACE FUNCTION public.is_outliers_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    lower(coalesce(auth.jwt() ->> 'email', '')) IN (
      'dhimanpashvinder@gmail.com',
      'outliersmedia22@gmail.com'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND lower(coalesce(p.role, '')) = 'admin'
    );
$$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;

-- Clients can read ONLY their own website requests; Admin can read all
DROP POLICY IF EXISTS "Clients can read own website requests" ON public.websites;
CREATE POLICY "Clients can read own website requests"
ON public.websites FOR SELECT
USING (
  client_id = auth.uid()
  OR public.is_outliers_admin()
);

-- Clients can create ONLY their own website requests in initial Requested state
-- (only admin can set agreed_amount, status != Requested, live_url, or delivered_at)
DROP POLICY IF EXISTS "Clients can create own website requests" ON public.websites;
CREATE POLICY "Clients can create own website requests"
ON public.websites FOR INSERT
WITH CHECK (
  public.is_outliers_admin()
  OR (
    client_id = auth.uid()
    AND status = 'Requested'
    AND agreed_amount IS NULL
    AND live_url IS NULL
    AND delivered_at IS NULL
  )
);

-- ONLY admin can update status, agreed_amount, live_url, order_id, and delivered_at
DROP POLICY IF EXISTS "Only admins can update website requests" ON public.websites;
CREATE POLICY "Only admins can update website requests"
ON public.websites FOR UPDATE
USING (public.is_outliers_admin())
WITH CHECK (public.is_outliers_admin());

-- ONLY admin can delete website requests
DROP POLICY IF EXISTS "Only admins can delete website requests" ON public.websites;
CREATE POLICY "Only admins can delete website requests"
ON public.websites FOR DELETE
USING (public.is_outliers_admin());

-- 6. Live derived client_type view (Website only / Social media only / Both)
-- Derived dynamically from websites + social media orders so it never goes out of sync
CREATE OR REPLACE VIEW public.client_types_view AS
SELECT
  p.auth_id AS client_id,
  CASE
    WHEN has_social AND has_website THEN 'Both'
    WHEN has_website AND NOT has_social THEN 'Website only'
    WHEN has_social AND NOT has_website THEN 'Social media only'
    ELSE NULL
  END AS client_type
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.client_id = p.auth_id
        AND o.status IN ('active', 'paused', 'pending')
        AND coalesce(o.plan_name, '') <> 'Website'
        AND coalesce(o.order_id, '') NOT LIKE 'WEB-%'
        AND coalesce(o.schedule_config ->> 'project_category', '') <> 'website'
    ) AS has_social,
    EXISTS (
      SELECT 1
      FROM public.websites w
      WHERE w.client_id = p.auth_id
        AND w.status <> 'Cancelled'
    ) AS has_website
) flags ON TRUE;

-- ==============================================================================
-- OUTLIERS MEDIA — CLIENT BILLING CYCLES & RENEWALS SCHEMA
-- ==============================================================================
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hsiowbfngobhxyfekldl/sql/new

CREATE TABLE IF NOT EXISTS public.billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  order_id TEXT,
  cycle_number INT NOT NULL DEFAULT 1,
  package TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  delivery_start_date DATE NOT NULL,
  delivery_end_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending' | 'Paid'
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_billing_cycles_client_id ON public.billing_cycles(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_order_id ON public.billing_cycles(order_id);
CREATE INDEX IF NOT EXISTS idx_billing_cycles_delivery_end ON public.billing_cycles(delivery_end_date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.billing_cycles ENABLE ROW LEVEL SECURITY;

-- 1. Clients can view their own billing cycles
DROP POLICY IF EXISTS "Clients can view own billing cycles" ON public.billing_cycles;
CREATE POLICY "Clients can view own billing cycles"
ON public.billing_cycles FOR SELECT
USING (
  client_id = auth.uid()
  OR client_id IN (SELECT auth_id FROM public.profiles WHERE auth_id = auth.uid())
);

-- 2. Admins have full access to create, read, update, delete
DROP POLICY IF EXISTS "Admins full access billing cycles" ON public.billing_cycles;
CREATE POLICY "Admins full access billing cycles"
ON public.billing_cycles FOR ALL
USING (true)
WITH CHECK (true);

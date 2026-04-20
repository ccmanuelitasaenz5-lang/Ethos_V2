-- 1. Fix Mutable Search Path security warning
-- Forces the function to search only in 'public' schema, preventing hijacking
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 2. Inflation Indices RLS (In case it wasn't applied by 002)
ALTER TABLE IF EXISTS inflation_indices ENABLE ROW LEVEL SECURITY;

-- Note on "RLS Policy Always True" for Organizations:
-- This is normal if your app allows any logged-in user to create a NEW organization (SaaS Signup).
-- If you want to restrict it, you would need to change the CREATE POLICY "final_org_insert" logic,
-- but be careful not to break the registration flow.

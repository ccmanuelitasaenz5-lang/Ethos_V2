-- ETHOS v2.0 - Migration 007: Generated Reports Storage
-- Stores immutable snapshots of reports generated during monthly closings

-- 1. Create generated_reports table
CREATE TABLE IF NOT EXISTS public.generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_id UUID NOT NULL REFERENCES public.monthly_closings(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL CHECK (report_type IN ('journal', 'ledger', 'expense', 'property-statement', 'balance', 'income-statement')),
    file_path TEXT NOT NULL, -- Path in Supabase Storage (e.g., 'closings/org-id/2024-01/journal.pdf')
    file_name TEXT NOT NULL, -- Original filename for downloads
    file_size BIGINT, -- Size in bytes
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional info (page count, generation time, etc.)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(closing_id, report_type) -- One report of each type per closing
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_generated_reports_closing ON public.generated_reports(closing_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_org ON public.generated_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_type ON public.generated_reports(report_type);

-- 3. Enable RLS
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Users can view reports from their organization
DROP POLICY IF EXISTS generated_reports_view_org ON public.generated_reports;
CREATE POLICY generated_reports_view_org ON public.generated_reports
    FOR SELECT USING (organization_id = get_auth_organization());

-- Only system/admins can insert reports (done via server actions)
DROP POLICY IF EXISTS generated_reports_insert_admin ON public.generated_reports;
CREATE POLICY generated_reports_insert_admin ON public.generated_reports
    FOR INSERT WITH CHECK (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

-- Admins can delete reports (for cleanup or regeneration)
DROP POLICY IF EXISTS generated_reports_delete_admin ON public.generated_reports;
CREATE POLICY generated_reports_delete_admin ON public.generated_reports
    FOR DELETE USING (organization_id = get_auth_organization() AND get_auth_role() = 'admin');

-- 5. Trigger for updated_at (if we add it later)
-- Note: This table is mostly insert-only, but we keep the pattern consistent
CREATE OR REPLACE FUNCTION update_generated_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = OLD.created_at; -- Prevent created_at from being modified
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Add helpful comment
COMMENT ON TABLE public.generated_reports IS 'Stores immutable PDF snapshots of reports generated during monthly closings. These files are stored in Supabase Storage and serve as historical records.';
COMMENT ON COLUMN public.generated_reports.file_path IS 'Relative path in Supabase Storage bucket (e.g., closings/org-uuid/2024-01/journal.pdf)';
COMMENT ON COLUMN public.generated_reports.metadata IS 'Additional metadata: {pageCount: 5, generationTimeMs: 1234, reportVersion: "1.0"}';

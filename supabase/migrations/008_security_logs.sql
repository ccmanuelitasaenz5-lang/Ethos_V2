-- ETHOS v2.0 - Migration 006: Security Logs & Rate Limiting Support

-- 1. Create security_logs table
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    event_type TEXT NOT NULL, -- 'login_attempt', 'signup_attempt', 'critical_action'
    status TEXT NOT NULL, -- 'success', 'failure'
    ip_address TEXT,
    user_email TEXT, -- Store email for login attempts where ID is unknown
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 2. Enable RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Only admins can view logs
DROP POLICY IF EXISTS security_logs_view_admin ON public.security_logs;
CREATE POLICY security_logs_view_admin ON public.security_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 4. Function to check rate limit (Simple DB-based implementation)
-- Returns true if request should be blocked
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip_address TEXT,
    p_event_type TEXT,
    p_window_minutes INTEGER,
    p_max_attempts INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    attempt_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO attempt_count
    FROM public.security_logs
    WHERE ip_address = p_ip_address
    AND event_type = p_event_type
    AND status = 'failure' -- Only count failures for blocking usually, or all attempts for strict limiting
    AND created_at > (NOW() - (p_window_minutes || ' minutes')::INTERVAL);

    RETURN attempt_count >= p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

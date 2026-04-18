import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type SecurityEventType = 
    | 'login_attempt' 
    | 'signup_attempt' 
    | 'critical_action' 
    | 'password_reset'
    | 'income_creation'
    | 'expense_creation'
    | 'org_creation'

/**
 * Logs a security event to the database.
 * Use this to track failed logins, sensitive actions, etc.
 */
export async function logSecurityEvent(
    eventType: SecurityEventType,
    status: 'success' | 'failure',
    details: {
        email?: string
        userId?: string
        metadata?: Record<string, any>
    }
) {
    try {
        const supabase = await createClient()

        // Get IP address from headers
        const headersList = await headers()
        // x-forwarded-for can be comma separated, take the first one
        const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown'

        const { error } = await supabase.from('security_logs').insert({
            event_type: eventType,
            status,
            ip_address: ip,
            user_email: details.email,
            user_id: details.userId,
            metadata: details.metadata || {}
        })

        if (error) {
            // Error code PGRST205 indicates table is missing
            if (error.code === 'PGRST205') {
                console.warn('Security logging skipped: public.security_logs table not found in DB.')
            } else {
                console.error('Error writing security log:', error)
            }
        }
    } catch (error) {
        // Fail silently to not block main flow, but log to console
        console.error('Failed to log security event:', error)
    }
}

/**
 * Checks if the current IP has exceeded the rate limit for a specific action.
 * Returns true if the request should be BLOCKED.
 *
 * @param eventType The type of event to check (e.g. 'login_attempt')
 * @param maxAttempts Max number of FAILURE attempts allowed
 * @param windowMinutes Time window in minutes
 */
export async function isRateLimited(
    eventType: SecurityEventType,
    maxAttempts: number = 5,
    windowMinutes: number = 15
): Promise<boolean> {
    try {
        const supabase = await createClient()
        const headersList = await headers()
        const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'localhost'

        // Call the database function defined in migration 008
        // Note: Using defensive call in case function is missing (PGRST202)
        const { data, error } = await supabase.rpc('check_rate_limit', {
            p_ip_address: ip,
            p_event_type: eventType,
            p_window_minutes: windowMinutes,
            p_max_attempts: maxAttempts
        })

        if (error) {
            // Error code PGRST202 means the function is missing in the DB
            if (error.code === 'PGRST202') {
                console.warn('Rate limit check skipped: public.check_rate_limit function not found in DB.')
            } else {
                console.error('Rate limit DB check failed:', error)
            }
            return false // Fail open (allow request) if DB check fails
        }

        return !!data
    } catch (error) {
        console.error('Rate limit check error:', error)
        return false // Fail open
    }
}

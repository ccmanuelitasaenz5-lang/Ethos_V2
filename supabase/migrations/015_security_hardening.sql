-- Migration to address Technical Audit Finding 3.3 (API Key in Plain Text)
-- This migration enables pgcrypto for encription/decription
-- AND addresses Finding 4.1 (RLS Hardening)

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Hardening RLS Policies: Adding WITH CHECK to existing FOR ALL policies
-- This ensures that only authorized users can INSERT/UPDATE data

-- Assets
DROP POLICY IF EXISTS "Admins can manage assets" ON assets;
CREATE POLICY "Admins can manage assets"
  ON assets FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- Documents
DROP POLICY IF EXISTS "Admins can manage documents" ON documents;
CREATE POLICY "Admins can manage documents"
  ON documents FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

-- Journal Entries
DROP POLICY IF EXISTS "Admins can manage journal entries" ON journal_entries;
CREATE POLICY "Admins can manage journal entries"
  ON journal_entries FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users 
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

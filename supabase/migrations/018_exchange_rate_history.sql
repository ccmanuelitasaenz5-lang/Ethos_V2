CREATE TABLE IF NOT EXISTS exchange_rates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date        DATE NOT NULL UNIQUE,   -- Una tasa por día
  rate_usd_ves DECIMAL(12,4) NOT NULL,
  source      TEXT DEFAULT 'BCV',
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);
 
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
 
-- Cualquier usuario autenticado puede leer tasas
CREATE POLICY "Authenticated users can read rates"
  ON exchange_rates FOR SELECT
  TO authenticated USING (true);
 
CREATE INDEX idx_exchange_rates_date ON exchange_rates(date DESC);

-- Migración: Añadir soporte multimoneda (USD/VES) a journal_entries
-- Objetivo: Permitir el registro manual de montos en Bolívares y la tasa de cambio para control de variación.

ALTER TABLE public.journal_entries 
ADD COLUMN IF NOT EXISTS debit_ves DECIMAL(19, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_ves DECIMAL(19, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(19, 4);

-- Comentario para documentación
COMMENT ON COLUMN public.journal_entries.debit_ves IS 'Monto del débito en Bolívares (VES)';
COMMENT ON COLUMN public.journal_entries.credit_ves IS 'Monto del crédito en Bolívares (VES)';
COMMENT ON COLUMN public.journal_entries.exchange_rate IS 'Tasa de cambio aplicada al momento del asiento';

-- (Opcional) Poblar datos existentes asumiendo tasa 1 si es necesario, 
-- pero dado que es una transición, los nuevos asientos llenarán esto.

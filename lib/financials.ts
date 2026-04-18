/**
 * Utilidad para centralizar todos los cálculos financieros de ETHOS.
 * Garantiza consistencia en IVA, IGTF y bimonetarización.
 */
export interface FinancialOptions {
  ivaPercentage?: number;
  igtfApply?: boolean;
}

export function calculateFinancials(
  subtotal: number,
  exchangeRate: number,
  options: FinancialOptions = {}
) {
  const { ivaPercentage = 16, igtfApply = false } = options;

  // 1. IVA y Totales en USD
  const ivaAmountUSD = subtotal * (ivaPercentage / 100);
  const totalUSD = subtotal + ivaAmountUSD;

  // 2. Conversión base a VES
  const subtotalVES = subtotal * exchangeRate;
  const ivaAmountVES = ivaAmountUSD * exchangeRate;
  const totalVES_base = totalUSD * exchangeRate;

  // 3. IGTF (Aplica sobre el total pagado en USD pero se registra en VES si corresponde)
  const igtfAmountVES = igtfApply ? totalVES_base * 0.03 : 0;
  const totalVES = totalVES_base + igtfAmountVES;

  return {
    subtotalUSD: subtotal,
    ivaAmountUSD,
    totalUSD,
    subtotalVES,
    ivaAmountVES,
    igtfAmountVES,
    totalVES,
    exchangeRate
  };
}

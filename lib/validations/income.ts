import { z } from 'zod'
 
export const incomeSchema = z.object({
  date: z.string().min(1, 'La fecha es requerida'),
 
  receipt_number: z.string().optional().nullable(),
  control_number: z.string().optional().nullable(),
 
  concept: z.string()
    .min(3, 'El concepto debe tener al menos 3 caracteres'),
 
  amount_usd: z.coerce
    .number()
    .positive('El monto debe ser mayor a 0'),
 
  exchange_rate: z.coerce
    .number()
    .positive('La tasa debe ser mayor a 0'),
 
  payment_method: z.enum([
    'efectivo','transferencia','pago_movil','cheque','tarjeta'
  ]),
 
  status: z.enum(['draft','finalized','annulled']).default('draft'),
 
  property_id: z.string().uuid().optional().nullable(),
  account_code: z.string().min(1, 'La cuenta de ingreso es requerida'),
  bank_account: z.string().min(1, 'La cuenta de destino es requerida'),
})
 
export type IncomeFormValues = z.infer<typeof incomeSchema>

"use server";
 
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPeriodClosed, postExpenseToJournal } from "@/app/actions/accounting";
import { expenseSchema } from "@/lib/validations/expense";
import { createAuditLog } from "@/lib/security/audit";
import { logSecurityEvent, isRateLimited } from "@/lib/security/logs";
import { getRateForDate } from "@/lib/exchange";
 
import { calculateFinancials } from "@/lib/financials";

export async function createExpense(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "No autenticado" };

  // Rate limiting
  if (await isRateLimited("expense_creation", 20, 1)) {
    return { error: "Límite de creación excedido. Espere un momento." };
  }

  // 1. Zod Validation
  const rawData = {
    date: formData.get("date"),
    invoice_number: formData.get("invoice_number"),
    control_number: formData.get("control_number"),
    supplier: formData.get("supplier"),
    concept: formData.get("concept"),
    subtotal: formData.get("subtotal"),
    exchange_rate: formData.get("exchange_rate"),
    iva_percentage: formData.get("iva_percentage"),
    payment_method: formData.get("payment_method"),
    status: formData.get("status"),
    igtf_apply: formData.get("igtf_apply") === "true",
    category: formData.get("category"),
    account_code: formData.get("account_code"),
    payment_account: formData.get("payment_account"),
  };

  const parsed = expenseSchema.safeParse(rawData);
  if (!parsed.success) {
    return { error: "Datos inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const values = parsed.data;

  // 2. Organization and Context
  const { data: userData } = await supabase.from("users").select("organization_id").eq("id", user.id).single();
  if (!userData?.organization_id) return { error: "Usuario sin organización" };

  if (await isPeriodClosed(values.date)) return { error: "Periodo contable cerrado." };

  // 3. Tasa de Cambio Obligatoria
  let rate = values.exchange_rate;
  if (!rate || isNaN(rate)) {
    rate = await getRateForDate(values.date);
    if (!rate) return { error: "No se pudo obtener la tasa de cambio para esta fecha." };
  }

  // 4. Cálculos Centralizados
  const financials = calculateFinancials(values.subtotal, rate, {
    ivaPercentage: values.iva_percentage,
    igtfApply: values.igtf_apply
  });

  // 5. Inserción
  const { data: expenseData, error: insertError } = await supabase
    .from("transactions_expense")
    .insert({
      organization_id: userData.organization_id,
      date: values.date,
      invoice_number: values.invoice_number,
      control_number: values.control_number,
      supplier: values.supplier,
      concept: values.concept,
      subtotal: financials.subtotalUSD,
      iva_percentage: values.iva_percentage,
      iva_amount: financials.ivaAmountUSD,
      amount_usd: financials.totalUSD,
      amount_ves: financials.totalVES,
      exchange_rate: rate,
      retention_iva: parseFloat(formData.get("retention_iva") as string) || null,
      retention_islr: parseFloat(formData.get("retention_islr") as string) || null,
      igtf_apply: values.igtf_apply,
      igtf_amount: financials.igtfAmountVES,
      status: values.status,
      category: values.category,
      payment_method: values.payment_method,
      account_code: values.account_code,
      payment_account: values.payment_account,
      created_by: user.id,
    })
    .select()
    .single();

  if (insertError) return { error: `Error DB: ${insertError.message}` };

  // 6. Contabilización Automática
  if (values.status === "finalized") {
    await postExpenseToJournal(expenseData.id);
  }

  revalidatePath("/dashboard/gastos");
  revalidatePath("/dashboard/libro-digital");
  revalidatePath("/dashboard/banco");
  return { success: true };
}
 

 
export async function getExpense(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions_expense")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
 
  if (error) {
    console.error("Error fetching expense:", error);
    return null;
  }
  return data;
}
 
export async function updateExpense(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // 1. Verificar estado actual
  const { data: oldRecord } = await supabase
    .from("transactions_expense")
    .select("*")
    .eq("id", id)
    .single();

  if (!oldRecord) return { error: "Gasto no encontrado" };
  if (oldRecord.status === "finalized") {
    return { error: "No se puede editar un gasto finalizado. Debe anularlo." };
  }

  // 2. Validar con Zod
  const rawData = {
    date: formData.get("date"),
    invoice_number: formData.get("invoice_number"),
    control_number: formData.get("control_number"),
    supplier: formData.get("supplier"),
    concept: formData.get("concept"),
    subtotal: formData.get("subtotal"),
    exchange_rate: formData.get("exchange_rate"),
    iva_percentage: formData.get("iva_percentage"),
    payment_method: formData.get("payment_method"),
    status: formData.get("status"),
    igtf_apply: formData.get("igtf_apply") === "true",
    category: formData.get("category"),
    account_code: formData.get("account_code"),
    payment_account: formData.get("payment_account"),
  };

  const parsed = expenseSchema.safeParse(rawData);
  if (!parsed.success) return { error: "Datos inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  const values = parsed.data;

  // 3. Cálculos
  const rate = values.exchange_rate || oldRecord.exchange_rate;
  const financials = calculateFinancials(values.subtotal, rate, {
    ivaPercentage: values.iva_percentage,
    igtfApply: values.igtf_apply
  });

  const { error: updateError } = await supabase
    .from("transactions_expense")
    .update({
      date: values.date,
      invoice_number: values.invoice_number,
      control_number: values.control_number,
      supplier: values.supplier,
      concept: values.concept,
      subtotal: financials.subtotalUSD,
      iva_percentage: values.iva_percentage,
      iva_amount: financials.ivaAmountUSD,
      amount_usd: financials.totalUSD,
      amount_ves: financials.totalVES,
      exchange_rate: rate,
      igtf_apply: values.igtf_apply,
      igtf_amount: financials.igtfAmountVES,
      status: values.status,
      category: values.category,
      payment_method: values.payment_method,
      account_code: values.account_code,
      payment_account: values.payment_account,
    })
    .eq("id", id);

  if (updateError) return { error: updateError.message };

  if (values.status === "finalized" && oldRecord.status !== "finalized") {
    await postExpenseToJournal(id);
  }

  revalidatePath("/dashboard/gastos");
  revalidatePath("/dashboard/libro-digital");
  revalidatePath("/dashboard/banco");
  return { success: true };
}

export async function deleteExpense(id: string) {
  const supabase = await createClient();
  
  const { data: record } = await supabase
    .from("transactions_expense")
    .select("status")
    .eq("id", id)
    .single();

  if (record?.status === "finalized") {
    return { error: "No se puede eliminar un gasto finalizado." };
  }

  const { softDeleteTransaction } = await import("./soft-delete");
  return softDeleteTransaction("transactions_expense", id);
}

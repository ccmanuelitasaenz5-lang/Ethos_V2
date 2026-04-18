"use server";
 
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPeriodClosed, postIncomeToJournal } from "@/app/actions/accounting";
import { incomeSchema } from "@/lib/validations/income";
import { createAuditLog } from "@/lib/security/audit";
import { logSecurityEvent, isRateLimited } from "@/lib/security/logs";
import { getRateForDate } from "@/lib/exchange";
 
export async function createIncome(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // Rate limiting para prevenir spam de ingresos (20 por minuto)
  if (await isRateLimited("income_creation", 20, 1)) {
    return { error: "Has excedido el límite de creación de registros por minuto. Por favor, espera un momento." };
  }
 
  const rawData = {
    date: formData.get("date"),
    receipt_number: formData.get("receipt_number"),
    control_number: formData.get("control_number"),
    property_id: formData.get("property_id"),
    concept: formData.get("concept"),
    amount_usd: formData.get("amount_usd"),
    exchange_rate: formData.get("exchange_rate"),
    payment_method: formData.get("payment_method"),
    status: formData.get("status"),
    account_code: formData.get("account_code"),
    bank_account: formData.get("bank_account"),
  };
 
  const parsed = incomeSchema.safeParse(rawData);
  if (!parsed.success) return { error: "Datos inválidos", fieldErrors: parsed.error.flatten().fieldErrors };
  const values = parsed.data;
 
  const { data: userData } = await supabase
    .from("users").select("organization_id").eq("id", user.id).single();
  if (!userData?.organization_id) return { error: "Sin organización" };
 
  if (await isPeriodClosed(values.date)) return { error: "Periodo cerrado" };
 
  let finalExchangeRate = values.exchange_rate;
  if (!finalExchangeRate || isNaN(finalExchangeRate)) {
      finalExchangeRate = await getRateForDate(values.date);
  }
  const amountVES = values.amount_usd * finalExchangeRate;
 
  const { data: incomeData, error } = await supabase
    .from("transactions_income")
    .insert({
      organization_id: userData.organization_id,
      date: values.date,
      receipt_number: values.receipt_number,
      control_number: values.control_number,
      property_id: values.property_id,
      concept: values.concept,
      amount_usd: values.amount_usd,
      amount_ves: amountVES,
      exchange_rate: finalExchangeRate,
      status: values.status,
      account_code: values.account_code,
      payment_method: values.payment_method,
      created_by: user.id,
    })
    .select().single();
 
  if (error) return { error: error.message };
 
  await createAuditLog({
    organizationId: userData.organization_id,
    userId: user.id,
    action: "CREATE",
    tableName: "transactions_income",
    recordId: incomeData.id,
    newData: values,
  });
 
  if (values.status === "finalized") {
    await postIncomeToJournal(incomeData.id);
  }
 
  revalidatePath("/dashboard/ingresos");
  return { success: true };
}
 
export async function deleteIncome(id: string) {
    const { softDeleteTransaction } = await import("./soft-delete");
    return softDeleteTransaction("transactions_income", id);
}
 
export async function getIncome(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions_income")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  return data;
}
 
export async function updateIncome(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };
 
  const { data: oldRecord } = await supabase
    .from("transactions_income")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
 
  if (!oldRecord) return { error: "No encontrado" };
  if (oldRecord.status === "finalized") return { error: "Cerrado" };
 
  const rawData = {
      date: formData.get("date"),
      receipt_number: formData.get("receipt_number"),
      control_number: formData.get("control_number"),
      property_id: formData.get("property_id"),
      concept: formData.get("concept"),
      amount_usd: formData.get("amount_usd"),
      exchange_rate: formData.get("exchange_rate"),
      payment_method: formData.get("payment_method"),
      status: formData.get("status"),
      account_code: formData.get("account_code"),
      bank_account: formData.get("bank_account"),
  };
 
  const parsed = incomeSchema.safeParse(rawData);
  if (!parsed.success) return { error: "Inválido", fieldErrors: parsed.error.flatten().fieldErrors };
  const values = parsed.data;
 
  const { error: updateError } = await supabase
    .from("transactions_income")
    .update({
      date: values.date,
      receipt_number: values.receipt_number,
      control_number: values.control_number,
      property_id: values.property_id,
      concept: values.concept,
      amount_usd: values.amount_usd,
      exchange_rate: values.exchange_rate,
      status: values.status,
      account_code: values.account_code,
      payment_method: values.payment_method,
    })
    .eq("id", id);
 
  if (updateError) return { error: updateError.message };
 
  if (values.status === "finalized" && oldRecord.status !== "finalized") {
    await postIncomeToJournal(id);
  }
 
  await createAuditLog({
    organizationId: oldRecord.organization_id,
    userId: user.id,
    action: "UPDATE",
    tableName: "transactions_income",
    recordId: id,
    oldData: oldRecord,
    newData: values,
  });
 
  revalidatePath("/dashboard/ingresos");
  return { success: true };
}

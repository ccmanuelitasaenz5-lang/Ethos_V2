"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getBankAccounts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userData?.organization_id) return [];

  const { data, error } = await supabase
    .from("bank_accounts")
    .select("*, accounting_accounts(code)")
    .eq("organization_id", userData.organization_id)
    .order("account_name", { ascending: true });

  if (error) {
    console.error("Error fetching bank accounts:", error);
    return [];
  }
  return data;
}

export async function createBankAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userData?.organization_id) return { error: "Sin organización" };

  const account_name = formData.get("account_name") as string;
  const bank_name = formData.get("bank_name") as string;
  const account_number = formData.get("account_number") as string;
  const currency = formData.get("currency") as string;
  const accounting_account_id = formData.get("accounting_account_id") as string;
  const initial_balance =
    parseFloat(formData.get("initial_balance") as string) || 0;

  const { error } = await supabase.from("bank_accounts").insert({
    organization_id: userData.organization_id,
    account_name,
    bank_name,
    account_number,
    currency,
    accounting_account_id,
    initial_balance,
    current_balance: initial_balance,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/banco");
  return { success: true };
}

export async function getBankTransactions(bankAccountId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("bank_account_id", bankAccountId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching bank transactions:", error);
    return [];
  }
  return data;
}

export async function createBankTransaction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!userData?.organization_id) return { error: "Sin organización" };

  const bank_account_id = formData.get("bank_account_id") as string;
  const date = formData.get("date") as string;
  const description = formData.get("description") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const transaction_type = formData.get("transaction_type") as string;
  const reference = formData.get("reference") as string;

  // 1. Insertar la transacción bancaria
  const { error: txError } = await supabase
    .from("bank_transactions")
    .insert({
      organization_id: userData.organization_id,
      bank_account_id,
      date,
      description,
      amount,
      transaction_type,
      reference,
      created_by: user.id,
    })
    .select()
    .single();

  if (txError) return { error: txError.message };

  revalidatePath("/dashboard/banco");
  return { success: true };
}

export async function toggleReconciled(
  transactionId: string,
  isReconciled: boolean,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { error } = await supabase
    .from("bank_transactions")
    .update({ is_reconciled: isReconciled })
    .eq("id", transactionId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/banco");
  return { success: true };
}

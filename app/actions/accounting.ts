"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getTodayRate } from "@/lib/exchange";

// Definimos los tipos de cuentas permitidos segÃºn la estructura contable
export type AccountType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

/**
 * FunciÃ³n: Obtener el Plan de Cuentas completo
 * Trae todas las cuentas registradas para la organizaciÃ³n del usuario actual.
 */
export async function getChartOfAccounts() {
  const supabase = await createClient();

  // 1. Identificar al usuario conectado
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuario no autenticado");

  // 2. Obtener el ID de la organizaciÃ³n del usuario
  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!userData?.organization_id)
    throw new Error("Usuario sin organizaciÃ³n asignada");

  // 3. Consultar la tabla de cuentas de esa organizaciÃ³n
  const { data, error } = await supabase
    .from("accounting_accounts")
    .select("*")
    .eq("organization_id", userData.organization_id)
    .order("code", { ascending: true });

  if (error) {
    console.error("Error al obtener cuentas:", error);
    return [];
  }

  return data;
}

/**
 * NUEVA FUNCIÃ“N: Obtener solo cuentas activas con movimiento
 * EspecÃ­fica para el Libro Diario (filtrando solo las que permiten imputaciÃ³n)
 */
export async function getActiveAccounts() {
  const supabase = await createClient();

  try {
    // 1. Identificar al usuario conectado
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Usuario no autenticado", data: [] };
    }

    // 2. Obtener el ID de la organización
    const { data: { session } } = await supabase.auth.getSession();
    const orgId = session?.user?.user_metadata?.organization_id;

    if (!orgId || orgId === 'undefined') {
      console.warn("Aviso: No hay organization_id, devolviendo lista vacía.");
      return { success: true, data: [] }; // Devuelve éxito con datos vacíos
    }

    // 3. Consultar solo cuentas activas y de movimiento
    const { data, error } = await supabase
      .from("accounting_accounts")
      .select("id, code, name, main_type, level, is_movement")
      .eq("organization_id", orgId)
      .eq("is_movement", true) // Solo cuentas que permiten movimiento
      .order("code", { ascending: true });

    if (error) {
      console.error("Error al obtener cuentas activas:", error);
      return { error: error.message, data: [] };
    }

    return { success: true, data: data || [] };
  } catch (err) {
    console.error("Error inesperado en getActiveAccounts:", err);
    return { error: "Error interno del servidor", data: [] };
  }
}

/**
 * FunciÃ³n: Generar Plan de Cuentas Base (VEN-NIF para OSFL)
 */
export async function seedDefaultAccounts(organizationId: string) {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = createAdminClient();

  console.log("SEED: Iniciando proceso para organizaciÃ³n:", organizationId);

  if (!organizationId) {
    console.error("SEED ERROR: organizationId es nulo o indefinido");
    return { error: "ID de organizaciÃ³n no vÃ¡lido" };
  }

  const defaultAccounts = [
    { code: "1", name: "ACTIVO", type: "ASSET", level: 1, move: false },
    { code: "1.1", name: "EFECTIVO Y EQUIVALENTES", type: "ASSET", level: 2, move: false },
    { code: "1.1.01", name: "Caja Principal (Efectivo Bs.)", type: "ASSET", level: 3, move: true },
    { code: "1.1.02", name: "Caja Principal (Efectivo USD)", type: "ASSET", level: 3, move: true },
    { code: "1.1.03", name: "Banco Nacional 01", type: "ASSET", level: 3, move: true },
    { code: "1.1.04", name: "Banco Nacional 02", type: "ASSET", level: 3, move: true },
    { code: "1.1.05", name: "Banco Custodio (USD)", type: "ASSET", level: 3, move: true },
    { code: "1.1.06", name: "Caja Chica", type: "ASSET", level: 3, move: true },
    { code: "2", name: "PASIVO", type: "LIABILITY", level: 1, move: false },
    { code: "2.1", name: "CUENTAS POR PAGAR", type: "LIABILITY", level: 2, move: false },
    { code: "2.1.01", name: "Proveedores Nacionales", type: "LIABILITY", level: 3, move: true },
    { code: "2.1.02", name: "Gastos por Pagar", type: "LIABILITY", level: 3, move: true },
    { code: "3", name: "PATRIMONIO", type: "EQUITY", level: 1, move: false },
    { code: "3.1", name: "FONDO SOCIAL / RESERVAS", type: "EQUITY", level: 2, move: true },
    { code: "3.2", name: "RESULTADOS ACUMULADOS", type: "EQUITY", level: 2, move: true },
    { code: "4", name: "INGRESOS", type: "INCOME", level: 1, move: false },
    { code: "4.1", name: "CUOTAS ORDINARIAS", type: "INCOME", level: 2, move: true },
    { code: "4.2", name: "CUOTAS EXTRAORDINARIAS", type: "INCOME", level: 2, move: true },
    { code: "4.3", name: "DONACIONES / OTROS INGRESOS", type: "INCOME", level: 2, move: true },
    { code: "5", name: "GASTOS OPERATIVOS", type: "EXPENSE", level: 1, move: false },
    { code: "5.1", name: "GASTOS DE PERSONAL", type: "EXPENSE", level: 2, move: true },
    { code: "5.2", name: "SERVICIOS PÃšBLICOS", type: "EXPENSE", level: 2, move: true },
    { code: "5.3", name: "REPARACIONES Y MANTENIMIENTO", type: "EXPENSE", level: 2, move: true },
    { code: "5.4", name: "GASTOS ADMINISTRATIVOS", type: "EXPENSE", level: 2, move: true },
  ];

  for (const acc of defaultAccounts) {
    const { data: existing, error: checkError } = await supabase
      .from("accounting_accounts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("code", acc.code)
      .maybeSingle();

    if (checkError) {
      console.error(`Error al verificar cuenta ${acc.code}:`, checkError);
      continue;
    }

    if (!existing) {
      let parentId: string | null = null;
      const segments = acc.code.split(".");
      
      if (segments.length > 1) {
        const parentCode = segments.slice(0, -1).join(".");
        const { data: parent } = await supabase
          .from("accounting_accounts")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("code", parentCode)
          .single();
        parentId = parent?.id || null;
      }

      const { error: insertError } = await supabase
        .from("accounting_accounts")
        .insert({
          organization_id: organizationId,
          code: acc.code,
          name: acc.name,
          main_type: acc.type as AccountType,
          level: segments.length,
          is_movement: acc.move,
          parent_id: parentId,
        });

      if (insertError) {
        console.error(`SEED ERROR al insertar cuenta ${acc.code}:`, insertError);
      } else {
        console.log(`SEED SUCCESS: Cuenta ${acc.code} creada con parent_id: ${parentId}.`);
      }
    } else {
      console.log(`SEED SKIP: Cuenta ${acc.code} ya existe.`);
    }
  }

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

/**
 * Función: Crear una cuenta contable individual (Árbol Contable)
 */
export async function createAccount(formData: FormData) {
  const supabase = await createClient();

  // 1. Obtener organización del usuario
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!userData?.organization_id) return { error: "Sin organización asignada" };

  const organizationId = userData.organization_id;
  const code = formData.get("code") as string;
  const name = formData.get("name") as string;
  const main_type = formData.get("main_type") as AccountType;
  const is_movement = formData.get("is_movement") === "true";
  
  // 2. Cálculo automático de jerarquía y nivel
  const segments = code.split(".");
  const level = segments.length;
  let parentId: string | null = null;

  if (level > 1) {
    const parentCode = segments.slice(0, -1).join(".");
    
    // 3. Validar existencia y estado del padre
    const { data: parentAccount, error: parentError } = await supabase
      .from("accounting_accounts")
      .select("id, is_movement")
      .eq("organization_id", organizationId)
      .eq("code", parentCode)
      .maybeSingle();

    if (parentError) return { error: `Error al buscar padre: ${parentError.message}` };
    
    if (!parentAccount) {
      return { error: `La cuenta padre [${parentCode}] debe ser creada primero.` };
    }

    // Regla de Oro: Restricción de Movimiento (Un padre de movimiento no puede tener hijos)
    if (parentAccount.is_movement) {
      return { error: "No se pueden crear subcuentas bajo una cuenta que ya recibe asientos directos." };
    }

    parentId = parentAccount.id;
  }

  // 4. Insertar la cuenta incluyendo parent_id
  const { error } = await supabase.from("accounting_accounts").insert({
    organization_id: organizationId,
    code,
    name,
    main_type,
    level,
    is_movement,
    parent_id: parentId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

/**
 * Función: Importar cuentas desde texto (TXT) con validación de árbol
 */
export async function importAccountsFromText(text: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!userData?.organization_id) return { error: "Sin organización" };

  const organizationId = userData.organization_id;
  const lines = text.split("\n");
  const results = { success: 0, error: 0, messages: [] as string[] };

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 3) {
      results.error++;
      continue;
    }

    const [code, name, typeStr, moveStr] = parts;
    const segments = code.split(".");
    const level = segments.length;
    const is_movement = moveStr?.toUpperCase() === "S" || moveStr?.toUpperCase() === "SI";
    let parentId: string | null = null;

    // Validación de Jerarquía para Importación
    if (level > 1) {
      const parentCode = segments.slice(0, -1).join(".");
      const { data: parentAccount } = await supabase
        .from("accounting_accounts")
        .select("id, is_movement")
        .eq("organization_id", organizationId)
        .eq("code", parentCode)
        .maybeSingle();

      if (!parentAccount) {
        results.error++;
        results.messages.push(`Error en [${code}]: La cuenta padre [${parentCode}] no existe.`);
        continue;
      }

      if (parentAccount.is_movement) {
        results.error++;
        results.messages.push(`Error en [${code}]: El padre [${parentCode}] es una cuenta de movimiento.`);
        continue;
      }
      parentId = parentAccount.id;
    }

    const { error } = await supabase.from("accounting_accounts").insert({
      organization_id: organizationId,
      code,
      name,
      main_type: typeStr as AccountType,
      level,
      is_movement,
      parent_id: parentId,
    });

    if (error) {
      results.error++;
      results.messages.push(`Error en [${code}]: ${error.message}`);
    }
    else results.success++;
  }

  revalidatePath("/dashboard/configuracion");
  return { ...results };
}

/**
 * Función: Actualizar una cuenta contable
 */
export async function updateAccount(id: string, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const name = formData.get("name") as string;
  const main_type = formData.get("main_type") as AccountType;
  const is_movement = formData.get("is_movement") === "true";

  // Si se intenta activar 'movimiento', validar que no tenga subcuentas
  if (is_movement) {
    const { count } = await supabase
      .from("accounting_accounts")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", id);

    if (count && count > 0) {
      return { error: "No se puede marcar como cuenta de movimiento porque tiene subcuentas asociadas." };
    }
  }

  const { error } = await supabase
    .from("accounting_accounts")
    .update({ name, main_type, is_movement })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

/**
 * FunciÃ³n: Eliminar una cuenta contable
 */
export async function deleteAccount(id: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: account } = await supabase
    .from("accounting_accounts")
    .select("code, organization_id")
    .eq("id", id)
    .single();

  if (account) {
    const { count } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", account.organization_id)
      .eq("account_code", account.code);

    if (count && count > 0) {
      return { error: "No se puede eliminar una cuenta con asientos asociados." };
    }
  }

  const { error } = await supabase.from("accounting_accounts").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/configuracion");
  return { success: true };
}

/**
 * FunciÃ³n: Verificar si un periodo estÃ¡ cerrado
 */
export async function isPeriodClosed(dateString: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return true;

  const { data: userData } = await supabase
    .from("users")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!userData?.organization_id) return true;

  const datePart = dateString.split("T")[0];
  const [year, month] = datePart.split("-");
  const period = `${year}-${month}-01`;

  const { data } = await supabase
    .from("monthly_closings")
    .select("id")
    .eq("organization_id", userData.organization_id)
    .eq("period", period)
    .eq("status", "closed")
    .maybeSingle();

  return !!data;
}

/**
 * FunciÃ³n: Crear un Asiento Contable Manual (Bimonetario)
 */
/**
 * Función: Crear un Asiento Contable Manual (Estructura Cabecera-Renglón)
 */
export async function createManualJournalEntry(payload: {
  date: string;
  description: string;
  exchange_rate: number;
  reference_id?: string;
  reference_type?: 'income' | 'expense' | 'manual';
  items: {
    account_code: string;
    account_name: string;
    description?: string;
    debit: number;
    credit: number;
    debit_ves: number;
    credit_ves: number;
  }[];
}, supabaseClient?: any) {
  const supabase = supabaseClient || await createClient();
  let organizationId: string;
  let userId: string | undefined;

  if (!supabaseClient) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "No autenticado" };
    userId = user.id;

    const { data: userData } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!userData?.organization_id) return { error: "Sin organización" };
    organizationId = userData.organization_id;
  } else {
    // Para clientes admin o procesos automáticos, usamos los IDs proporcionados o intentamos obtenerlos
    organizationId = (payload as any).organization_id;
    userId = (payload as any).userId || (payload as any).user_id;

    if (!organizationId) {
      // Intento de recuperación: si hay userId, buscamos su organización
      if (userId) {
          const { data: userData } = await supabase.from("users").select("organization_id").eq("id", userId).single();
          organizationId = userData?.organization_id;
      }
    }
  }

  // Si después de todo no hay organization_id, error.
  // @ts-ignore
  if (!organizationId) return { error: "No se pudo determinar la organización" };

  if (await isPeriodClosed(payload.date)) {
    return { error: "El periodo contable está cerrado para esta fecha." };
  }

  // Validación de Integridad: Debe = Haber
  const totalDebitUSD = payload.items.reduce((sum, i) => sum + i.debit, 0);
  const totalCreditUSD = payload.items.reduce((sum, i) => sum + i.credit, 0);
  const totalDebitVES = payload.items.reduce((sum, i) => sum + i.debit_ves, 0);
  const totalCreditVES = payload.items.reduce((sum, i) => sum + i.credit_ves, 0);

  const diffUSD = Math.abs(totalDebitUSD - totalCreditUSD);
  const diffVES = Math.abs(totalDebitVES - totalCreditVES);

  if (diffUSD > 0.01 || diffVES > 0.01) {
    return { error: `Integridad Fallida: El asiento no cuadra. Diferencia USD: ${diffUSD.toFixed(2)}, VES: ${diffVES.toFixed(2)}` };
  }

  // 1. Obtener número de asiento
  // Si no hay usuario (caso admin/proceso automático), no fallamos, solo buscamos por org
  const { data: lastEntry } = await supabase
    .from("accounting_entries")
    .select("entry_number")
    .eq("organization_id", organizationId)
    .order("entry_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextNumber = (lastEntry?.entry_number || 0) + 1;

  // 2. Insertar Cabecera
  const { data: entry, error: entryError } = await supabase
    .from("accounting_entries")
    .insert({
      organization_id: organizationId,
      date: payload.date,
      entry_number: nextNumber,
      description: payload.description,
      status: "posted",
      reference_id: payload.reference_id || null,
      reference_type: payload.reference_type || "manual",
      created_by: userId || null
    })
    .select()
    .single();

  if (entryError) return { error: `Error en cabecera: ${entryError.message}` };

  // 3. Insertar Renglones
  const items = payload.items.map(item => ({
    entry_id: entry.id,
    account_code: item.account_code,
    account_name: item.account_name,
    description: item.description || payload.description,
    debit: item.debit,
    credit: item.credit,
    debit_ves: item.debit_ves,
    credit_ves: item.credit_ves,
    amount_usd: item.debit > 0 ? item.debit : -item.credit 
  }));

  const { error: itemsError } = await supabase.from("accounting_entry_items").insert(items);

  if (itemsError) {
    // Nota: En un sistema real usaríamos transacciones SQL, aquí dependemos de la integridad de la BD
    console.error("Error al insertar renglones:", itemsError);
    return { error: "Error al guardar los renglones del asiento." };
  }

  revalidatePath("/dashboard/libro-digital");
  return { success: true, entry_number: nextNumber };
}

/**
 * Tarea 2: Automatización de "Gasto a Asiento"
 * Genera automáticamente un asiento contable a partir de un gasto finalizado.
 */
export async function postExpenseToJournal(expenseId: string) {
  const adminSupabase = createAdminClient();
  
  // 1. Obtener el gasto completo
  const { data: expense, error: fetchError } = await adminSupabase
    .from("transactions_expense")
    .select("*")
    .eq("id", expenseId)
    .single();

  if (fetchError || !expense) return { error: "Gasto no encontrado" };
  if (expense.status !== "finalized") return { error: "Solo se pueden contabilizar gastos finalizados" };

  // 2. Validar si ya existe un asiento
  const { data: existing } = await adminSupabase
    .from("accounting_entries")
    .select("id")
    .eq("reference_id", expenseId)
    .eq("reference_type", "expense")
    .maybeSingle();

  if (existing) return { success: true, message: "Ya existe un asiento para este gasto" };

  // 3. Definir cuentas — CORRECCIÓN CRÍTICA
  const expenseAccount = expense.account_code || "5.4.01";
  let paymentAccount = "1.1.01";
  const ivaAccount = "1.1.07";
  let bankAccountId: string | null = null;

  if (expense.payment_account) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expense.payment_account);
    
    if (isUUID) {
      const { data: bank } = await adminSupabase
        .from("bank_accounts")
        .select("id, accounting_code, accounting_account_id, accounting_accounts:accounting_account_id(code)")
        .eq("id", expense.payment_account)
        .single();
      
      if (bank) {
        bankAccountId = bank.id;
        // @ts-ignore
        paymentAccount = bank.accounting_code || bank.accounting_accounts?.code || paymentAccount;
      }
    } else {
      paymentAccount = expense.payment_account;
      const { data: bank } = await adminSupabase
        .from("bank_accounts")
        .select("id")
        .eq("accounting_code", expense.payment_account)
        .eq("organization_id", expense.organization_id)
        .maybeSingle();
      bankAccountId = bank?.id || null;
    }
  }

  const items = [];
  
  // Renglón 1: Cargo al Gasto (Monto Neto)
  items.push({
    account_code: expenseAccount,
    account_name: "Gasto Operativo",
    debit: expense.subtotal,
    credit: 0,
    debit_ves: expense.subtotal * expense.exchange_rate,
    credit_ves: 0,
  });

  // Renglón 2: Cargo al IVA (Si aplica)
  if (expense.iva_amount > 0) {
    items.push({
      account_code: ivaAccount,
      account_name: "IVA Crédito Fiscal",
      debit: expense.iva_amount,
      credit: 0,
      debit_ves: expense.iva_amount * expense.exchange_rate,
      credit_ves: 0,
    });
  }

  // Renglón 3: Abono a Banco/Caja (Monto Total USD y VES)
  items.push({
    account_code: paymentAccount,
    account_name: "Banco / Caja",
    debit: 0,
    credit: expense.amount_usd,
    debit_ves: 0,
    credit_ves: expense.amount_ves,
  });

  // 4. Crear asiento contable
  const result = await createManualJournalEntry({
    date: expense.date,
    description: `Gasto: ${expense.supplier} - ${expense.concept} (Fac: ${expense.invoice_number})`,
    exchange_rate: expense.exchange_rate,
    reference_id: expenseId,
    reference_type: "expense",
    // @ts-ignore
    organization_id: expense.organization_id,
    userId: expense.created_by,
    items: items
  } as any, adminSupabase);

  if (!result.success) return result;

  // 5. Registrar movimiento bancario (SALIDA de dinero)
  if (bankAccountId) {
    await adminSupabase
      .from("bank_transactions")
      .insert({
        organization_id: expense.organization_id,
        bank_account_id: bankAccountId,
        date: expense.date,
        description: `Gasto: ${expense.supplier} - ${expense.concept} (Fac: ${expense.invoice_number})`,
        amount: -expense.amount_ves, // Monto VES negativo = salida
        transaction_type: "expense",
        reference: expense.invoice_number || null,
        reference_id: expenseId,
        reference_type: "expense",
        created_by: expense.created_by,
      });
  }

  revalidatePath("/dashboard/libro-digital");
  revalidatePath("/dashboard/banco");
  revalidatePath("/dashboard/gastos");

  return result;
}

/**
 * Tarea: Automatización de "Ingreso a Asiento"
 * Genera automáticamente un asiento contable a partir de un ingreso finalizado.
 */
/**
 * Tarea: Automatización de "Ingreso a Asiento"
 * Genera automáticamente un asiento contable a partir de un ingreso finalizado.
 */
export async function postIncomeToJournal(incomeId: string) {
  const adminSupabase = createAdminClient();
  
  // 1. Obtener el ingreso completo (usando admin para asegurar bypass de RLS)
  const { data: income, error: fetchError } = await adminSupabase
    .from("transactions_income")
    .select("*")
    .eq("id", incomeId)
    .single();

  if (fetchError || !income) return { error: "Ingreso no encontrado" };
  if (income.status !== "finalized") return { error: "Solo se pueden contabilizar ingresos finalizados" };

  // 2. Validar si ya existe un asiento para este ingreso
  const { data: existing } = await adminSupabase
    .from("accounting_entries")
    .select("id")
    .eq("reference_id", incomeId)
    .eq("reference_type", "income")
    .maybeSingle();

  if (existing) return { success: true, message: "Ya existe un asiento para este ingreso" };

  // 3. Definir cuentas — CORRECCIÓN CRÍTICA
  const incomeAccount = income.account_code || "4.1"; // Default a Ingresos
  let paymentAccount = "1.1.01"; // Default a Caja Principal
  let bankAccountId: string | null = null;

  if (income.bank_account) {
    // Determinar si es UUID o código contable
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(income.bank_account);
    
    if (isUUID) {
      // Es un ID de banco — buscar con JOIN para obtener el código contable
      const { data: bank } = await adminSupabase
        .from("bank_accounts")
        .select(`
          id, 
          accounting_code, 
          accounting_account_id,
          accounting_accounts:accounting_account_id(code)
        `)
        .eq("id", income.bank_account)
        .single();
      
      if (bank) {
        bankAccountId = bank.id;
        // @ts-ignore
        paymentAccount = bank.accounting_code || bank.accounting_accounts?.code || paymentAccount;
      }
    } else {
      // Es un código contable directo
      paymentAccount = income.bank_account;
      // Buscar el banco por código contable
      const { data: bank } = await adminSupabase
        .from("bank_accounts")
        .select("id")
        .eq("accounting_code", income.bank_account)
        .eq("organization_id", income.organization_id)
        .maybeSingle();
      bankAccountId = bank?.id || null;
    }
  }

  // 4. Validar montos
  if (!income.amount_usd || income.amount_usd <= 0) {
    return { error: "El monto del ingreso en USD no es válido" };
  }
  const amountVES = income.amount_ves || (income.amount_usd * (income.exchange_rate || 1));

  const items = [
    {
      account_code: paymentAccount,
      account_name: "Efectivo / Banco",
      debit: income.amount_usd,
      credit: 0,
      debit_ves: amountVES,
      credit_ves: 0,
    },
    {
      account_code: incomeAccount,
      account_name: "Ingresos",
      debit: 0,
      credit: income.amount_usd,
      debit_ves: 0,
      credit_ves: amountVES,
    },
  ];

  // 5. Llamar a la lógica de creación de asiento (Usando Admin Client)
  const result = await createManualJournalEntry({
    date: income.date,
    description: `Ingreso: ${income.concept} (Recibo: ${income.receipt_number || 'N/A'})`,
    exchange_rate: income.exchange_rate || 1,
    reference_id: incomeId,
    reference_type: "income",
    // @ts-ignore - Estos campos son manejados internamente por createManualJournalEntry cuando se pasa supabaseClient
    organization_id: income.organization_id, 
    userId: income.created_by,
    items: items
  } as any, adminSupabase);

  if (!result.success) {
    console.error("Error al crear asiento para ingreso:", result.error);
    return result;
  }

  // 6. Registrar movimiento en la tabla de bancos — CORRECCIÓN CRÍTICA DE CAMPOS Y TIPOS
  if (bankAccountId) {
    const { error: bankError } = await adminSupabase
      .from("bank_transactions")
      .insert({
        organization_id: income.organization_id,
        bank_account_id: bankAccountId,
        date: income.date,
        description: `Ingreso: ${income.concept} (Recibo: ${income.receipt_number || 'N/A'})`,
        amount: amountVES,           // Monto VES positivo = depósito
        transaction_type: "income",  // CORRECTO: 'deposito' era inválido
        reference: income.receipt_number || null,
        reference_id: incomeId,
        reference_type: 'income',
        created_by: income.created_by
      });

    if (bankError) {
      console.error("Error al registrar movimiento bancario:", bankError);
    }
  }

  // 7. Invalidar caches
  revalidatePath("/dashboard/libro-digital");
  revalidatePath("/dashboard/banco");
  revalidatePath("/dashboard/ingresos");

  return result;
}

/**
 * Función: Obtener datos para el Libro Digital (Diario, Mayor, Balance)
 * Consume la vista SQL view_journal_flat
 */
export async function getAccountingData(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return { error: "No session" };

  // Intentar obtener orgId de metadata o de la tabla de perfiles
  let orgId = user.user_metadata?.organization_id;

  if (!orgId) {
    const { data: profile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    orgId = profile?.organization_id;
  }

  if (!orgId) {
    return { success: true, data: [] }; // Silenciar el error y devolver vacío
  }

  let query = supabase
    .from("view_journal_flat")
    .select("*")
    .eq("organization_id", orgId)
    .order("date", { ascending: false })
    .order("entry_number", { ascending: false });

  if (startDate) query = query.gte("date", startDate);
  if (endDate) query = query.lte("date", endDate);

  const { data, error } = await query;

  if (error) return { error: error.message };

  // Mapear campos para compatibilidad con la interfaz JournalEntryFlat
  // (La vista usa debit_usd/credit_usd, los componentes esperan debit/credit)
  // Además, filtramos duplicados por item_id para mitigar un posible bug en la vista de base de datos
  const uniqueData = [];
  const seenItems = new Set();
  for (const item of (data || [])) {
    if (!seenItems.has(item.item_id)) {
      seenItems.add(item.item_id);
      uniqueData.push(item);
    }
  }

  const mappedData = uniqueData.map(item => ({
    ...item,
    description: item.item_description || item.entry_description || item.description
  }));
  
  return { success: true, data: (mappedData || []) as any[] };
}

/**
 * Función: Sincronización Retroactiva
 * Busca transacciones finalizadas que no tienen asiento y los genera.
 */
export async function syncAccountingRecords() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  // 1. Obtener gastos finalizados sin asiento
  const { data: expenses } = await supabase
    .from("transactions_expense")
    .select("id")
    .eq("status", "finalized");

  // 2. Obtener ingresos finalizados sin asiento
  const { data: incomes } = await supabase
    .from("transactions_income")
    .select("id")
    .eq("status", "finalized");

  let syncedCount = 0;

  // Procesar Gastos
  if (expenses) {
    for (const exp of expenses) {
      const res = await postExpenseToJournal(exp.id);
      if (res.success) syncedCount++;
    }
  }

  // Procesar Ingresos
  if (incomes) {
    for (const inc of incomes) {
      const res = await postIncomeToJournal(inc.id);
      if (res.success) syncedCount++;
    }
  }

  revalidatePath("/dashboard/libro-digital");
  return { success: true, syncedCount };
}

/**
 * Obtiene la última tasa de cambio BCV registrada en el sistema.
 * Usada por el modal de asiento manual para pre-cargar la tasa del día.
 */
export async function getLatestExchangeRate(): Promise<{ rate: number; source: string }> {
  const supabase = await createClient();

  // Buscar la tasa más reciente en la BD
  const { data } = await supabase
    .from("exchange_rates")
    .select("rate_usd_ves, date, source")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    return { rate: data.rate_usd_ves, source: `BCV ${data.date}` };
  }

  // Si no hay nada en BD, obtener la tasa de hoy
  const rate = await getTodayRate();
  return { rate, source: "BCV (hoy)" };
}

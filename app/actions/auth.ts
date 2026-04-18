"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logSecurityEvent, isRateLimited } from "@/lib/security/logs";

// Validación de contraseña
function validatePassword(password: string): {
  valid: boolean;
  error?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      error: "La contraseña debe tener al menos 8 caracteres",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos una mayúscula",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos una minúscula",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "La contraseña debe contener al menos un número",
    };
  }
  return { valid: true };
}

export async function signup(formData: FormData) {
  try {
    if (await isRateLimited("signup_attempt", 3, 60)) {
      return {
        error:
          "Has excedido el límite de intentos de registro. Por favor espera una hora.",
      };
    }

    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const fullName = formData.get("full_name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const orgName =
      (formData.get("org_name") as string) || `Empresa de ${fullName}`;

    // Validaciones básicas
    if (!email || !password || !fullName) {
      return { error: "Todos los campos son obligatorios" };
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { error: "El formato del email no es válido" };
    }

    // Validar contraseña
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return { error: passwordValidation.error };
    }

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (authError) {
      await logSecurityEvent("signup_attempt", "failure", {
        email,
        metadata: { error: authError.message },
      });

      // Manejo específico de errores comunes
      if (
        authError.message.includes("already registered") ||
        authError.message.includes("already exists")
      ) {
        return {
          error:
            "Este email ya está registrado. Por favor, inicia sesión o usa otro email.",
        };
      }
      if (authError.message.includes("invalid email")) {
        return { error: "El formato del email no es válido" };
      }
      if (authError.message.includes("password")) {
        return {
          error: "La contraseña no cumple con los requisitos de seguridad",
        };
      }
      return { error: `Error al crear la cuenta: ${authError.message}` };
    }
    if (!authData.user)
      return {
        error: "No se pudo crear el usuario. Por favor, intenta nuevamente.",
      };

    await logSecurityEvent("signup_attempt", "success", {
      email,
      userId: authData.user.id,
    });

    // Registrar inicio de creación de organización (para auditoría)
    await logSecurityEvent("org_creation", "success", {
      userId: authData.user.id,
      metadata: { orgName }
    });

    // 2. Crear la organización
    // Intentamos insertar. Si falla, capturamos el error exacto de la DB
    const { data: orgData, error: orgError } = await adminSupabase
      .from("organizations")
      .insert({ name: orgName })
      .select()
      .single();

    if (orgError) {
      console.error("ERROR CRÍTICO DB:", orgError);
      // Manejo específico de errores de base de datos
      if (
        orgError.message.includes("duplicate") ||
        orgError.message.includes("unique")
      ) {
        return {
          error:
            "Ya existe una organización con ese nombre. Por favor, elige otro nombre.",
        };
      }
      return {
        error: `Error al crear la organización: ${orgError.message}. Si el problema persiste, contacta al soporte.`,
      };
    }

    // 3. Vincular perfil
    const { error: userError } = await adminSupabase.from("users").insert({
      id: authData.user.id,
      organization_id: orgData.id,
      full_name: fullName,
      role: "admin",
    });

    if (userError) {
      // Si falla la creación del perfil, intentar limpiar la organización creada
      try {
        await adminSupabase.from("organizations").delete().eq("id", orgData.id);
      } catch (cleanupError) {
        // Ignorar errores de limpieza
        console.error("Error al limpiar organización:", cleanupError);
      }
      return {
        error: `Error al vincular el perfil: ${userError.message}. Por favor, intenta nuevamente.`,
      };
    }
  } catch (err) {
    console.error("Signup error:", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { error: `Error del sistema: ${message}` };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function login(formData: FormData) {
  if (await isRateLimited("login_attempt", 5, 15)) {
    return {
      error: "Demasiados intentos fallidos. Por favor espera 15 minutos.",
    };
  }

  const supabase = createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email y contraseña son obligatorios" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await logSecurityEvent("login_attempt", "failure", { email });
    return { error: "Credenciales inválidas" };
  }

  await logSecurityEvent("login_attempt", "success", {
    email,
    userId: data.user?.id,
  });

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function resetPassword(formData: FormData) {
  const supabase = createClient();
  const email = formData.get("email") as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function updatePassword(formData: FormData) {
  const supabase = createClient();
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) return { error: error.message };
  return { success: true };
}

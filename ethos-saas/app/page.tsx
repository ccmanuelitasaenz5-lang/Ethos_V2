'use client'
import { signup } from '@/app/actions/auth'
import Link from 'next/link'
import { useState } from 'react'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#001f3f]">ETHOS</h1>
          <p className="text-gray-500 text-sm mt-1">Crear Nueva Cuenta</p>
        </div>

        <form action={async (formData) => {
          const res = await signup(formData);
          if (res?.error) setError(res.error);
        }} className="space-y-4">
          
          <div>
            <label className="text-sm text-gray-600 ml-1">Nombre Completo</label>
            <input name="full_name" type="text" placeholder="Yoraima Ortiz" required className="w-full p-3 rounded-xl bg-[#eef4ff] border-none outline-none mt-1" />
          </div>

          {/* ESTE ES EL CAMPO QUE SOLUCIONA EL ERROR */}
          <div>
            <label className="text-sm text-gray-600 ml-1">Nombre de tu Empresa</label>
            <input name="org_name" type="text" placeholder="Mi Empresa C.A." required className="w-full p-3 rounded-xl bg-[#eef4ff] border-none outline-none mt-1" />
          </div>

          <div>
            <label className="text-sm text-gray-600 ml-1">Correo Electrónico</label>
            <input name="email" type="email" placeholder="yoraima.22@gmail.com" required className="w-full p-3 rounded-xl bg-[#eef4ff] border-none outline-none mt-1" />
          </div>

          <div>
            <label className="text-sm text-gray-600 ml-1">Contraseña</label>
            <input name="password" type="password" placeholder="••••••••" required className="w-full p-3 rounded-xl border border-gray-200 outline-none mt-1" />
          </div>

          {error && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 text-center">{error}</div>}

          <button type="submit" className="w-full py-3 bg-[#0081c9] text-white rounded-xl font-bold shadow-md hover:bg-[#0070af] transition-all">
            Crear Cuenta
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta? <Link href="/login" className="text-[#0081c9] font-medium">Inicia sesión aquí</Link>
        </div>
      </div>
    </div>
  )
}
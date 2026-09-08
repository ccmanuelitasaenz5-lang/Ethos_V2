'use client'

import { useState, useEffect, useTransition } from 'react'
// Corregimos la ruta: segun tu estructura es '@/app/actions/accounting'
import { getChartOfAccounts, seedDefaultAccounts, updateAccount, deleteAccount } from '@/app/actions/accounting'
// Corregimos la ruta del cliente de Supabase segun tu estructura: '@/lib/supabase/client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AccountForm from './AccountForm'
import AccountImport from './AccountImport'

// Definición de la estructura de una Cuenta para el sistema
type Account = {
  id: string
  code: string
  name: string
  level: number
  main_type: string
  is_movement: boolean
}

interface AccountPlanManagerProps {
  organizationId: string
}

export default function AccountPlanManager({ organizationId }: AccountPlanManagerProps) {
  // Estados para manejar los datos y la carga
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  // Hooks para recargar la página y manejar procesos en espera
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  // const supabase = createClient() // This is no longer needed as organizationId is passed as a prop

  // Al abrir este componente, se ejecutan las funciones de carga
  useEffect(() => {
    loadAccounts()
  }, [])

  // Función para traer las cuentas desde la base de datos
  const loadAccounts = async () => {
    try {
      const data = await getChartOfAccounts()
      // Guardamos los datos recibidos en nuestro estado
      setAccounts((data as unknown as Account[]) || [])
    } catch (error) {
      console.error('Error cargando cuentas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Función que se activa al hacer clic en "Inicializar Plan Base"
  const handleSeed = async () => {
    const confirmar = confirm('¿Deseas generar el plan de cuentas base automáticamente? Esto creará las cuentas de Activos, Pasivos, Patrimonio, Ingresos y Gastos.')
    if (!confirmar) return

    startTransition(async () => {
      try {
        // const { data: { user } } = await supabase.auth.getUser() // No longer needed

        // Buscamos a qué organización pertenece el usuario logueado // No longer needed
        // const { data: userData } = await supabase
        //   .from('users')
        //   .select('organization_id')
        //   .eq('id', user?.id)
        //   .single()

        // if (userData?.organization_id) { // No longer needed
        console.log('Client: Enviando seed para org:', organizationId)
        // Llamamos a la lógica que crea las cuentas (Paso anterior)
        const res = await seedDefaultAccounts(organizationId)
        console.log('Client: Resultado de seed:', res)

        if (res?.success) {
          // Refrescamos la lista visual
          await loadAccounts()
          router.refresh()
        } else if (res?.error) {
          alert(`Error: ${res.error}`)
        }
        // } else { // No longer needed
        //   console.warn('Client: No se encontró organization_id para el usuario') // No longer needed
        //   alert('No se pudo identificar tu organización. Intenta cerrar sesión y volver a entrar.') // No longer needed
        // }
      } catch (error) {
        console.error('Error generando cuentas:', error)
        alert('Hubo un error al generar las cuentas. Por favor, inténtalo de nuevo.')
      }
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta cuenta? Esta acción no se puede deshacer y fallará si la cuenta tiene asientos asociados.')) return

    try {
      const res = await deleteAccount(id)
      if (res.error) {
        alert(res.error)
      } else {
        await loadAccounts()
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      alert('Error al eliminar la cuenta')
    }
  }

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingAccount) return

    const formData = new FormData(e.currentTarget)
    try {
      const res = await updateAccount(editingAccount.id, formData)
      if (res.error) {
        alert(res.error)
      } else {
        setEditingAccount(null)
        await loadAccounts()
      }
    } catch (error) {
      console.error('Error updating account:', error)
      alert('Error al actualizar la cuenta')
    }
  }

  // Pantalla de espera mientras cargan los datos
  if (loading) return <div className="p-4 text-center text-gray-500">Cargando plan de cuentas...</div>

  return (
    <div className="bg-white shadow rounded-lg p-6 mt-6 border border-gray-200 text-gray-900">
      {/* Encabezado del módulo */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Plan de Cuentas Contables</h2>
          <p className="text-sm text-gray-500">Estructura jerárquica bajo normas VEN-NIF</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Solo mostramos el botón si la lista de cuentas está vacía */}
          {accounts.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
            >
              {isPending ? 'Generando Cuentas...' : 'Inicializar Plan Base'}
            </button>
          )}

          <button
            onClick={() => loadAccounts()}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            title="Refrescar lista"
          >
            Actualizar
          </button>
        </div>
      </div>

      {/* Seccion de Gestión de Cuentas (Manual e Importación) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <AccountForm onSuccess={loadAccounts} />
        <AccountImport />
      </div>

      {/* Tabla de Cuentas */}

      {/* Tabla de Cuentas */}
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Código</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo de Cuenta</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acepta Mov.</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  <p className="text-lg font-medium">No se han encontrado cuentas.</p>
                  <p className="text-sm">Usa el botón superior para crear el plan de cuentas inicial.</p>
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                    {acc.code}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-800">
                    {/* Sangría visual según el nivel de la cuenta */}
                    <div style={{ paddingLeft: `${(acc.level - 1) * 20}px` }}>
                      {acc.level === 1 ? <span className="font-bold text-gray-900">{acc.name}</span> : acc.name}
                    </div>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${acc.main_type === 'ASSET' ? 'bg-green-100 text-green-800' :
                        acc.main_type === 'LIABILITY' ? 'bg-red-100 text-red-800' :
                          acc.main_type === 'EQUITY' ? 'bg-blue-100 text-blue-800' :
                            acc.main_type === 'INCOME' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-purple-100 text-purple-800'}`}>
                      {acc.main_type === 'ASSET' ? 'ACTIVO' :
                        acc.main_type === 'LIABILITY' ? 'PASIVO' :
                          acc.main_type === 'EQUITY' ? 'PATRIMONIO' :
                            acc.main_type === 'INCOME' ? 'INGRESO' : 'GASTO'}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center text-sm text-gray-900">
                    {acc.is_movement ? (
                      <span className="text-green-600 font-bold">Sí</span>
                    ) : (
                      <span className="text-gray-300">No</span>
                    )}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setEditingAccount(acc)}
                      className="text-primary-600 hover:text-primary-900 mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(acc.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal o Formulario de Edición */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Editar Cuenta: {editingAccount.code}</h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  name="name"
                  defaultValue={editingAccount.name}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo Principal</label>
                <select
                  name="main_type"
                  defaultValue={editingAccount.main_type}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="ASSET">Activo</option>
                  <option value="LIABILITY">Pasivo</option>
                  <option value="EQUITY">Patrimonio</option>
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Gasto</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Cuenta de Movimiento</label>
                <select
                  name="is_movement"
                  defaultValue={editingAccount.is_movement.toString()}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="true">Sí (Recibe asientos)</option>
                  <option value="false">No (Es de nivel superior)</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg hover:bg-primary-700"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
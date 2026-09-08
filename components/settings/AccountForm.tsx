'use client'
import { useState } from 'react'
import { createAccount, AccountType } from '@/app/actions/accounting'

export default function AccountForm({ onSuccess }: { onSuccess?: () => void }) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setMessage('')
        const formData = new FormData(e.currentTarget)
        const result = await createAccount(formData)
        if (result.error) {
            setMessage(`Error: ${result.error}`)
        } else {
            setMessage('Cuenta creada con éxito')
            e.currentTarget.reset()
            onSuccess?.()
        }
        setLoading(false)
    }
    // ... el resto del componente queda exactamente igual
````//(el resto del archivo no cambia, solo esas 3 líneas)

**2. `components/settings/AccountPlanManager.tsx`** — pasarle la función de recarga:

Busca esta línea:
```tsx
<AccountForm />
```

Y reemplázala por:
```tsx
<AccountForm onSuccess={loadAccounts} />
```

Con estos dos cambios, en cuanto crees una cuenta, la tabla se actualiza sola al instante — sin salir de Configuración.

¿Puedes aplicar ambos cambios (y el fix anterior de `lib/supabase/client.ts`)? Cuando termines los tres, probamos de nuevo: crear una cuenta, y borrar un ingreso (ahora sí debería funcionar el borrado, gracias al fix del cliente).

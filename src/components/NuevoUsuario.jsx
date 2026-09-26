import { useState } from 'react'
import { gestionarUsuarios, generarClave } from '../lib/usuarios'

const VACIO = { nombre: '', correo: '', rol: 'formador', clave: '' }

export default function NuevoUsuario({ alCrear }) {
  const [abierto, setAbierto] = useState(false)
  const [form, setForm] = useState(VACIO)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [creado, setCreado] = useState(null)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  async function crear(e) {
    e.preventDefault()
    setCreando(true); setError('')
    try {
      await gestionarUsuarios({ accion: 'crear', ...form })
      setCreado({ ...form, correo: form.correo.trim().toLowerCase() })
      setForm(VACIO); setAbierto(false)
      alCrear?.()
    } catch (err) {
      setError(err.message)
    }
    setCreando(false)
  }

  return (
    <div className="mb-4">
      {creado && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-semibold text-green-800">
            Usuario creado: {creado.nombre} ({creado.rol === 'admin' ? 'Coordinación' : 'Docente'})
          </p>
          <p className="mt-1 text-green-900">Entrégale estos datos para entrar por la pestaña <strong>Soy formador</strong>:</p>
          <dl className="mt-2 grid gap-1 rounded-md bg-white p-3 font-mono text-[13px] text-tinta sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-slate-500">Dirección</dt><dd>espac-notas.vercel.app</dd>
            <dt className="text-slate-500">Correo</dt><dd className="break-all">{creado.correo}</dd>
            <dt className="text-slate-500">Contraseña</dt><dd>{creado.clave}</dd>
          </dl>
          <p className="mt-2 text-xs text-slate-600">Anótala ahora: por seguridad no se vuelve a mostrar. Si se pierde, usa "Cambiar contraseña".</p>
          <button className="mt-2 text-xs text-slate-500 underline" onClick={() => setCreado(null)}>Cerrar</button>
        </div>
      )}

      {!abierto ? (
        <button className="btn" onClick={() => { setAbierto(true); setError(''); setForm({ ...VACIO, clave: generarClave() }) }}>
          Crear usuario
        </button>
      ) : (
        <form onSubmit={crear} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <h3 className="text-lg font-semibold sm:col-span-2">Nuevo usuario de coordinación o docente</h3>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="nu-nombre">Nombre como aparecerá en planillas y PDF</label>
            <input id="nu-nombre" required className="campo" placeholder="Ej. Pbro. Juan Pérez" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="nu-correo">Correo</label>
            <input id="nu-correo" type="email" required className="campo" autoComplete="off" value={form.correo} onChange={(e) => set('correo', e.target.value)} />
          </div>
          <div>
            <label className="etiqueta" htmlFor="nu-rol">Rol</label>
            <select id="nu-rol" className="campo" value={form.rol} onChange={(e) => set('rol', e.target.value)}>
              <option value="formador">Docente (formador)</option>
              <option value="admin">Coordinación y administración</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="nu-clave">Contraseña inicial</label>
            <div className="flex flex-wrap gap-2">
              <input id="nu-clave" required minLength={8} className="campo max-w-xs font-mono" autoComplete="off"
                value={form.clave} onChange={(e) => set('clave', e.target.value)} />
              <button type="button" className="btn-sec" onClick={() => set('clave', generarClave())}>Generar otra</button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Mínimo 8 caracteres. La generada evita letras y números que se confunden.</p>
          </div>
          {form.rol === 'admin' && (
            <p className="text-xs text-amber-800 sm:col-span-2">Coordinación tiene acceso completo: puede eliminar estudiantes, cambiar módulos y crear otros usuarios.</p>
          )}
          {error && <p className="text-sm text-alerta sm:col-span-2">{error}</p>}
          <div className="flex gap-3 sm:col-span-2">
            <button className="btn" disabled={creando}>{creando ? 'Creando…' : 'Crear usuario'}</button>
            <button type="button" className="btn-sec" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    setEnviando(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: correo, password: clave })
    if (error) setError('Correo o contraseña incorrectos. Verifica los datos o pide acceso a la coordinación.')
    setEnviando(false)
  }

  return (
    <div className="grid min-h-screen place-items-center bg-tinta p-6">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Proceso de ESPAC Notas</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">Vicaría Episcopal Territorial N. Sra. del Rosario · Suba-Cota</p>
        <label className="etiqueta" htmlFor="correo">Correo</label>
        <input id="correo" type="email" required className="campo mb-4" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        <label className="etiqueta" htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" required className="campo mb-4" value={clave} onChange={(e) => setClave(e.target.value)} />
        {error && <p className="mb-4 text-sm text-alerta">{error}</p>}
        <button className="btn w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}

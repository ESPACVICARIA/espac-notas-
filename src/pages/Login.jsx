import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login({ onEstudiante }) {
  const [modo, setModo] = useState('estudiante')
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function cambiarModo(m) { setModo(m); setUsuario(''); setClave(''); setError('') }

  async function entrar(e) {
    e.preventDefault()
    setEnviando(true); setError('')
    if (modo === 'formador') {
      const { error } = await supabase.auth.signInWithPassword({ email: usuario.trim(), password: clave })
      if (error) setError('Correo o contraseña incorrectos. Verifica los datos o pide acceso a la coordinación.')
    } else {
      const { data, error } = await supabase.rpc('portal_estudiante', { p_documento: usuario, p_clave: clave })
      if (error) setError('No se pudo conectar con la plataforma. Revisa tu internet e intenta de nuevo.')
      else if (data?.error) setError(data.error)
      else onEstudiante({ datos: data, documento: usuario, clave })
    }
    setEnviando(false)
  }

  const pestana = (m, texto) => (
    <button type="button" onClick={() => cambiarModo(m)}
      className={`flex-1 rounded-md py-2 text-sm font-semibold ${modo === m ? 'bg-white text-tinta shadow' : 'text-slate-600'}`}>
      {texto}
    </button>
  )

  return (
    <div className="grid min-h-screen place-items-center bg-tinta p-6">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-xl bg-white p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Proceso de ESPAC Notas</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">Vicaría Episcopal Territorial N. Sra. del Rosario · Suba-Cota</p>

        <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
          {pestana('estudiante', 'Soy estudiante')}
          {pestana('formador', 'Soy formador')}
        </div>

        <label className="etiqueta" htmlFor="usuario">{modo === 'formador' ? 'Correo' : 'Número de documento'}</label>
        <input id="usuario" required className="campo mb-4"
          type={modo === 'formador' ? 'email' : 'text'}
          inputMode={modo === 'formador' ? 'email' : 'numeric'}
          autoComplete="username"
          value={usuario} onChange={(e) => setUsuario(e.target.value)} />

        <label className="etiqueta" htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" required className="campo mb-2" autoComplete="current-password"
          value={clave} onChange={(e) => setClave(e.target.value)} />
        {modo === 'estudiante' && (
          <p className="mb-4 text-xs text-slate-500">La primera vez, tu contraseña es tu mismo número de documento.</p>
        )}

        {error && <p className="mb-4 text-sm text-alerta">{error}</p>}
        <button className="btn mt-2 w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}

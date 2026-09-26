import { useState } from 'react'
import { supabase } from '../lib/supabase'

const fecha = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

export default function PortalMensajes({ mensajes, documento, clave, alLeer }) {
  const [abierto, setAbierto] = useState(null)

  async function abrir(m) {
    setAbierto(abierto === m.id ? null : m.id)
    if (!m.leido) {
      const { data } = await supabase.rpc('marcar_mensaje_leido', { p_documento: documento, p_clave: clave, p_mensaje: m.id })
      if (data?.ok) alLeer?.(m.id)
    }
  }

  if (!mensajes.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">No tienes mensajes por ahora.</p>
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {mensajes.map((m) => (
        <li key={m.id}>
          <button onClick={() => abrir(m)} aria-expanded={abierto === m.id} className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.leido ? 'bg-transparent' : 'bg-oro'}`} aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className={`block ${m.leido ? 'font-medium' : 'font-bold'} text-tinta`}>
                {m.asunto} {!m.leido && <span className="ml-1 rounded bg-oro px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Nuevo</span>}
              </span>
              <span className="text-xs text-slate-500">{m.autor} · {fecha(m.creado)}</span>
            </span>
          </button>
          {abierto === m.id && <p className="whitespace-pre-wrap px-4 pb-4 pl-10 text-sm text-slate-700">{m.cuerpo}</p>}
        </li>
      ))}
    </ul>
  )
}

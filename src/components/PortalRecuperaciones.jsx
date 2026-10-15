import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/notas'
import { ESTADOS_REC, vencida } from '../lib/recuperaciones'

const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

// Aviso en el portal: lo que el estudiante debe hacer para recuperar sus faltas
export default function PortalRecuperaciones({ documento, clave }) {
  const [lista, setLista] = useState([])
  const [verTodas, setVerTodas] = useState(false)
  useEffect(() => {
    supabase.rpc('portal_recuperaciones', { p_documento: documento, p_clave: clave })
      .then(({ data }) => { if (data?.recuperaciones) setLista(data.recuperaciones) })
  }, [documento, clave])
  if (!lista.length) return null
  const abiertas = lista.filter((r) => r.estado === 'asignada' || r.estado === 'entregada' || r.estado === 'no_presentada')
  const mostrar = verTodas ? lista : abiertas
  return (
    <section aria-labelledby="rec-portal" className={`mb-6 rounded-xl border-2 p-4 ${abiertas.length ? 'border-alerta/40 bg-red-50/60' : 'border-green-300 bg-green-50/60'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rec-portal" className={`font-serif text-lg font-semibold ${abiertas.length ? 'text-alerta' : 'text-green-800'}`}>
          {abiertas.length ? `Tienes ${abiertas.length} recuperación${abiertas.length > 1 ? 'es' : ''} de asistencia por hacer` : 'Tus recuperaciones de asistencia están al día'}
        </h2>
        {lista.length > abiertas.length && (
          <button className="text-xs text-mariano underline" onClick={() => setVerTodas(!verTodas)}>{verTodas ? 'Ver solo las pendientes' : `Ver todas (${lista.length})`}</button>
        )}
      </div>
      <ul className="mt-3 space-y-2">
        {mostrar.map((r) => (
          <li key={r.id} className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm">
                <span className="font-semibold">{r.espacio.etiqueta} · {r.espacio.nombre}</span>
                <span className="block text-xs text-slate-500">{r.sesion ? `Falta del ${fechaCorta(r.sesion.fecha)}${r.sesion.tema ? ` · ${r.sesion.tema}` : ''}` : 'No asististe'}</span>
              </p>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADOS_REC[r.estado].clase}`}>
                {ESTADOS_REC[r.estado].nombre}{r.nota !== null ? ` · ${fmt(r.nota)}` : ''}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-tinta">{r.forma}</p>
            {r.detalle && <p className="text-sm text-slate-700">{r.detalle}</p>}
            {r.fecha_limite && r.estado === 'asignada' && (
              <p className={`mt-1 text-xs font-semibold ${vencida(r) ? 'text-alerta' : 'text-slate-600'}`}>
                {vencida(r) ? `Venció el ${fechaCorta(r.fecha_limite)}: habla con tu formador.` : `Entrégala a más tardar el ${fechaCorta(r.fecha_limite)}.`}
              </p>
            )}
            {r.observacion && <p className="mt-1 text-xs text-slate-500">Formador: {r.observacion}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}

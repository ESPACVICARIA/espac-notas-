import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/notas'
import { ESCALA } from './AutoevaluacionEditor'

const fecha = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })

function Formulario({ auto, documento, clave, volver, alEnviar }) {
  const [resp, setResp] = useState(auto.mi_respuesta?.respuestas ?? {})
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const faltan = auto.preguntas.filter((p) => p.tipo === 'escala' && !resp[p.id]).length

  async function enviar(e) {
    e.preventDefault()
    if (faltan) { setError(`Te falta responder ${faltan} pregunta(s) de valoración.`); return }
    setEnviando(true); setError('')
    const { data, error: err } = await supabase.rpc('responder_autoevaluacion', {
      p_documento: documento, p_clave: clave, p_autoevaluacion: auto.id, p_respuestas: resp,
    })
    setEnviando(false)
    if (err) setError('No se pudo enviar. Revisa tu conexión e intenta de nuevo.')
    else if (data?.error) setError(data.error)
    else alEnviar(data.nota)
  }

  return (
    <form onSubmit={enviar} className="space-y-5">
      <button type="button" onClick={volver} className="text-sm text-mariano hover:underline">Volver a mis autoevaluaciones</button>
      <div>
        <p className="text-sm text-slate-500">Semestre {auto.espacio.semestre} · {auto.espacio.etiqueta}</p>
        <h2 className="text-2xl font-semibold">{auto.espacio.nombre}</h2>
        {auto.instrucciones && <p className="mt-2 max-w-2xl text-sm text-slate-600">{auto.instrucciones}</p>}
        {auto.cierra && <p className="mt-1 text-xs text-amber-700">Puedes responderla hasta el {fecha(auto.cierra)}.</p>}
      </div>

      <ol className="space-y-4">
        {auto.preguntas.map((p, i) => (
          <li key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="mb-3 font-medium">{i + 1}. {p.texto}</p>
            {p.tipo === 'escala' ? (
              <div role="radiogroup" aria-label={p.texto} className="grid grid-cols-5 gap-2">
                {ESCALA.map(([v, t]) => {
                  const marcado = String(resp[p.id]) === String(v)
                  return (
                    <label key={v} className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 text-center text-xs ${marcado ? 'border-mariano bg-cielo font-semibold text-mariano' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name={p.id} value={v} className="sr-only" checked={marcado}
                        onChange={() => setResp({ ...resp, [p.id]: String(v) })} />
                      <span className="text-lg">{v}</span>
                      <span>{t}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <textarea rows={3} className="campo" maxLength={3000} aria-label={p.texto}
                value={resp[p.id] ?? ''} onChange={(e) => setResp({ ...resp, [p.id]: e.target.value })} />
            )}
          </li>
        ))}
      </ol>

      {error && <p className="text-sm text-alerta">{error}</p>}
      <button className="btn" disabled={enviando}>{enviando ? 'Enviando…' : auto.mi_respuesta ? 'Actualizar mis respuestas' : 'Enviar autoevaluación'}</button>
    </form>
  )
}

export default function PortalAutoevaluaciones({ documento, clave, alEnviar, alContar }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const [abierta, setAbierta] = useState(null)
  const [aviso, setAviso] = useState('')

  async function cargar() {
    const { data, error: err } = await supabase.rpc('portal_autoevaluaciones', { p_documento: documento, p_clave: clave })
    if (err || data?.error) { setError(data?.error ?? 'No se pudieron cargar las autoevaluaciones.'); setLista([]); return }
    setLista(data.autoevaluaciones ?? [])
    alContar?.((data.autoevaluaciones ?? []).filter((a) => a.disponible && !a.mi_respuesta).length)
  }
  useEffect(() => { cargar() }, [documento, clave])

  if (lista === null) return <p className="text-slate-500">Cargando…</p>
  if (error) return <p className="text-sm text-alerta">{error}</p>

  if (abierta) {
    return (
      <Formulario auto={abierta} documento={documento} clave={clave} volver={() => setAbierta(null)}
        alEnviar={async (nota) => {
          setAbierta(null)
          setAviso(`¡Gracias! Tu autoevaluación quedó enviada. Tu nota es ${fmt(nota)} y ya aparece en tus notas.`)
          await cargar()
          alEnviar?.()
        }} />
    )
  }

  if (!lista.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">No tienes autoevaluaciones abiertas por ahora. Tu formador te avisará cuando haya una.</p>
  }

  return (
    <div className="space-y-4">
      {aviso && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{aviso}</p>}
      {lista.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Semestre {a.espacio.semestre} · {a.espacio.etiqueta}</p>
            <p className="font-medium">{a.espacio.nombre}</p>
            <p className="text-xs">
              {a.mi_respuesta
                ? <span className="text-green-700">Enviada · nota {fmt(a.mi_respuesta.nota)}</span>
                : a.disponible ? <span className="text-amber-700">Pendiente{a.cierra ? ` · hasta el ${fecha(a.cierra)}` : ''}</span>
                : <span className="text-slate-500">Cerrada</span>}
            </p>
          </div>
          {a.disponible && (
            <button className={a.mi_respuesta ? 'btn-sec' : 'btn'} onClick={() => { setAviso(''); setAbierta(a) }}>
              {a.mi_respuesta ? 'Revisar o cambiar' : 'Responder'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

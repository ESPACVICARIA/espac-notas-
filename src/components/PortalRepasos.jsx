import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/notas'

const respondida = (p, r) =>
  p.tipo === 'relacionar' ? p.izquierda.every((iz) => r?.[iz]) : r !== undefined && String(r).trim() !== ''

function Pregunta({ p, valor, cambiar }) {
  if (p.tipo === 'opcion') {
    return (
      <div role="radiogroup" aria-label={p.enunciado} className="grid gap-2">
        {p.opciones.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={valor === o} onClick={() => cambiar(o)}
            className={`rounded-lg border px-4 py-3 text-left ${valor === o ? 'border-mariano bg-cielo font-semibold text-mariano' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{o}</button>
        ))}
      </div>
    )
  }
  if (p.tipo === 'vf') {
    return (
      <div role="radiogroup" aria-label={p.enunciado} className="grid grid-cols-2 gap-3">
        {[['true', 'Verdadero'], ['false', 'Falso']].map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={valor === v} onClick={() => cambiar(v)}
            className={`rounded-lg border px-4 py-4 text-center text-lg font-semibold ${valor === v ? 'border-mariano bg-cielo text-mariano' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>{t}</button>
        ))}
      </div>
    )
  }
  if (p.tipo === 'completar') {
    return <input className="campo text-lg" autoFocus placeholder="Escribe tu respuesta" aria-label={p.enunciado}
      value={valor ?? ''} onChange={(e) => cambiar(e.target.value)} />
  }
  const v = valor ?? {}
  return (
    <div className="space-y-3">
      {p.izquierda.map((iz) => (
        <div key={iz} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1.3fr] sm:items-center">
          <span className="font-medium">{iz}</span>
          <select className="campo" aria-label={`Pareja de ${iz}`} value={v[iz] ?? ''} onChange={(e) => cambiar({ ...v, [iz]: e.target.value })}>
            <option value="">Elige…</option>
            {p.derecha.map((d) => <option key={d} value={d} disabled={Object.entries(v).some(([k, x]) => x === d && k !== iz)}>{d}</option>)}
          </select>
        </div>
      ))}
    </div>
  )
}

function Jugar({ repaso, documento, clave, volver, alTerminar }) {
  const [i, setI] = useState(0)
  const [resp, setResp] = useState({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [fin, setFin] = useState(null)
  const preguntas = repaso.preguntas
  const p = preguntas[i]
  const listas = preguntas.filter((q) => respondida(q, resp[q.id])).length

  async function enviar() {
    setEnviando(true); setError('')
    const { data, error: err } = await supabase.rpc('responder_repaso', { p_documento: documento, p_clave: clave, p_repaso: repaso.id, p_respuestas: resp })
    setEnviando(false)
    if (err) { setError('No se pudo enviar. Revisa tu conexión e intenta de nuevo.'); return }
    if (data?.error) { setError(data.error); return }
    setFin(data)
    alTerminar?.()
  }

  if (fin) {
    const revision = Object.fromEntries(fin.revision.map((r) => [r.id, r]))
    const excelente = fin.correctas === fin.total
    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-tinta p-6 text-center text-white">
          <p className="text-sm uppercase tracking-wider text-blue-200">{excelente ? '¡Excelente!' : fin.nota >= 3 ? '¡Muy bien!' : 'Sigue repasando'}</p>
          <p className="my-2 font-serif text-5xl font-semibold tabular-nums">{fmt(fin.nota)}</p>
          <p className="text-blue-100">{fin.correctas} de {fin.total} respuestas correctas</p>
          {repaso.cuenta_nota && (
            <p className="mt-3 text-sm text-oro">
              Nota que queda en tus Contenidos: {fmt(fin.nota_que_cuenta)} ({repaso.criterio === 'primero' ? 'tu primer intento' : 'tu mejor intento'})
            </p>
          )}
        </div>
        <h3 className="text-lg font-semibold">Revisa tus respuestas</h3>
        <ol className="space-y-3">
          {preguntas.map((q, k) => {
            const r = revision[q.id]
            const bien = r?.puntos === 1
            const parcial = r && r.puntos > 0 && r.puntos < 1
            return (
              <li key={q.id} className={`rounded-lg border bg-white p-4 ${bien ? 'border-green-300' : parcial ? 'border-amber-300' : 'border-red-300'}`}>
                <p className="font-medium">
                  <span className={bien ? 'text-green-700' : parcial ? 'text-amber-700' : 'text-alerta'}>{bien ? '✓' : parcial ? '◐' : '✗'}</span> {k + 1}. {q.enunciado}
                </p>
                {!bien && r?.solucion && <p className="mt-1 text-sm"><span className="text-slate-500">Respuesta correcta:</span> <strong>{r.solucion}</strong></p>}
                {r?.explicacion && <p className="mt-1 text-sm text-slate-600">{r.explicacion}</p>}
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap gap-3">
          <button className="btn" onClick={() => { setFin(null); setResp({}); setI(0) }}>Intentar de nuevo</button>
          <button className="btn-sec" onClick={volver}>Volver a mis repasos</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <button onClick={volver} className="text-sm text-mariano hover:underline">Salir del repaso</button>
      <div>
        <p className="text-xs text-slate-500">{repaso.espacio.etiqueta} · {repaso.espacio.nombre}</p>
        <h2 className="text-2xl font-semibold">{repaso.titulo}</h2>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Pregunta {i + 1} de {preguntas.length}</span><span>{listas} respondidas</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={preguntas.length} aria-valuenow={listas}>
          <div className="h-full bg-mariano transition-all" style={{ width: `${(listas / preguntas.length) * 100}%` }} />
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-lg font-medium">{p.enunciado}</p>
        <Pregunta key={p.id} p={p} valor={resp[p.id]} cambiar={(v) => setResp({ ...resp, [p.id]: v })} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-sec" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
        {i < preguntas.length - 1 ? (
          <button className="btn" onClick={() => setI(i + 1)}>{respondida(p, resp[p.id]) ? 'Siguiente' : 'Saltar'}</button>
        ) : (
          <button className="btn" disabled={enviando} onClick={() => {
            const faltan = preguntas.length - listas
            if (faltan && !confirm(`Te faltan ${faltan} pregunta(s). Las que no respondas cuentan como incorrectas. ¿Enviar de todas formas?`)) return
            enviar()
          }}>{enviando ? 'Calificando…' : 'Terminar y ver mi nota'}</button>
        )}
        {error && <p className="text-sm text-alerta">{error}</p>}
      </div>
      <div className="flex flex-wrap gap-1" aria-label="Ir a una pregunta">
        {preguntas.map((q, k) => (
          <button key={q.id} onClick={() => setI(k)} aria-label={`Pregunta ${k + 1}`}
            className={`h-8 w-8 rounded-full text-xs font-semibold ${k === i ? 'bg-mariano text-white' : respondida(q, resp[q.id]) ? 'bg-cielo text-mariano' : 'bg-slate-100 text-slate-500'}`}>{k + 1}</button>
        ))}
      </div>
    </div>
  )
}

export default function PortalRepasos({ documento, clave, alTerminar }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState('')
  const [jugando, setJugando] = useState(null)

  async function cargar() {
    const { data, error: err } = await supabase.rpc('portal_repasos', { p_documento: documento, p_clave: clave })
    if (err || data?.error) { setError(data?.error ?? 'No se pudieron cargar los repasos.'); setLista([]); return }
    setLista(data.repasos ?? [])
  }
  useEffect(() => { cargar() }, [documento, clave])

  if (lista === null) return <p className="text-slate-500">Cargando…</p>
  if (error) return <p className="text-sm text-alerta">{error}</p>
  if (jugando) {
    return <Jugar repaso={jugando} documento={documento} clave={clave}
      volver={() => { setJugando(null); cargar() }} alTerminar={alTerminar} />
  }
  if (!lista.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">No hay repasos abiertos por ahora. Tu formador te avisará cuando publique uno.</p>
  }
  return (
    <div className="space-y-3">
      {lista.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Semestre {r.espacio.semestre} · {r.espacio.etiqueta}</p>
            <p className="font-medium">{r.titulo}</p>
            {r.descripcion && <p className="text-sm text-slate-600">{r.descripcion}</p>}
            <p className="mt-1 text-xs">
              {r.preguntas.length} preguntas
              {r.intentos > 0 && <> · <span className="text-green-700">{r.intentos} intento(s), mejor nota {fmt(r.mejor)}</span></>}
              {r.cuenta_nota && <> · <span className="text-oro">Cuenta como nota{r.intentos > 0 ? ` (${fmt(r.nota_que_cuenta)})` : ''}</span></>}
            </p>
          </div>
          <button className={r.intentos ? 'btn-sec' : 'btn'} onClick={() => setJugando(r)}>{r.intentos ? 'Repasar de nuevo' : 'Empezar'}</button>
        </div>
      ))}
    </div>
  )
}

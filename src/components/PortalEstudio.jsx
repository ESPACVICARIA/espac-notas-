import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import BloquesVista from './BloquesVista'
import ListaDocumentos from './ListaDocumentos'
import { esCalificable, notaLeccion } from '../lib/bloques'

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toFixed(1).replace('.', ','))

// Entrega de las actividades con nota de una lección
function Entrega({ leccion, resultados, documento, clave, alEntregar, otraVez }) {
  const cal = (leccion.bloques ?? []).filter(esCalificable)
  const [enviando, setEnviando] = useState(false)
  const [respuesta, setRespuesta] = useState(null)
  const hechas = cal.filter((b) => resultados[b.id] !== undefined).length
  const nota = notaLeccion(leccion.bloques ?? [], resultados)

  async function entregar() {
    if (hechas < cal.length && !confirm(`Te faltan ${cal.length - hechas} actividad(es). Las que no hagas cuentan como 0. ¿Entregar de todos modos?`)) return
    setEnviando(true)
    const { data, error } = await supabase.rpc('entregar_leccion', { p_documento: documento, p_clave: clave, p_leccion: leccion.id, p_resultados: resultados })
    setEnviando(false)
    if (error) { setRespuesta({ error: /entregar_leccion/.test(error.message) ? 'La entrega de lecciones aún no está activada. Avísale a tu formador.' : 'No se pudo entregar. Revisa tu conexión e intenta de nuevo.' }); return }
    setRespuesta(data)
    if (data?.ok) alEntregar(data)
  }

  if (respuesta?.ok) {
    return (
      <div role="status" className="mt-8 rounded-xl bg-tinta p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wider text-oro">Entregada</p>
        <p className="mt-1 font-serif text-3xl">Tu nota: {fmt(respuesta.nota)}</p>
        <p className="mt-1 text-sm text-blue-100">
          {respuesta.cuenta
            ? `Nota que cuenta en tu planilla (${leccion.criterio === 'primero' ? 'primer intento' : 'mejor intento'}): ${fmt(respuesta.nota_que_cuenta)}`
            : 'Tu formador puede ver tu resultado.'}
        </p>
        <button className="mt-3 rounded-md bg-oro px-4 py-1.5 text-sm font-semibold text-white" onClick={() => { setRespuesta(null); otraVez() }}>Volver a hacer las actividades</button>
      </div>
    )
  }
  return (
    <div className="mt-8 rounded-xl border-2 border-oro/50 bg-amber-50/50 p-5">
      <p className="font-semibold text-tinta">Actividades de esta lección: {hechas} de {cal.length} hechas</p>
      <p className="mt-1 text-sm text-slate-600">
        Cada actividad cuenta con tu primer intento. Nota hasta ahora: <strong>{fmt(nota)}</strong>.
        {leccion.cuenta_nota ? ' Al entregar, tu nota pasa a la planilla de Contenidos.' : ''}
      </p>
      <button className="btn mt-3" disabled={enviando || !hechas} onClick={entregar}>{enviando ? 'Entregando…' : 'Entregar mis actividades'}</button>
      {respuesta?.error && <p className="mt-2 text-sm text-alerta">{respuesta.error}</p>}
    </div>
  )
}

const TIPO = { modulo: 'Módulo', retiro: 'Retiro', seminario: 'Seminario' }

function Modulo({ m, documento, clave, volver, alLeer, alReflexion, alEntregar, irARepasos }) {
  const [actualId, setActualId] = useState((m.lecciones.find((l) => !l.leida) ?? m.lecciones[0])?.id ?? null)
  const actual = m.lecciones.find((l) => l.id === actualId) ?? null
  const setActual = (l) => setActualId(l?.id ?? null)
  const [marcando, setMarcando] = useState(false)
  const i = actual ? m.lecciones.findIndex((l) => l.id === actual.id) : -1
  const leidas = m.lecciones.filter((l) => l.leida).length
  const [resultados, setResultados] = useState({})
  const [intento, setIntento] = useState(0)
  const conNota = (actual?.bloques ?? []).some(esCalificable)

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setResultados({}); setIntento(0) }, [actual?.id])

  async function guardarReflexion(bloqueId, texto) {
    const { data, error } = await supabase.rpc('guardar_reflexion', {
      p_documento: documento, p_clave: clave, p_leccion: actual.id, p_bloque: bloqueId, p_texto: texto,
    })
    if (error) return 'No se pudo guardar. Revisa tu conexión e intenta de nuevo.'
    if (data?.error) return data.error
    alReflexion(m.id, actual.id, bloqueId, texto)
    return null
  }

  async function marcar() {
    setMarcando(true)
    const { data } = await supabase.rpc('marcar_leccion_leida', { p_documento: documento, p_clave: clave, p_leccion: actual.id })
    setMarcando(false)
    if (data?.ok) {
      alLeer(m.id, actual.id)
      if (i < m.lecciones.length - 1) setActual(m.lecciones[i + 1])
    }
  }

  return (
    <div className="space-y-5">
      <button onClick={volver} className="text-sm text-mariano hover:underline">Volver a mis módulos</button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Semestre {m.semestre} · {m.etiqueta}</p>
          <h2 className="text-2xl font-semibold">{m.nombre}</h2>
        </div>
        {m.lecciones.length > 0 && <p className="text-sm text-slate-600">{leidas} de {m.lecciones.length} lecciones leídas</p>}
      </div>

      {m.lecciones.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
          <nav aria-label="Lecciones del módulo" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {m.lecciones.map((l, k) => (
              <button key={l.id} onClick={() => setActual(l)} aria-current={actual?.id === l.id ? 'page' : undefined}
                className={`shrink-0 rounded-lg border px-3 py-2 text-left text-sm ${actual?.id === l.id ? 'border-mariano bg-cielo font-semibold text-mariano' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <span className="mr-1">{l.leida ? '✓' : `${k + 1}.`}</span>{l.titulo}
              </button>
            ))}
          </nav>
          {actual && (
            <article className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
              <p className="text-xs text-slate-500">Lección {i + 1} de {m.lecciones.length}</p>
              <h3 className="font-serif text-2xl font-semibold">{actual.titulo}</h3>
              {actual.resumen && <p className="mt-1 text-slate-600">{actual.resumen}</p>}
              {conNota && (actual.cuenta_nota || actual.intentos > 0) && (
                <p className="mt-3 inline-flex flex-wrap gap-x-3 rounded-lg bg-cielo px-3 py-1.5 text-sm text-tinta">
                  {actual.cuenta_nota && <span className="font-semibold">★ Esta lección cuenta como nota</span>}
                  {actual.intentos > 0 && <span>Entregada {actual.intentos} {actual.intentos === 1 ? 'vez' : 'veces'} · nota: {fmt(actual.nota_que_cuenta)}</span>}
                </p>
              )}
              <div className="mt-6">
                <BloquesVista key={`${actual.id}-${intento}`} bloques={actual.bloques ?? []} reflexiones={actual.reflexiones ?? {}} onReflexion={guardarReflexion}
                  onResultado={(id, p) => setResultados((r) => (id in r ? r : { ...r, [id]: p }))} />
              </div>
              {conNota && (
                <Entrega key={`${actual.id}-${intento}`} leccion={actual} resultados={resultados} documento={documento} clave={clave}
                  alEntregar={(d) => alEntregar(m.id, actual.id, d)}
                  otraVez={() => { setResultados({}); setIntento((n) => n + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
              )}
              <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
                {i > 0 && <button className="btn-sec" onClick={() => setActual(m.lecciones[i - 1])}>Anterior</button>}
                {actual.leida ? (
                  i < m.lecciones.length - 1
                    ? <button className="btn" onClick={() => setActual(m.lecciones[i + 1])}>Siguiente lección</button>
                    : <span className="text-sm font-semibold text-green-700">✓ Terminaste las lecciones de este módulo</span>
                ) : (
                  <button className="btn" disabled={marcando} onClick={marcar}>{marcando ? 'Guardando…' : i < m.lecciones.length - 1 ? 'Ya la leí, siguiente' : 'Ya la leí'}</button>
                )}
                {m.repasos > 0 && <button className="btn-sec ml-auto" onClick={irARepasos}>Practicar con el repaso</button>}
              </div>
            </article>
          )}
        </div>
      )}

      {m.documentos.length > 0 && (
        <div>
          <h3 className="mb-2 text-lg font-semibold">Material del módulo</h3>
          <ListaDocumentos documentos={m.documentos.map((d) => ({ ...d, semestre: m.semestre }))} />
        </div>
      )}
      {!m.lecciones.length && !m.documentos.length && (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Tu formador aún no ha publicado contenido para este módulo.</p>
      )}
    </div>
  )
}

export default function PortalEstudio({ documento, clave, irARepasos }) {
  const [modulos, setModulos] = useState(null)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(null)

  useEffect(() => {
    supabase.rpc('portal_estudio', { p_documento: documento, p_clave: clave }).then(({ data, error: err }) => {
      if (err || data?.error) { setError(data?.error ?? 'No se pudo cargar el contenido de estudio.'); setModulos([]); return }
      setModulos(data.modulos ?? [])
    })
  }, [documento, clave])

  const alReflexion = (mid, lid, bid, texto) => setModulos((ms) => ms.map((m) => (m.id !== mid ? m
    : { ...m, lecciones: m.lecciones.map((l) => (l.id === lid ? { ...l, reflexiones: { ...(l.reflexiones ?? {}), [bid]: texto } } : l)) })))
  const alEntregar = (mid, lid, d) => setModulos((ms) => ms.map((m) => (m.id !== mid ? m
    : { ...m, lecciones: m.lecciones.map((l) => (l.id === lid ? { ...l, intentos: d.intentos, nota_que_cuenta: d.nota_que_cuenta } : l)) })))
  const alLeer = (mid, lid) => setModulos((ms) => ms.map((m) => (m.id !== mid ? m
    : { ...m, lecciones: m.lecciones.map((l) => (l.id === lid ? { ...l, leida: true } : l)) })))

  if (modulos === null) return <p className="text-slate-500">Cargando…</p>
  if (error) return <p className="text-sm text-alerta">{error}</p>
  const m = modulos.find((x) => x.id === abierto)
  if (m) return <Modulo m={m} documento={documento} clave={clave} volver={() => setAbierto(null)} alLeer={alLeer} alReflexion={alReflexion} alEntregar={alEntregar} irARepasos={irARepasos} />

  const semestres = [...new Set(modulos.map((x) => x.semestre))].sort((a, b) => b - a)
  if (!semestres.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Aún no hay módulos de estudio disponibles para tu grupo.</p>
  }
  return (
    <div className="space-y-8">
      {semestres.map((s) => (
        <section key={s}>
          <h2 className="mb-3 font-serif text-xl font-semibold">Semestre {s}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.filter((x) => x.semestre === s).map((x) => {
              const n = x.lecciones.length
              const leidas = x.lecciones.filter((l) => l.leida).length
              const vacio = !n && !x.documentos.length
              return (
                <li key={x.id}>
                  <button onClick={() => setAbierto(x.id)} disabled={vacio}
                    className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-mariano disabled:cursor-default disabled:opacity-60 disabled:hover:border-slate-200">
                    <span className="text-xs font-semibold uppercase tracking-wide text-oro">{TIPO[x.tipo] ?? ''} · {x.etiqueta}</span>
                    <span className="mt-1 font-serif text-lg font-semibold leading-snug">{x.nombre}</span>
                    <span className="mt-auto pt-3 text-xs text-slate-500">
                      {vacio ? 'Próximamente' : [n && `${n} lección${n > 1 ? 'es' : ''}`, x.documentos.length && `${x.documentos.length} material${x.documentos.length > 1 ? 'es' : ''}`, x.repasos && 'repaso'].filter(Boolean).join(' · ')}
                    </span>
                    {n > 0 && (
                      <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-label={`${leidas} de ${n} lecciones leídas`}>
                        <span className={`block h-full ${leidas === n ? 'bg-oro' : 'bg-mariano'}`} style={{ width: `${(leidas / n) * 100}%` }} />
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export const SIN_COHORTE = 'sin'
const SIN_CENTRO = 'ninguno'

// Colores de las tarjetas (uno fijo por cohorte)
const COLORES = [
  { fondo: '#FDE7E9', tinta: '#D93D4A' }, { fondo: '#FDF1DC', tinta: '#D98A1A' }, { fondo: '#DDF5E5', tinta: '#2E9E5B' },
  { fondo: '#E1ECFE', tinta: '#3B6FE0' }, { fondo: '#FBE4F1', tinta: '#C93B8F' }, { fondo: '#ECE6FD', tinta: '#7C5CE0' },
  { fondo: '#DDF3F2', tinta: '#11908C' },
]
const GRIS = { fondo: '#EEF1F5', tinta: '#64748B' }
export const colorDe = (id) => (id === SIN_COHORTE ? GRIS : COLORES[Math.abs(Number(id) || 0) % COLORES.length])

export function IconoGrupo({ className = 'h-7 w-7' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 10 12 5 2 10l10 5 10-5Z" /><path d="M6 12v5c3 2 9 2 12 0v-5" />
    </svg>
  )
}

function Contenido({ g, col, organizar }) {
  return (
    <>
      <span aria-hidden="true" className="absolute right-4 top-4 h-3 w-3 rounded-full" style={{ background: col.tinta }} />
      <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: col.fondo, color: col.tinta }}>
        <IconoGrupo />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate pr-4 font-serif text-lg font-semibold leading-tight text-tinta">{g.nombre}</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {[g.anio && `Año ${g.anio}`, g.semestre_actual && `Semestre ${g.semestre_actual} en curso`].filter(Boolean).join(' · ') || 'Estudiantes sin grupo asignado'}
        </span>
        <span className="mt-3 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-tinta">{g.activos} activo(s)</span>
          {g.total > g.activos && <span className="rounded-full bg-slate-50 px-2.5 py-1 text-slate-500">{g.total - g.activos} inactivo(s)</span>}
        </span>
      </span>
      {!organizar && (
        <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-mariano" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
      )}
    </>
  )
}

// Tarjetas de grupos (cohortes) organizadas por centro.
// En modo «Organizar centros» (solo coordinación) se arrastran de un centro a otro.
export default function GruposCentros({ lista, cohortes, centros, filtroCentro, admin, abrirGrupo, alCambiar, avisar }) {
  const [organizar, setOrganizar] = useState(false)
  const [arrastre, setArrastre] = useState(null) // { g, x, y, sobre }
  const [mover, setMover] = useState(null) // { g, destino }
  const [trabajando, setTrabajando] = useState(false)
  const dialogo = useRef(null)

  const secciones = useMemo(() => {
    const cuenta = new Map()
    for (const e of lista) {
      const k = e.cohorte_id ?? SIN_COHORTE
      const c = cuenta.get(k) ?? { total: 0, activos: 0 }
      c.total++; if (e.estado === 'activo') c.activos++
      cuenta.set(k, c)
    }
    const tarjeta = (c) => ({ ...c, ...(cuenta.get(c.id) ?? { total: 0, activos: 0 }) })
    const res = [...centros, { id: null, nombre: 'Sin centro' }]
      .filter((ce) => organizar || !filtroCentro || (filtroCentro === SIN_COHORTE ? ce.id === null : String(ce.id) === filtroCentro))
      .map((ce) => ({ centro: ce, grupos: cohortes.filter((c) => (c.centro_id ?? null) === ce.id).map(tarjeta) }))
      // Organizando se ven todos los centros, aunque estén vacíos, para poder soltar grupos en ellos
      .filter((x) => x.grupos.length || organizar)
    if (!organizar && cuenta.has(SIN_COHORTE) && (!filtroCentro || filtroCentro === SIN_COHORTE)) {
      res.push({ centro: { id: 'sin-cohorte', nombre: 'Por organizar' }, grupos: [{ id: SIN_COHORTE, nombre: 'Sin cohorte', ...cuenta.get(SIN_COHORTE) }] })
    }
    return res
  }, [lista, cohortes, centros, filtroCentro, organizar])

  const nombreCentro = (id) => (id === null ? 'Sin centro' : centros.find((c) => c.id === id)?.nombre ?? '')

  // Arrastrar con dedo o ratón; las secciones de centro llevan data-centro
  function iniciar(e, g) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target.closest('select, button')) return
    // Con el dedo solo se arrastra desde la manija, para poder desplazar la página tocando la tarjeta
    if (e.pointerType !== 'mouse' && !e.target.closest('[data-asa]')) return
    const x0 = e.clientX, y0 = e.clientY
    let activo = false
    const destinoEn = (x, y) => {
      const el = document.elementFromPoint(x, y)?.closest('[data-centro]')
      return el ? (el.dataset.centro === SIN_CENTRO ? null : Number(el.dataset.centro)) : undefined
    }
    const moverPuntero = (ev) => {
      if (!activo && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) activo = true
      if (activo) setArrastre({ g, x: ev.clientX, y: ev.clientY, sobre: destinoEn(ev.clientX, ev.clientY) })
    }
    const fin = (ev) => {
      window.removeEventListener('pointermove', moverPuntero)
      window.removeEventListener('pointerup', fin)
      window.removeEventListener('pointercancel', fin)
      setArrastre(null)
      if (!activo || ev.type !== 'pointerup') return
      const destino = destinoEn(ev.clientX, ev.clientY)
      if (destino !== undefined && destino !== (g.centro_id ?? null)) setMover({ g, destino })
    }
    window.addEventListener('pointermove', moverPuntero)
    window.addEventListener('pointerup', fin)
    window.addEventListener('pointercancel', fin)
  }

  useEffect(() => {
    if (!mover) return
    dialogo.current?.querySelector('button')?.focus()
    const esc = (e) => e.key === 'Escape' && !trabajando && setMover(null)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [mover, trabajando])

  async function confirmar(conEstudiantes) {
    const { g, destino } = mover
    setTrabajando(true)
    const r1 = await supabase.from('cohortes').update({ centro_id: destino }).eq('id', g.id)
    let r2 = { error: null }
    if (!r1.error && conEstudiantes) r2 = await supabase.from('estudiantes').update({ centro_id: destino }).eq('cohorte_id', g.id)
    setTrabajando(false)
    setMover(null)
    const error = r1.error || r2.error
    avisar(error
      ? { tipo: 'error', texto: `No se pudo mover el grupo: ${error.message}` }
      : { tipo: 'ok', texto: `«${g.nombre}» ahora está ${destino === null ? 'sin centro' : `en el centro ${nombreCentro(destino)}`}${conEstudiantes ? `, junto con sus ${g.total} estudiante(s)` : ''}.` })
    await alCambiar()
  }

  return (
    <>
      {admin && (
        <div className={`mb-5 flex flex-wrap items-center gap-3 rounded-2xl border p-3 ${organizar ? 'border-oro/50 bg-amber-50/60' : 'border-transparent'}`}>
          <button onClick={() => setOrganizar(!organizar)} aria-pressed={organizar}
            className={organizar ? 'btn' : 'btn-sec'}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
            {organizar ? 'Listo' : 'Organizar centros'}
          </button>
          {organizar && <p className="text-sm text-slate-700">Arrastra cada grupo a su centro (en celular, desde ⠿), o usa la lista «Mover a» de la tarjeta.</p>}
        </div>
      )}

      <div className="space-y-8">
        {secciones.map(({ centro, grupos }) => {
          const idDrop = centro.id === null ? SIN_CENTRO : centro.id
          const soltable = organizar && centro.id !== 'sin-cohorte'
          const encima = arrastre && arrastre.sobre !== undefined && (arrastre.sobre ?? SIN_CENTRO) === idDrop
          return (
            <section key={centro.id ?? 'sin'} aria-labelledby={`centro-${centro.id ?? 'sin'}`}
              data-centro={soltable ? idDrop : undefined}
              className={soltable ? `rounded-2xl border-2 border-dashed p-4 transition-colors ${encima ? 'border-mariano bg-cielo/70' : arrastre ? 'border-slate-300 bg-white/60' : 'border-slate-200'}` : ''}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 id={`centro-${centro.id ?? 'sin'}`} className="font-serif text-xl font-semibold">
                  {typeof centro.id === 'number' ? `Centro ${centro.nombre}` : centro.nombre}
                </h2>
                <span className="text-sm text-slate-500">{grupos.length} grupo(s) · {grupos.reduce((n, g) => n + g.activos, 0)} activos</span>
              </div>
              {!grupos.length ? (
                <p className="rounded-xl py-6 text-center text-sm text-slate-400">{arrastre ? 'Suelta aquí el grupo' : 'Sin grupos. Arrastra uno hasta aquí.'}</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {grupos.map((g) => {
                    const col = colorDe(g.id)
                    const levantado = arrastre?.g.id === g.id
                    return (
                      <li key={g.id}>
                        {organizar && g.id !== SIN_COHORTE ? (
                          <div onPointerDown={(e) => iniciar(e, g)}
                            className={`w-full cursor-grab select-none rounded-2xl border border-slate-200 bg-white shadow-sm ${levantado ? 'opacity-40' : ''}`}>
                            <div className="relative flex items-center gap-4 p-5 pb-4">
                              <Contenido g={g} col={col} organizar />
                            </div>
                            <label className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500">
                              <span data-asa className="-my-2 -ml-2 flex touch-none items-center gap-1.5 rounded-lg p-2 hover:bg-slate-50" aria-hidden="true">
                                <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor"><circle cx="7" cy="5" r="1.4" /><circle cx="13" cy="5" r="1.4" /><circle cx="7" cy="10" r="1.4" /><circle cx="13" cy="10" r="1.4" /><circle cx="7" cy="15" r="1.4" /><circle cx="13" cy="15" r="1.4" /></svg>
                                Arrastra, o mover a
                              </span>
                              <span className="sr-only">Mover «{g.nombre}» a</span>
                              <select className="cursor-pointer rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-tinta" value={g.centro_id ?? SIN_CENTRO}
                                onChange={(e) => setMover({ g, destino: e.target.value === SIN_CENTRO ? null : Number(e.target.value) })}>
                                {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                <option value={SIN_CENTRO}>Sin centro</option>
                              </select>
                            </label>
                          </div>
                        ) : (
                          <button onClick={() => abrirGrupo(g.id)}
                            className="group relative flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-mariano/20">
                            <Contenido g={g} col={col} />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {/* La tarjeta que va con el dedo o el ratón */}
      {arrastre && (
        <div aria-hidden="true" style={{ left: arrastre.x, top: arrastre.y }}
          className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xl ring-2 ring-mariano/30">
          <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: colorDe(arrastre.g.id).fondo, color: colorDe(arrastre.g.id).tinta }}><IconoGrupo className="h-5 w-5" /></span>
          <span className="font-serif font-semibold">{arrastre.g.nombre}</span>
        </div>
      )}

      {mover && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !trabajando && setMover(null)}>
          <div ref={dialogo} role="dialog" aria-modal="true" aria-labelledby="mover-titulo" onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="mover-titulo" className="font-serif text-xl font-semibold">
              Mover «{mover.g.nombre}» {mover.destino === null ? 'a «Sin centro»' : `al centro ${nombreCentro(mover.destino)}`}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {mover.g.total
                ? `Este grupo tiene ${mover.g.total} estudiante(s). ¿Cambiar también el centro de cada uno?`
                : 'Este grupo aún no tiene estudiantes.'}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {mover.g.total > 0 && (
                <button className="btn" disabled={trabajando} onClick={() => confirmar(true)}>
                  {trabajando ? 'Moviendo…' : 'Mover el grupo y sus estudiantes'}
                </button>
              )}
              <button className={mover.g.total ? 'btn-sec' : 'btn'} disabled={trabajando} onClick={() => confirmar(false)}>
                {mover.g.total ? 'Mover solo el grupo' : trabajando ? 'Moviendo…' : 'Mover el grupo'}
              </button>
              <button className="text-sm text-slate-500 underline" disabled={trabajando} onClick={() => setMover(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

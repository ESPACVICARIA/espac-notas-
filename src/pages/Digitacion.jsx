import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CAMPOS, definitiva, fmt, parsearNota, NOTA_MINIMA } from '../lib/notas'

export default function Digitacion({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [opciones, setOpciones] = useState([]) // [{cohorte_id, nombre, semestre}]
  const [espacios, setEspacios] = useState([])
  const [sel, setSel] = useState({ cohorte: '', semestre: '', espacio: '' })
  const [estudiantes, setEstudiantes] = useState([])
  const [valores, setValores] = useState({}) // {estId: {campo: texto}}
  const [sucios, setSucios] = useState(new Set())
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase.from('espacios').select('*').order('id').then(({ data }) => setEspacios(data ?? []))
    if (admin) {
      supabase.from('cohortes').select('id, nombre').order('anio', { ascending: false })
        .then(({ data }) => setOpciones((data ?? []).flatMap((c) => [1, 2, 3, 4].map((s) => ({ cohorte_id: c.id, nombre: c.nombre, semestre: s })))))
    } else {
      supabase.from('asignaciones').select('cohorte_id, semestre, cohortes(nombre)').eq('formador_id', perfil.id)
        .then(({ data }) => setOpciones((data ?? []).map((a) => ({ cohorte_id: a.cohorte_id, nombre: a.cohortes?.nombre, semestre: a.semestre }))))
    }
  }, [admin, perfil?.id])

  const cohortes = useMemo(() => [...new Map(opciones.map((o) => [o.cohorte_id, o.nombre])).entries()], [opciones])
  const semestres = opciones.filter((o) => String(o.cohorte_id) === sel.cohorte).map((o) => o.semestre)
  const espaciosSem = espacios.filter((e) => String(e.semestre) === sel.semestre)
  const espacio = espacios.find((e) => String(e.id) === sel.espacio)

  useEffect(() => {
    if (!sel.cohorte || !sel.espacio) { setEstudiantes([]); return }
    (async () => {
      const { data: ests } = await supabase.from('estudiantes').select('id, nombre_completo')
        .eq('cohorte_id', sel.cohorte).eq('estado', 'activo').order('nombre_completo')
      const ids = (ests ?? []).map((e) => e.id)
      const { data: ns } = ids.length
        ? await supabase.from('notas').select('*').eq('espacio_id', sel.espacio).in('estudiante_id', ids)
        : { data: [] }
      const mapa = Object.fromEntries((ns ?? []).map((n) => [n.estudiante_id, n]))
      setEstudiantes(ests ?? [])
      setValores(Object.fromEntries(ids.map((id) => [id,
        Object.fromEntries(CAMPOS.map(([k]) => [k, mapa[id]?.[k] != null ? String(mapa[id][k]).replace('.', ',') : '']))])))
      setSucios(new Set()); setMensaje(null)
    })()
  }, [sel.cohorte, sel.espacio])

  function cambiar(estId, campo, texto) {
    setValores((v) => ({ ...v, [estId]: { ...v[estId], [campo]: texto } }))
    setSucios((s) => new Set(s).add(estId))
  }

  const invalidas = estudiantes.some((e) => CAMPOS.some(([k]) => parsearNota(valores[e.id]?.[k] ?? '') === undefined))

  async function guardar() {
    setGuardando(true); setMensaje(null)
    const filas = [...sucios].map((estId) => ({
      estudiante_id: estId, espacio_id: Number(sel.espacio), actualizado_por: perfil.id, actualizado: new Date().toISOString(),
      ...Object.fromEntries(CAMPOS.map(([k]) => [k, parsearNota(valores[estId][k])])),
    }))
    const { error } = await supabase.from('notas').upsert(filas, { onConflict: 'estudiante_id,espacio_id' })
    setGuardando(false)
    if (error) setMensaje({ tipo: 'error', texto: `No se guardaron las notas: ${error.message}` })
    else { setSucios(new Set()); setMensaje({ tipo: 'ok', texto: `Notas guardadas para ${filas.length} estudiante(s).` }) }
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">Digitar notas</h1>
      <p className="mb-6 text-sm text-slate-500">Escala de 0,0 a 5,0. Deja la casilla vacía si esa nota no aplica: no cuenta en el promedio.</p>

      {opciones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {admin ? 'Crea una cohorte en Configuración para empezar.' : 'Aún no tienes grupos asignados. La coordinación debe asignarte una cohorte y un semestre.'}
        </p>
      ) : (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="etiqueta" htmlFor="c">Cohorte</label>
            <select id="c" className="campo" value={sel.cohorte} onChange={(e) => setSel({ cohorte: e.target.value, semestre: '', espacio: '' })}>
              <option value="">Selecciona</option>
              {cohortes.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="s">Semestre</label>
            <select id="s" className="campo" disabled={!sel.cohorte} value={sel.semestre} onChange={(e) => setSel({ ...sel, semestre: e.target.value, espacio: '' })}>
              <option value="">Selecciona</option>
              {semestres.map((s) => <option key={s} value={s}>Semestre {s}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="e">Módulo, retiro o seminario</label>
            <select id="e" className="campo" disabled={!sel.semestre} value={sel.espacio} onChange={(e) => setSel({ ...sel, espacio: e.target.value })}>
              <option value="">Selecciona</option>
              {espaciosSem.map((e) => <option key={e.id} value={e.id}>{e.etiqueta} · {e.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {espacio && (
        estudiantes.length === 0 ? (
          <p className="text-slate-500">Esta cohorte no tiene estudiantes activos.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="bg-tinta px-4 py-2 text-left font-serif text-base font-semibold text-white">
                  {espacio.etiqueta} · {espacio.nombre}
                </caption>
                <thead className="bg-cielo">
                  <tr><th className="p-2 text-left">Estudiante</th>{CAMPOS.map(([k, t]) => <th key={k} className="p-2">{t}</th>)}<th className="p-2">Definitiva</th></tr>
                </thead>
                <tbody>
                  {estudiantes.map((est) => {
                    const v = valores[est.id] ?? {}
                    const d = definitiva(Object.fromEntries(CAMPOS.map(([k]) => [k, parsearNota(v[k] ?? '') ?? null])))
                    return (
                      <tr key={est.id} className={`border-t border-slate-100 ${sucios.has(est.id) ? 'bg-amber-50' : ''}`}>
                        <td className="p-2 font-medium">{est.nombre_completo}</td>
                        {CAMPOS.map(([k, t]) => {
                          const mal = parsearNota(v[k] ?? '') === undefined
                          return (
                            <td key={k} className="p-2 text-center">
                              <input inputMode="decimal" aria-label={`${t} de ${est.nombre_completo}`}
                                className={`nota ${mal ? 'border-alerta ring-1 ring-alerta' : ''}`}
                                value={v[k] ?? ''} onChange={(e) => cambiar(est.id, k, e.target.value)} />
                            </td>
                          )
                        })}
                        <td className={`p-2 text-center font-semibold tabular-nums ${d !== null && d < NOTA_MINIMA ? 'text-alerta' : ''}`}>{fmt(d)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button className="btn" onClick={guardar} disabled={guardando || sucios.size === 0 || invalidas}>
                {guardando ? 'Guardando…' : 'Guardar notas'}
              </button>
              {invalidas && <p className="text-sm text-alerta">Hay notas fuera de la escala 0,0 a 5,0.</p>}
              {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
            </div>
          </>
        )
      )}
    </section>
  )
}

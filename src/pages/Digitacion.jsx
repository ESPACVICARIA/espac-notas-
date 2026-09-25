import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CAMPOS, definitiva, promedio, fmt, parsearNota, NOTA_MINIMA } from '../lib/notas'
import { ordenarEstudiantes, mostrarNombre, copiarColumna } from '../lib/planilla'
import Actividades from '../components/Actividades'
import ImportarNotas from '../components/ImportarNotas'
import AutoevaluacionEditor from '../components/AutoevaluacionEditor'

const aTexto = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','))

export default function Digitacion({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [opciones, setOpciones] = useState([])
  const [espacios, setEspacios] = useState([])
  const [sel, setSel] = useState({ cohorte: '', semestre: '', espacio: '' })
  const [crudos, setCrudos] = useState([])
  const [valores, setValores] = useState({})
  const [sucios, setSucios] = useState(new Set())
  const [numActividades, setNumActividades] = useState(0)
  const [autoEnLinea, setAutoEnLinea] = useState(false)
  const [vista, setVista] = useState('planilla')
  const [orden, setOrden] = useState('apellidos')
  const [copia, setCopia] = useState({})
  const [sobrescribir, setSobrescribir] = useState(false)
  const [notaVacias, setNotaVacias] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [formadores, setFormadores] = useState({})

  useEffect(() => {
    supabase.from('espacios').select('*').order('semestre').order('orden').order('id').then(({ data }) => setEspacios(data ?? []))
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
  const espaciosSem = espacios.filter((e) => String(e.semestre) === sel.semestre && e.activo !== false)
  const espacio = espacios.find((e) => String(e.id) === sel.espacio)
  const estudiantes = useMemo(() => ordenarEstudiantes(crudos, orden), [crudos, orden])
  const contenidosBloqueado = numActividades > 0
  // Columnas que se llenan solas: Contenidos (actividades) y Autoevaluación (en línea)
  const ORIGEN = { contenidos: 'de actividades', autoevaluacion: 'en línea' }
  const bloqueado = (k) => (k === 'contenidos' && contenidosBloqueado) || (k === 'autoevaluacion' && autoEnLinea)

  async function cargar() {
    if (!sel.cohorte || !sel.espacio) { setCrudos([]); return }
    const { data: ests } = await supabase.from('estudiantes').select('id, nombre_completo')
      .eq('cohorte_id', sel.cohorte).eq('estado', 'activo')
    const ids = (ests ?? []).map((e) => e.id)
    const [{ data: ns }, { count }, { count: numAuto }] = await Promise.all([
      ids.length ? supabase.from('notas').select('*').eq('espacio_id', sel.espacio).in('estudiante_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('actividades').select('id', { count: 'exact', head: true }).eq('cohorte_id', sel.cohorte).eq('espacio_id', sel.espacio),
      supabase.from('autoevaluaciones').select('id', { count: 'exact', head: true }).eq('cohorte_id', sel.cohorte).eq('espacio_id', sel.espacio),
    ])
    const mapa = Object.fromEntries((ns ?? []).map((n) => [n.estudiante_id, n]))
    setCrudos(ests ?? [])
    setValores(Object.fromEntries(ids.map((id) => [id, Object.fromEntries(CAMPOS.map(([k]) => [k, aTexto(mapa[id]?.[k])]))])))
    setNumActividades(count ?? 0)
    setAutoEnLinea((numAuto ?? 0) > 0)
    setSucios(new Set())
  }
  useEffect(() => { setMensaje(null); setCopia({}); cargar() }, [sel.cohorte, sel.espacio])
  useEffect(() => {
    if (!sel.cohorte) { setFormadores({}); return }
    supabase.rpc('formadores_cohorte', { p_cohorte: Number(sel.cohorte) }).then(({ data }) => setFormadores(data ?? {}))
  }, [sel.cohorte])

  function elegir(nuevo) {
    if (sucios.size && !confirm('Tienes notas sin guardar. ¿Salir sin guardarlas?')) return
    setSel(nuevo); if (vista !== 'importar' || !nuevo.semestre) setVista('planilla')
  }
  function cambiarVista(v) {
    if (v === vista) return
    if (sucios.size && !confirm('Tienes notas sin guardar en la planilla. ¿Continuar sin guardarlas?')) return
    if (v === 'planilla') cargar()
    setVista(v)
  }

  function cambiar(estId, campo, texto) {
    setValores((v) => ({ ...v, [estId]: { ...v[estId], [campo]: texto } }))
    setSucios((s) => new Set(s).add(estId))
    setMensaje(null)
  }

  function aplicarATodos(campo) {
    const texto = (copia[campo] ?? '').trim()
    if (parsearNota(texto) === undefined) { setMensaje({ tipo: 'error', texto: 'La nota a copiar debe estar entre 0,0 y 5,0.' }); return }
    if (texto === '' && !sobrescribir) return
    const { nuevo, cambiados } = copiarColumna({ estudiantes, valores, campo, texto, sobrescribir })
    setValores(nuevo)
    setSucios((s) => { const n = new Set(s); cambiados.forEach((id) => n.add(id)); return n })
    setMensaje(cambiados.length
      ? { tipo: 'ok', texto: `Copiado a ${cambiados.length} estudiante(s). Recuerda guardar.` }
      : { tipo: 'ok', texto: 'Todas las casillas ya tenían nota. Marca "reemplazar" si quieres sobrescribirlas.' })
  }

  // Llena todas las casillas vacías de la planilla (todas las columnas) sin tocar las que ya tienen nota
  function llenarVacias() {
    const texto = notaVacias.trim()
    if (texto === '' || parsearNota(texto) === undefined) { setMensaje({ tipo: 'error', texto: 'Escribe una nota entre 0,0 y 5,0 para llenar las casillas vacías.' }); return }
    let actuales = valores
    const cambiados = new Set()
    let casillas = 0
    for (const [k] of camposEditables) {
      for (const e of estudiantes) if (String(actuales[e.id]?.[k] ?? '').trim() === '') casillas++
      const r = copiarColumna({ estudiantes, valores: actuales, campo: k, texto, sobrescribir: false })
      actuales = r.nuevo
      r.cambiados.forEach((id) => cambiados.add(id))
    }
    setValores(actuales)
    setSucios((s) => { const n = new Set(s); cambiados.forEach((id) => n.add(id)); return n })
    setMensaje(casillas
      ? { tipo: 'ok', texto: `Se llenaron ${casillas} casilla(s) vacía(s) con ${texto}. Las notas que ya estaban no se tocaron. Recuerda guardar.` }
      : { tipo: 'ok', texto: 'No había casillas vacías.' })
  }

  const camposEditables = CAMPOS.filter(([k]) => !bloqueado(k))
  const invalidas = estudiantes.some((e) => camposEditables.some(([k]) => parsearNota(valores[e.id]?.[k] ?? '') === undefined))

  async function guardar() {
    setGuardando(true); setMensaje(null)
    const ahora = new Date().toISOString()
    const filas = [...sucios].map((estId) => ({
      estudiante_id: estId, espacio_id: Number(sel.espacio), actualizado_por: perfil.id, actualizado: ahora,
      ...Object.fromEntries(camposEditables.map(([k]) => [k, parsearNota(valores[estId][k])])),
    }))
    const { error } = await supabase.from('notas').upsert(filas, { onConflict: 'estudiante_id,espacio_id' })
    setGuardando(false)
    if (error) setMensaje({ tipo: 'error', texto: `No se guardaron las notas: ${error.message}` })
    else { setSucios(new Set()); setMensaje({ tipo: 'ok', texto: `Notas guardadas para ${filas.length} estudiante(s).` }) }
  }

  const pestana = (v, t) => (
    <button onClick={() => cambiarVista(v)}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${vista === v ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
  )

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
            <select id="c" className="campo" value={sel.cohorte} onChange={(e) => elegir({ cohorte: e.target.value, semestre: '', espacio: '' })}>
              <option value="">Selecciona</option>
              {cohortes.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="s">Semestre</label>
            <select id="s" className="campo" disabled={!sel.cohorte} value={sel.semestre} onChange={(e) => elegir({ ...sel, semestre: e.target.value, espacio: '' })}>
              <option value="">Selecciona</option>
              {semestres.map((s) => <option key={s} value={s}>Semestre {s}</option>)}
            </select>
          </div>
          <div>
            <label className="etiqueta" htmlFor="e">Módulo, retiro o seminario</label>
            <select id="e" className="campo" disabled={!sel.semestre} value={sel.espacio} onChange={(e) => elegir({ ...sel, espacio: e.target.value })}>
              <option value="">Selecciona</option>
              {espaciosSem.map((e) => <option key={e.id} value={e.id}>{e.etiqueta} · {e.nombre}</option>)}
            </select>
          </div>
        </div>
      )}

      {sel.semestre && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
            <div className="flex flex-wrap gap-2">
              {pestana('planilla', 'Planilla')}
              {pestana('actividades', `Actividades de contenidos${numActividades ? ` (${numActividades})` : ''}`)}
              {pestana('autoevaluacion', `Autoevaluación en línea${autoEnLinea ? ' ✓' : ''}`)}
              {pestana('importar', 'Importar desde Excel')}
            </div>
            <label className="mb-2 flex items-center gap-2 text-sm">
              Ordenar por
              <select className="campo w-auto py-1" value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="apellidos">Apellidos</option>
                <option value="nombres">Nombres</option>
              </select>
            </label>
          </div>

          {vista === 'importar' ? (
            <ImportarNotas cohorteId={Number(sel.cohorte)} cohorteNombre={cohortes.find(([id]) => String(id) === sel.cohorte)?.[1]}
              semestre={Number(sel.semestre)} espacios={espacios} espacioActual={espacio} perfil={perfil} orden={orden}
              alTerminar={cargar} />
          ) : !espacio ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
              Elige un módulo, retiro o seminario para ver su planilla, o usa "Importar desde Excel" para cargar todo el semestre.
            </p>
          ) : estudiantes.length === 0 ? (
            <p className="text-slate-500">Esta cohorte no tiene estudiantes activos.</p>
          ) : vista === 'autoevaluacion' ? (
            <AutoevaluacionEditor cohorteId={Number(sel.cohorte)} espacio={espacio} estudiantes={estudiantes} orden={orden}
              alCambiar={cargar} />
          ) : vista === 'actividades' ? (
            <Actividades cohorteId={Number(sel.cohorte)} espacio={espacio} estudiantes={estudiantes} orden={orden}
              perfil={perfil} alGuardar={cargar} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                <span className="text-sm font-semibold">Llenar todas las casillas vacías con</span>
                <input className="nota" inputMode="decimal" aria-label="Nota para las casillas vacías" placeholder="5,0"
                  value={notaVacias} onChange={(e) => setNotaVacias(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && llenarVacias()} />
                <button className="btn-sec py-1" onClick={llenarVacias}>Llenar vacías</button>
                <span className="text-xs text-slate-500">
                  Aplica a todas las columnas{CAMPOS.some(([k]) => bloqueado(k)) ? ' que no se llenan solas' : ''}. Las notas ya escritas se respetan.
                </span>
              </div>
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={sobrescribir} onChange={(e) => setSobrescribir(e.target.checked)} />
                En "Copiar a todos" por columna, reemplazar también las notas ya escritas
                <span className="text-xs text-slate-500">(si no lo marcas, solo se llenan las vacías)</span>
              </label>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full min-w-[720px] text-sm">
                  <caption className="bg-tinta px-4 py-2 text-left font-serif text-base font-semibold text-white">
                    {espacio.etiqueta} · {espacio.nombre}
                  </caption>
                  <thead className="bg-cielo">
                    <tr>
                      <th className="p-2 text-left">Estudiante</th>
                      {CAMPOS.map(([k, t]) => (
                        <th key={k} className="p-2">
                          {t}
                          {bloqueado(k) && <span className="block text-xs font-normal text-mariano">{ORIGEN[k]}</span>}
                        </th>
                      ))}
                      <th className="p-2">Definitiva</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="p-2 text-xs font-semibold text-slate-600">Copiar a todos</td>
                      {CAMPOS.map(([k, t]) => (
                        <td key={k} className="p-2 text-center">
                          {bloqueado(k) ? (
                            <span className="text-xs text-slate-400">Automático</span>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <input className="nota w-14" inputMode="decimal" aria-label={`Nota para copiar en ${t}`}
                                value={copia[k] ?? ''} onChange={(e) => setCopia({ ...copia, [k]: e.target.value })} />
                              <button className="text-xs font-semibold text-mariano underline" onClick={() => aplicarATodos(k)}>Aplicar</button>
                            </div>
                          )}
                        </td>
                      ))}
                      <td />
                    </tr>
                    {estudiantes.map((est) => {
                      const v = valores[est.id] ?? {}
                      const d = definitiva(Object.fromEntries(CAMPOS.map(([k]) => [k, parsearNota(v[k] ?? '') ?? null])))
                      return (
                        <tr key={est.id} className={`border-t border-slate-100 ${sucios.has(est.id) ? 'bg-amber-50' : ''}`}>
                          <td className="p-2 font-medium">{mostrarNombre(est, orden)}</td>
                          {CAMPOS.map(([k, t]) => {
                            if (bloqueado(k)) {
                              return (
                                <td key={k} className="p-2 text-center">
                                  <span className="inline-block w-16 rounded bg-cielo px-2 py-1 text-center tabular-nums text-mariano"
                                    title={k === 'contenidos' ? 'Calculado con las actividades de contenidos' : 'Respondida por el estudiante en su portal'}>{v[k] || '—'}</span>
                                </td>
                              )
                            }
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
                  <tfoot>
                    <tr className="border-t-2 border-slate-200">
                      <td colSpan={CAMPOS.length + 1} className="p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm">
                            <span className="text-slate-500">Formador del semestre {espacio.semestre}:</span>{' '}
                            <strong>{formadores[espacio.semestre] === '' ? 'Falta registrar su nombre en Configuración' : formadores[espacio.semestre] || 'Sin asignar'}</strong>
                          </span>
                          <span className="font-medium">Promedio del grupo</span>
                        </div>
                      </td>
                      <td className="p-2 text-center font-serif text-lg font-semibold tabular-nums">
                        {fmt(promedio(estudiantes.map((est) => definitiva(Object.fromEntries(CAMPOS.map(([k]) => [k, parsearNota(valores[est.id]?.[k] ?? '') ?? null]))))))}
                      </td>
                    </tr>
                  </tfoot>
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
          )}
        </>
      )}
    </section>
  )
}

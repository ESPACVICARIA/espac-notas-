import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, parsearNota, NOTA_MINIMA } from '../lib/notas'
import { calcularContenidos, copiarColumna, leerPeso, mostrarNombre } from '../lib/planilla'

let temporal = 0
const nuevaClave = () => `n${++temporal}`
const aTexto = (v) => (v === null || v === undefined ? '' : String(v).replace('.', ','))

export default function Actividades({ cohorteId, espacio, estudiantes, orden, perfil, alGuardar }) {
  const [metodo, setMetodo] = useState('simple')
  const [acts, setActs] = useState([]) // [{ clave, id?, nombre, peso }]
  const [borrados, setBorrados] = useState([])
  const [valores, setValores] = useState({}) // { estId: { clave: texto } }
  const [copia, setCopia] = useState({})
  const [sobrescribir, setSobrescribir] = useState(false)
  const [cambios, setCambios] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  async function cargar() {
    setCargando(true)
    const [{ data: pl }, { data: as }] = await Promise.all([
      supabase.from('planillas').select('metodo').eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).maybeSingle(),
      supabase.from('actividades').select('*').eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).order('orden').order('id'),
    ])
    const lista = (as ?? []).map((a) => ({ clave: `a${a.id}`, id: a.id, nombre: a.nombre, peso: aTexto(a.peso) }))
    const { data: ns } = lista.length
      ? await supabase.from('notas_actividad').select('*').in('actividad_id', lista.map((a) => a.id))
      : { data: [] }
    const v = {}
    for (const n of ns ?? []) (v[n.estudiante_id] ??= {})[`a${n.actividad_id}`] = aTexto(n.nota)
    setMetodo(pl?.metodo ?? 'simple'); setActs(lista); setValores(v)
    setBorrados([]); setCambios(false); setCargando(false)
  }
  useEffect(() => { cargar() }, [cohorteId, espacio.id])

  const marcar = () => { setCambios(true); setMensaje(null) }

  function agregar() { setActs([...acts, { clave: nuevaClave(), nombre: `Actividad ${acts.length + 1}`, peso: '' }]); marcar() }
  function cambiarAct(clave, campo, valor) { setActs(acts.map((a) => (a.clave === clave ? { ...a, [campo]: valor } : a))); marcar() }
  function quitar(a) {
    if (a.id && !confirm(`¿Quitar "${a.nombre}"? Se borrarán sus notas al guardar.`)) return
    setActs(acts.filter((x) => x.clave !== a.clave))
    if (a.id) setBorrados([...borrados, a.id])
    marcar()
  }
  function cambiarNota(estId, clave, texto) {
    setValores((v) => ({ ...v, [estId]: { ...v[estId], [clave]: texto } })); marcar()
  }
  function aplicarATodos(clave) {
    const texto = (copia[clave] ?? '').trim()
    if (parsearNota(texto) === undefined) { setMensaje({ tipo: 'error', texto: 'La nota a copiar debe estar entre 0,0 y 5,0.' }); return }
    if (texto === '' && !sobrescribir) return
    const { nuevo, cambiados } = copiarColumna({ estudiantes, valores, campo: clave, texto, sobrescribir })
    setValores(nuevo)
    if (cambiados.length) marcar()
  }

  const sumaPesos = acts.reduce((s, a) => s + (leerPeso(a.peso) || 0), 0)
  const notaInvalida = estudiantes.some((e) => acts.some((a) => parsearNota(valores[e.id]?.[a.clave] ?? '') === undefined))
  const pesoInvalido = acts.some((a) => leerPeso(a.peso) === undefined)
  const nombreVacio = acts.some((a) => !a.nombre.trim())

  async function guardar() {
    setGuardando(true); setMensaje(null)
    try {
      const falla = (r) => { if (r.error) throw r.error; return r }
      if (borrados.length) falla(await supabase.from('actividades').delete().in('id', borrados))

      const idDe = {}
      for (const [i, a] of acts.entries()) {
        const fila = { cohorte_id: cohorteId, espacio_id: espacio.id, nombre: a.nombre.trim(), peso: leerPeso(a.peso), orden: i }
        if (a.id) {
          falla(await supabase.from('actividades').update(fila).eq('id', a.id))
          idDe[a.clave] = a.id
        } else {
          const { data } = falla(await supabase.from('actividades').insert(fila).select('id').single())
          idDe[a.clave] = data.id
        }
      }

      falla(await supabase.from('planillas').upsert({ cohorte_id: cohorteId, espacio_id: espacio.id, metodo }, { onConflict: 'cohorte_id,espacio_id' }))

      const filasNotas = estudiantes.flatMap((e) => acts.map((a) => ({
        actividad_id: idDe[a.clave], estudiante_id: e.id, nota: parsearNota(valores[e.id]?.[a.clave] ?? ''),
      })))
      for (let i = 0; i < filasNotas.length; i += 500) {
        falla(await supabase.from('notas_actividad').upsert(filasNotas.slice(i, i + 500), { onConflict: 'actividad_id,estudiante_id' }))
      }

      // La nota de Contenidos de la planilla principal queda con el resultado de las actividades
      if (acts.length) {
        const ahora = new Date().toISOString()
        const filas = estudiantes.map((e) => ({
          estudiante_id: e.id, espacio_id: espacio.id, contenidos: calcularContenidos(acts, valores[e.id], metodo),
          actualizado_por: perfil.id, actualizado: ahora,
        }))
        falla(await supabase.from('notas').upsert(filas, { onConflict: 'estudiante_id,espacio_id' }))
      }

      await cargar()
      setMensaje({ tipo: 'ok', texto: 'Actividades guardadas. La nota de Contenidos se actualizó en la planilla.' })
      alGuardar?.()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo guardar: ${e.message}` })
    }
    setGuardando(false)
  }

  if (cargando) return <p className="text-slate-500">Cargando actividades…</p>

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="mb-4 text-sm text-slate-600">
          Registra aquí las actividades de <strong>{espacio.etiqueta} · {espacio.nombre}</strong>. Su resultado se copia a la
          casilla <strong>Contenidos</strong> de la planilla, que queda bloqueada para no modificarla a mano. Si quitas todas
          las actividades, la casilla vuelve a ser editable.
        </p>

        <fieldset className="mb-4 flex flex-wrap gap-6 text-sm">
          <legend className="etiqueta">Cómo se calcula Contenidos</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="metodo" checked={metodo === 'simple'} onChange={() => { setMetodo('simple'); marcar() }} />
            Promedio simple: todas las actividades valen lo mismo
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="metodo" checked={metodo === 'ponderado'} onChange={() => { setMetodo('ponderado'); marcar() }} />
            Promedio ponderado: cada actividad tiene un porcentaje
          </label>
        </fieldset>

        <ul className="space-y-2">
          {acts.map((a, i) => (
            <li key={a.clave} className="flex flex-wrap items-center gap-2">
              <span className="w-6 text-right text-xs text-slate-500">{i + 1}.</span>
              <input className="campo max-w-xs" aria-label="Nombre de la actividad" value={a.nombre}
                onChange={(e) => cambiarAct(a.clave, 'nombre', e.target.value)} />
              {metodo === 'ponderado' && (
                <span className="flex items-center gap-1">
                  <input className={`nota ${leerPeso(a.peso) === undefined ? 'border-alerta' : ''}`} aria-label="Porcentaje" inputMode="decimal"
                    value={a.peso} onChange={(e) => cambiarAct(a.clave, 'peso', e.target.value)} />
                  <span className="text-sm">%</span>
                </span>
              )}
              <button className="text-xs text-alerta underline" onClick={() => quitar(a)}>Quitar</button>
            </li>
          ))}
        </ul>
        <button className="btn-sec mt-3" onClick={agregar}>Agregar actividad</button>
        {metodo === 'ponderado' && acts.length > 0 && (
          <p className={`mt-2 text-xs ${Math.abs(sumaPesos - 100) < 0.01 ? 'text-green-700' : 'text-amber-700'}`}>
            Los porcentajes suman {String(sumaPesos).replace('.', ',')}%.
            {Math.abs(sumaPesos - 100) >= 0.01 && ' Lo ideal es 100%; si no, se reparten en proporción.'}
          </p>
        )}
      </div>

      {acts.length > 0 && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sobrescribir} onChange={(e) => setSobrescribir(e.target.checked)} />
            Al copiar a todos, reemplazar también las notas ya escritas
          </label>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cielo">
                <tr>
                  <th className="p-2 text-left">Estudiante</th>
                  {acts.map((a) => (
                    <th key={a.clave} className="p-2">
                      {a.nombre || 'Sin nombre'}
                      {metodo === 'ponderado' && <span className="block text-xs font-normal text-slate-500">{a.peso || 0}%</span>}
                    </th>
                  ))}
                  <th className="p-2">Contenidos</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td className="p-2 text-xs font-semibold text-slate-600">Copiar a todos</td>
                  {acts.map((a) => (
                    <td key={a.clave} className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input className="nota w-14" inputMode="decimal" aria-label={`Nota para copiar en ${a.nombre}`}
                          value={copia[a.clave] ?? ''} onChange={(e) => setCopia({ ...copia, [a.clave]: e.target.value })} />
                        <button className="text-xs font-semibold text-mariano underline" onClick={() => aplicarATodos(a.clave)}>Aplicar</button>
                      </div>
                    </td>
                  ))}
                  <td />
                </tr>
                {estudiantes.map((e) => {
                  const c = calcularContenidos(acts, valores[e.id], metodo)
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="p-2 font-medium">{mostrarNombre(e, orden)}</td>
                      {acts.map((a) => {
                        const t = valores[e.id]?.[a.clave] ?? ''
                        return (
                          <td key={a.clave} className="p-2 text-center">
                            <input inputMode="decimal" aria-label={`${a.nombre} de ${e.nombre_completo}`}
                              className={`nota ${parsearNota(t) === undefined ? 'border-alerta ring-1 ring-alerta' : ''}`}
                              value={t} onChange={(ev) => cambiarNota(e.id, a.clave, ev.target.value)} />
                          </td>
                        )
                      })}
                      <td className={`p-2 text-center font-semibold tabular-nums ${c !== null && c < NOTA_MINIMA ? 'text-alerta' : ''}`}>{fmt(c)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button className="btn" onClick={guardar} disabled={guardando || !cambios || notaInvalida || pesoInvalido || nombreVacio}>
          {guardando ? 'Guardando…' : 'Guardar actividades'}
        </button>
        {notaInvalida && <p className="text-sm text-alerta">Hay notas fuera de la escala 0,0 a 5,0.</p>}
        {pesoInvalido && <p className="text-sm text-alerta">Los porcentajes deben estar entre 0 y 100.</p>}
        {nombreVacio && <p className="text-sm text-alerta">Todas las actividades necesitan un nombre.</p>}
        {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}
      </div>
    </div>
  )
}

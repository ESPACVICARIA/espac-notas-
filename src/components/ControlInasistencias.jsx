import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { traerTodo } from '../lib/exportar'
import { mostrarNombre, ordenarEstudiantes } from '../lib/planilla'
import { fmt } from '../lib/notas'
import { contar, mapaRecuperaciones, ESTADOS_REC, vencida, enRojo } from '../lib/recuperaciones'
import { notaAsistencia } from './AsistenciaModulo'
import RecuperacionDialogo from './RecuperacionDialogo'

const fechaCorta = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
const TIPO = { modulo: 'Módulo', retiro: 'Retiro', seminario: 'Seminario' }

// Control de inasistencias de una cohorte en un semestre: módulos, retiros y seminarios
export default function ControlInasistencias({ cohorteId, cohorteNombre, semestre, espacios, perfil, orden }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [umbral, setUmbral] = useState(80)
  const [filtro, setFiltro] = useState('faltas')
  const [dialogo, setDialogo] = useState(null)

  async function cargar() {
    setError('')
    const ids = espacios.map((e) => e.id)
    const { data: ests } = await supabase.from('estudiantes').select('id, nombre_completo, numero_id').eq('cohorte_id', cohorteId).eq('estado', 'activo')
    const { data: ss } = ids.length ? await supabase.from('sesiones').select('*').eq('cohorte_id', cohorteId).in('espacio_id', ids).order('fecha') : { data: [] }
    const sesiones = ss ?? []
    const sids = sesiones.map((s) => s.id)
    const filas = sids.length ? await traerTodo(() => supabase.from('asistencias').select('*').in('sesion_id', sids).order('sesion_id')) : []
    const marcas = {}
    for (const f of filas) (marcas[f.sesion_id] ??= {})[f.estudiante_id] = { estado: f.estado, comentario: f.comentario ?? '' }
    const { data: cf } = await supabase.from('config_asistencia').select('*').eq('cohorte_id', cohorteId)
    const r = ids.length ? await supabase.from('recuperaciones').select('*').eq('cohorte_id', cohorteId).in('espacio_id', ids) : { data: [] }
    if (r.error && /recuperaciones/.test(r.error.message)) setError('Falta instalar recuperaciones.sql en Supabase para asignar recuperaciones.')
    // Retiros y seminarios sin sesiones: se mira la columna Asistencia de la planilla (0,0 = no asistió)
    const sinSesiones = ids.filter((id) => !sesiones.some((s) => s.espacio_id === id))
    const eids = (ests ?? []).map((e) => e.id)
    const { data: ns } = sinSesiones.length && eids.length
      ? await supabase.from('notas').select('estudiante_id, espacio_id, asistencia').in('espacio_id', sinSesiones).in('estudiante_id', eids)
      : { data: [] }
    setDatos({
      estudiantes: ests ?? [], sesiones, marcas, recs: mapaRecuperaciones(r.data ?? []), notas: ns ?? [], sinSesiones,
      reglas: Object.fromEntries((cf ?? []).map((c) => [c.espacio_id, c.justificadas])),
      convalidadas: new Set((cf ?? []).filter((c) => c.convalidar).map((c) => c.espacio_id)),
    })
  }
  useEffect(() => { setDatos(null); cargar() }, [cohorteId, semestre]) // eslint-disable-line react-hooks/exhaustive-deps

  const filas = useMemo(() => {
    if (!datos) return []
    const { estudiantes, sesiones, marcas, recs, notas, reglas } = datos
    return ordenarEstudiantes(estudiantes, orden).map((e) => {
      const fallas = []
      let presentes = 0, total = 0
      for (const esp of espacios) {
        const ses = sesiones.filter((s) => s.espacio_id === esp.id)
        if (ses.length) {
          const c = contar(ses, marcas, e.id, recs)
          const regla = reglas[esp.id] ?? 'excluir'
          presentes += (regla === 'asiste' ? c.A + c.FJ : c.A) + c.R
          total += (regla === 'excluir' ? c.A + c.FI : c.A + c.FI + c.FJ) + c.R
          for (const s of ses) {
            const x = marcas[s.id]?.[e.id]
            if (x?.estado === 'FI' || x?.estado === 'FJ') fallas.push({ esp, sesion: s, tipo: x.estado, motivo: x.comentario, rec: recs[`s${s.id}:${e.id}`] })
          }
        } else {
          const n = notas.find((x) => x.estudiante_id === e.id && x.espacio_id === esp.id)
          if (n && Number(n.asistencia) === 0) fallas.push({ esp, sesion: null, tipo: 'AUS', rec: recs[`e${esp.id}:${e.id}`] })
          else if (!n || n.asistencia === null) {
            // Sin datos: si ya hay una recuperación asignada para este espacio, también se muestra
            const rec = recs[`e${esp.id}:${e.id}`]
            if (rec) fallas.push({ esp, sesion: null, tipo: 'AUS', rec })
          }
        }
      }
      const pendientes = fallas.filter((f) => f.rec?.estado !== 'aprobada')
      const rojas = fallas.filter((f) => enRojo(f.tipo, f.rec))
      const pct = total ? Math.floor((presentes / total) * 100 + 1e-9) : null
      const riesgo = pct !== null && pct < umbral
      const nivel = rojas.length || riesgo ? 'rojo' : pendientes.length ? 'ambar' : fallas.length ? 'verde' : 'limpio'
      return { e, fallas, pendientes, rojas, pct, riesgo, nivel,
        fi: fallas.filter((f) => f.tipo === 'FI').length, fj: fallas.filter((f) => f.tipo === 'FJ').length,
        aus: fallas.filter((f) => f.tipo === 'AUS').length, recuperadas: fallas.length - pendientes.length }
    })
  }, [datos, espacios, orden, umbral])

  // Si la asistencia de ese módulo está convalidada, la nota del estudiante se recalcula con la recuperación
  async function alGuardar({ estudiante, espacio, sesion }) {
    if (sesion && datos.convalidadas.has(espacio.id)) {
      const { data: rs } = await supabase.from('recuperaciones').select('*').eq('cohorte_id', cohorteId).eq('espacio_id', espacio.id).eq('estudiante_id', estudiante.id)
      const ses = datos.sesiones.filter((s) => s.espacio_id === espacio.id)
      const c = contar(ses, datos.marcas, estudiante.id, mapaRecuperaciones(rs ?? []))
      await supabase.from('notas').upsert({ estudiante_id: estudiante.id, espacio_id: espacio.id, asistencia: notaAsistencia(c, datos.reglas[espacio.id] ?? 'excluir'),
        actualizado_por: perfil?.id, actualizado: new Date().toISOString() }, { onConflict: 'estudiante_id,espacio_id' })
    }
    await cargar()
  }

  if (!datos) return <p className="text-slate-500">Cargando el control de inasistencias…</p>

  const PESO = { rojo: 0, ambar: 1, verde: 2, limpio: 3 }
  const visibles = filas
    .filter((f) => filtro === 'todos' || (filtro === 'rojo' ? f.nivel === 'rojo' : f.nivel !== 'limpio'))
    .sort((a, b) => PESO[a.nivel] - PESO[b.nivel] || b.pendientes.length - a.pendientes.length)
  const cuenta = (n) => filas.filter((f) => f.nivel === n).length

  function exportar() {
    const resumen = filas.map((f) => ({
      Estudiante: mostrarNombre(f.e, orden), Documento: f.e.numero_id ?? '',
      Estado: { rojo: 'Atención', ambar: 'En recuperación', verde: 'Recuperado', limpio: 'Sin faltas' }[f.nivel],
      FI: f.fi, FJ: f.fj, 'Retiro o seminario sin asistir': f.aus, Recuperadas: f.recuperadas, 'Sin recuperar': f.pendientes.length,
      '% asistencia': f.pct ?? '',
    }))
    const detalle = filas.flatMap((f) => f.fallas.map((x) => ({
      Estudiante: mostrarNombre(f.e, orden), Documento: f.e.numero_id ?? '', Espacio: `${x.esp.etiqueta} · ${x.esp.nombre}`,
      Fecha: x.sesion?.fecha ?? '', Tema: x.sesion?.tema ?? '', Falla: x.tipo === 'AUS' ? 'No asistió' : x.tipo, Motivo: x.motivo ?? '',
      Recuperación: x.rec?.forma ?? 'Sin asignar', 'Fecha límite': x.rec?.fecha_limite ?? '', 'Estado recuperación': x.rec ? ESTADOS_REC[x.rec.estado].nombre : '',
      Nota: x.rec?.nota ?? '', Observación: x.rec?.observacion ?? '',
    })))
    const libro = XLSX.utils.book_new()
    for (const [hoja, nombre] of [[resumen, 'Resumen'], [detalle, 'Faltas y recuperaciones']]) {
      const h = XLSX.utils.json_to_sheet(hoja.length ? hoja : [{ 'Sin datos': '' }])
      h['!cols'] = Object.keys(hoja[0] ?? { x: 1 }).map((k) => ({ wch: Math.max(10, k.length + 2, ...hoja.slice(0, 100).map((x) => String(x[k] ?? '').length + 1)) }))
      XLSX.utils.book_append_sheet(libro, h, nombre)
    }
    const limpio = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
    XLSX.writeFile(libro, `inasistencias-${limpio(cohorteNombre)}-semestre-${semestre}.xlsx`)
  }

  return (
    <div className="space-y-4">
      <div className="hidden print:block">
        <h1 className="font-serif text-2xl font-semibold">Control de inasistencias</h1>
        <p className="text-sm">{cohorteNombre} · Semestre {semestre} · {new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 print:hidden">
        <h2 className="text-xl font-semibold">Control de inasistencias · Semestre {semestre}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Reúne las faltas de los módulos, retiros y seminarios del semestre. En <span className="font-semibold text-alerta">rojo</span> quedan quienes tienen
          faltas sin recuperar (o con la recuperación vencida o no presentada) y quienes están por debajo del porcentaje mínimo. Toca una falla para asignar o
          revisar su recuperación.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">Asistencia mínima
            <select className="campo w-auto py-1" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))}>
              {[70, 75, 80, 85, 90].map((n) => <option key={n} value={n}>{n}%</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">Mostrar
            <select className="campo w-auto py-1" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
              <option value="rojo">Solo los que están en rojo</option>
              <option value="faltas">Todos los que tienen faltas</option>
              <option value="todos">Toda la cohorte</option>
            </select>
          </label>
          <span className="ml-auto flex gap-2">
            <button className="btn-sec py-1" onClick={() => window.print()}>Imprimir o guardar PDF</button>
            <button className="btn-sec py-1" onClick={exportar}>Exportar a Excel</button>
          </span>
        </div>
        {error && <p className="mt-2 text-sm text-alerta">{error}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['rojo', 'Requieren atención', 'border-alerta bg-red-50 text-alerta'], ['ambar', 'En recuperación', 'border-amber-300 bg-amber-50 text-amber-900'],
          ['verde', 'Faltas recuperadas', 'border-green-300 bg-green-50 text-green-800'], ['limpio', 'Sin faltas', 'border-slate-200 bg-white text-slate-600']].map(([k, t, c]) => (
          <button key={k} onClick={() => setFiltro(k === 'rojo' ? 'rojo' : k === 'limpio' ? 'todos' : 'faltas')} className={`rounded-lg border-2 p-3 text-left ${c} print:p-2`}>
            <span className="block font-serif text-3xl font-semibold tabular-nums">{cuenta(k)}</span>
            <span className="text-xs font-semibold uppercase tracking-wide">{t}</span>
          </button>
        ))}
      </div>

      {!visibles.length ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
          {filtro === 'rojo' ? 'Nadie está en rojo en este semestre.' : 'No hay faltas registradas en este semestre.'}
          {!datos.sesiones.length && ' Registra la asistencia por sesiones en cada módulo para llevar el control.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white print:overflow-visible">
          <table className="w-full min-w-[720px] text-sm print:min-w-0 print:text-xs">
            <thead className="bg-tinta text-left text-white">
              <tr>
                <th className="p-2">Estudiante</th>
                <th className="p-2 text-center" title="Fallas injustificadas">FI</th>
                <th className="p-2 text-center" title="Fallas justificadas">FJ</th>
                <th className="p-2 text-center" title="Retiro o seminario sin asistir">Ret./Sem.</th>
                <th className="p-2 text-center">Recup.</th>
                <th className="p-2 text-center">%</th>
                <th className="p-2">Faltas y recuperaciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr key={f.e.id} className={`border-t align-top ${f.nivel === 'rojo' ? 'border-red-200 bg-red-50' : 'border-slate-100'}`}>
                  <td className={`p-2 font-semibold ${f.nivel === 'rojo' ? 'text-alerta' : ''}`}>
                    {f.nivel === 'rojo' && <span aria-hidden="true">● </span>}{mostrarNombre(f.e, orden)}
                    {f.riesgo && <span className="block text-xs font-normal">Asistencia por debajo del {umbral}%</span>}
                  </td>
                  <td className={`p-2 text-center tabular-nums ${f.fi ? 'font-semibold text-alerta' : 'text-slate-400'}`}>{f.fi}</td>
                  <td className="p-2 text-center tabular-nums">{f.fj || <span className="text-slate-400">0</span>}</td>
                  <td className={`p-2 text-center tabular-nums ${f.aus ? 'font-semibold text-alerta' : 'text-slate-400'}`}>{f.aus}</td>
                  <td className={`p-2 text-center tabular-nums ${f.recuperadas ? 'font-semibold text-green-700' : 'text-slate-400'}`}>{f.recuperadas}</td>
                  <td className={`p-2 text-center font-semibold tabular-nums ${f.riesgo ? 'text-alerta' : ''}`}>{f.pct === null ? '—' : `${f.pct}%`}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {f.fallas.map((x) => {
                        const aprobada = x.rec?.estado === 'aprobada'
                        const roja = enRojo(x.tipo, x.rec)
                        const clase = aprobada ? 'border-green-400 bg-green-50 text-green-900'
                          : roja ? 'border-alerta bg-white text-alerta' : x.rec ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-oro bg-white text-tinta'
                        return (
                          <button key={`${x.esp.id}-${x.sesion?.id ?? 'e'}`} type="button"
                            onClick={() => setDialogo({ estudiante: f.e, espacio: x.esp, sesion: x.sesion, falla: x.tipo === 'AUS' ? null : x.tipo, rec: x.rec })}
                            title={x.rec ? `${x.rec.forma} · ${ESTADOS_REC[x.rec.estado].nombre}${x.rec.fecha_limite ? ` · hasta el ${fechaCorta(x.rec.fecha_limite)}` : ''}` : 'Sin recuperación asignada'}
                            className={`rounded-md border px-1.5 py-0.5 text-left text-xs leading-tight ${clase}`}>
                            <span className="font-semibold">{x.esp.etiqueta}</span>
                            {x.sesion ? ` · ${fechaCorta(x.sesion.fecha)} · ${x.tipo}` : ` · ${TIPO[x.esp.tipo] ?? ''} no asistió`}
                            <span className="block">{aprobada ? `✓ Recuperada${x.rec.nota !== null ? ` (${fmt(x.rec.nota)})` : ''}` : x.rec ? `${ESTADOS_REC[x.rec.estado].nombre}${vencida(x.rec) ? ' · vencida' : ''}` : 'Sin recuperación'}</span>
                          </button>
                        )
                      })}
                      {!f.fallas.length && <span className="text-xs text-slate-400">Sin faltas</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">
        FI = falla injustificada · FJ = falla justificada · Ret./Sem. = retiro o seminario sin sesiones con 0,0 en Asistencia · Recup. = faltas con recuperación aprobada.
        El porcentaje usa la regla de faltas justificadas de cada módulo y cuenta las recuperaciones aprobadas como asistencia.
      </p>

      {dialogo && (
        <RecuperacionDialogo cohorteId={cohorteId} espacio={dialogo.espacio} estudiante={dialogo.estudiante} sesion={dialogo.sesion} falla={dialogo.falla}
          recuperacion={dialogo.rec} perfil={perfil} cerrar={() => setDialogo(null)} alGuardar={() => alGuardar(dialogo)} />
      )}
    </div>
  )
}

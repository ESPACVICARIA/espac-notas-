import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { CAMPOS, parsearNota, fmt } from '../lib/notas'
import { normalizarDoc } from '../lib/importar'
import { traerTodo } from '../lib/exportar'
import { ordenarEstudiantes } from '../lib/planilla'

const clave = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

const TITULOS = { asistencia: 'Asistencia', contenidos: 'Contenidos', autoevaluacion: 'Autoevaluación', coevaluacion: 'Coevaluación' }
const ALIAS = {
  documento: ['documento', 'numerodocumento', 'numerodedocumento', 'cedula', 'numero', 'identificacion', 'nodocumento'],
  nombre: ['nombrecompleto', 'nombre', 'nombres', 'estudiante', 'apellidosynombres', 'nombreyapellidos'],
  asistencia: ['asistencia', 'asitencia'],
  contenidos: ['contenidos', 'contenido', 'contenidosautomatico'],
  autoevaluacion: ['autoevaluacion', 'autoev'],
  coevaluacion: ['coevaluacion', 'coev'],
}
const COLUMNA = Object.fromEntries(Object.entries(ALIAS).flatMap(([k, lista]) => lista.map((a) => [a, k])))
const nombreHoja = (e) => e.etiqueta.replace(/[:\\/?*[\]]/g, '-').slice(0, 31)

export default function ImportarNotas({ cohorteId, cohorteNombre, semestre, espacios, espacioActual, perfil, orden, alTerminar }) {
  const [estudiantes, setEstudiantes] = useState([])
  const [existentes, setExistentes] = useState({}) // { estId: { espId: nota } }
  const [bloqueados, setBloqueados] = useState(new Set())
  const [cargando, setCargando] = useState(true)
  const [hojas, setHojas] = useState(null) // [{ espacio, filas: [{ fila, doc, nombre, valores }] }]
  const [avisos, setAvisos] = useState([])
  const [reemplazar, setReemplazar] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const espaciosSem = useMemo(
    () => espacios.filter((e) => e.semestre === semestre && e.activo !== false).sort((a, b) => a.orden - b.orden || a.id - b.id),
    [espacios, semestre])

  async function cargar() {
    setCargando(true)
    const ests = await traerTodo(() => supabase.from('estudiantes').select('id, nombre_completo, numero_id')
      .eq('cohorte_id', cohorteId).eq('estado', 'activo').order('id'))
    const ids = ests.map((e) => e.id)
    const espIds = espaciosSem.map((e) => e.id)
    const mapa = {}
    for (let i = 0; i < ids.length; i += 100) {
      const lote = ids.slice(i, i + 100)
      const ns = await traerTodo(() => supabase.from('notas').select('*').in('estudiante_id', lote).in('espacio_id', espIds).order('id'))
      for (const n of ns) (mapa[n.estudiante_id] ??= {})[n.espacio_id] = n
    }
    const { data: acts } = await supabase.from('actividades').select('espacio_id').eq('cohorte_id', cohorteId).in('espacio_id', espIds)
    setEstudiantes(ordenarEstudiantes(ests, orden))
    setExistentes(mapa)
    setBloqueados(new Set((acts ?? []).map((a) => a.espacio_id)))
    setCargando(false)
  }
  useEffect(() => { cargar(); setHojas(null); setAvisos([]); setMensaje(null) }, [cohorteId, semestre])

  const camposDe = (espId) => CAMPOS.map(([k]) => k).filter((k) => !(k === 'contenidos' && bloqueados.has(espId)))

  function descargar() {
    const libro = XLSX.utils.book_new()
    for (const e of espaciosSem) {
      const encabezado = ['Documento', 'Nombre completo', ...CAMPOS.map(([k]) =>
        k === 'contenidos' && bloqueados.has(e.id) ? 'Contenidos (automático)' : TITULOS[k])]
      const filas = estudiantes.map((est) => {
        const n = existentes[est.id]?.[e.id]
        return [est.numero_id ?? '', est.nombre_completo, ...CAMPOS.map(([k]) => (n?.[k] ?? '') === '' ? '' : Number(n[k]))]
      })
      const hoja = XLSX.utils.aoa_to_sheet([encabezado, ...filas])
      hoja['!cols'] = [{ wch: 14 }, { wch: 36 }, ...CAMPOS.map(() => ({ wch: 14 }))]
      XLSX.utils.book_append_sheet(libro, hoja, nombreHoja(e))
    }
    const nombre = clave(cohorteNombre || 'cohorte') || 'cohorte'
    XLSX.writeFile(libro, `notas-${nombre}-semestre-${semestre}.xlsx`)
  }

  async function alElegir(ev) {
    const archivo = ev.target.files?.[0]
    ev.target.value = ''
    if (!archivo) return
    setHojas(null); setAvisos([]); setMensaje(null)
    try {
      const libro = XLSX.read(await archivo.arrayBuffer())
      const leidas = []
      const av = []
      for (const nombre of libro.SheetNames) {
        let espacio = espaciosSem.find((e) => clave(nombreHoja(e)) === clave(nombre) || clave(e.etiqueta) === clave(nombre) || clave(e.nombre) === clave(nombre))
        if (!espacio && libro.SheetNames.length === 1 && espacioActual) espacio = espacioActual
        if (!espacio) { av.push(`La hoja "${nombre}" no corresponde a ningún módulo del semestre ${semestre} y se omitirá.`); continue }
        const crudas = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { defval: '', raw: true })
        const filas = crudas.map((f, i) => {
          const o = { fila: i + 2, valores: {} }
          for (const [h, v] of Object.entries(f)) {
            const k = COLUMNA[clave(h)]
            if (k === 'documento') o.doc = normalizarDoc(v)
            else if (k === 'nombre') o.nombre = String(v ?? '').trim()
            else if (k) o.valores[k] = v
          }
          return o
        }).filter((o) => o.doc || o.nombre)
        leidas.push({ espacio, hoja: nombre, filas })
      }
      if (!leidas.length) av.push(`El archivo no tiene hojas con módulos del semestre ${semestre}. Descarga la plantilla para ver el formato.`)
      setHojas(leidas); setAvisos(av)
    } catch {
      setAvisos(['No se pudo leer el archivo. Verifica que sea un Excel (.xlsx o .xls).'])
    }
  }

  // Compara el Excel con lo que ya está guardado
  const analisis = useMemo(() => {
    if (!hojas) return null
    const porDoc = new Map(estudiantes.filter((e) => e.numero_id).map((e) => [normalizarDoc(e.numero_id), e]))
    const porNombre = new Map(estudiantes.map((e) => [clave(e.nombre_completo), e]))
    const resumen = []
    const cambios = []
    const errores = []
    for (const h of hojas) {
      const r = { espacio: h.espacio, nuevas: 0, reemplazos: 0, conservadas: 0, iguales: 0 }
      const campos = camposDe(h.espacio.id)
      for (const f of h.filas) {
        const est = (f.doc && porDoc.get(f.doc)) || porNombre.get(clave(f.nombre))
        if (!est) { errores.push(`${h.hoja}, fila ${f.fila}: "${f.nombre || f.doc}" no está en esta cohorte (o está retirado).`); continue }
        for (const k of campos) {
          const crudo = f.valores[k]
          if (crudo === undefined || String(crudo).trim() === '') continue
          const nueva = parsearNota(String(crudo))
          if (nueva === undefined || nueva === null) { errores.push(`${h.hoja}, fila ${f.fila}: ${TITULOS[k]} "${crudo}" no es una nota válida (0,0 a 5,0).`); continue }
          const antes = existentes[est.id]?.[h.espacio.id]?.[k]
          const tieneAntes = antes !== null && antes !== undefined
          if (tieneAntes && Number(antes) === nueva) { r.iguales++; continue }
          if (tieneAntes && !reemplazar) { r.conservadas++; continue }
          if (tieneAntes) r.reemplazos++; else r.nuevas++
          cambios.push({ estId: est.id, espId: h.espacio.id, campo: k, nueva })
        }
      }
      resumen.push(r)
    }
    return { resumen, cambios, errores }
  }, [hojas, reemplazar, estudiantes, existentes, bloqueados])

  async function importar() {
    setTrabajando(true); setMensaje(null)
    try {
      const ahora = new Date().toISOString()
      const porEspacio = {}
      for (const c of analisis.cambios) ((porEspacio[c.espId] ??= {})[c.estId] ??= {})[c.campo] = c.nueva
      let total = 0
      for (const [espId, porEst] of Object.entries(porEspacio)) {
        const campos = camposDe(Number(espId))
        const filas = Object.entries(porEst).map(([estId, nuevos]) => {
          const actual = existentes[estId]?.[espId] ?? {}
          return {
            estudiante_id: estId, espacio_id: Number(espId), actualizado_por: perfil.id, actualizado: ahora,
            ...Object.fromEntries(campos.map((k) => [k, nuevos[k] !== undefined ? nuevos[k] : (actual[k] ?? null)])),
          }
        })
        for (let i = 0; i < filas.length; i += 200) {
          const { error } = await supabase.from('notas').upsert(filas.slice(i, i + 200), { onConflict: 'estudiante_id,espacio_id' })
          if (error) throw error
        }
        total += filas.length
      }
      setMensaje({ tipo: 'ok', texto: `Listo: se guardaron ${analisis.cambios.length} nota(s) de ${total} registro(s).` })
      setHojas(null)
      await cargar()
      alTerminar?.()
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudieron guardar las notas: ${e.message}` })
    }
    setTrabajando(false)
  }

  if (cargando) return <p className="text-slate-500">Cargando estudiantes y notas…</p>

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="mb-4 text-sm text-slate-600">
          Descarga la plantilla del <strong>semestre {semestre}</strong>: trae una hoja por módulo con los estudiantes de la cohorte
          y las notas que ya tienen. Llénala y súbela. Los estudiantes se reconocen por el documento (o por el nombre si no tienen
          documento). Las casillas vacías del Excel no borran nada.
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="btn-sec" onClick={descargar} disabled={!estudiantes.length}>Descargar plantilla del semestre</button>
          <label className="btn cursor-pointer">
            Subir Excel con notas
            <input type="file" accept=".xlsx,.xls" className="sr-only" onChange={alElegir} />
          </label>
        </div>
        {!estudiantes.length && <p className="mt-3 text-sm text-amber-700">Esta cohorte no tiene estudiantes activos.</p>}
      </div>

      {avisos.map((a) => <p key={a} className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{a}</p>)}
      {mensaje && <p className={`text-sm ${mensaje.tipo === 'error' ? 'text-alerta' : 'text-green-700'}`}>{mensaje.texto}</p>}

      {analisis && analisis.resumen.length > 0 && (
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)} />
            Reemplazar las notas que ya estaban guardadas
            <span className="text-xs text-slate-500">(si no lo marcas, solo se llenan las casillas vacías)</span>
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-cielo text-left">
                <tr><th className="p-2">Módulo</th><th className="p-2">Notas nuevas</th><th className="p-2">Reemplazos</th><th className="p-2">Conservadas</th><th className="p-2">Sin cambio</th></tr>
              </thead>
              <tbody>
                {analisis.resumen.map((r) => (
                  <tr key={r.espacio.id} className="border-t border-slate-100">
                    <td className="p-2">
                      {r.espacio.etiqueta} · {r.espacio.nombre}
                      {bloqueados.has(r.espacio.id) && <span className="block text-xs text-mariano">Contenidos viene de actividades: esa columna se ignora</span>}
                    </td>
                    <td className="p-2 tabular-nums text-green-700">{r.nuevas}</td>
                    <td className="p-2 tabular-nums">{r.reemplazos}</td>
                    <td className="p-2 tabular-nums text-slate-500">{r.conservadas}</td>
                    <td className="p-2 tabular-nums text-slate-500">{r.iguales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analisis.errores.length > 0 && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-alerta">
              <p className="mb-1 font-semibold">{analisis.errores.length} dato(s) no se importarán:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {analisis.errores.slice(0, 30).map((e) => <li key={e}>{e}</li>)}
              </ul>
              {analisis.errores.length > 30 && <p className="mt-1">…y {analisis.errores.length - 30} más.</p>}
            </div>
          )}

          <button className="btn" onClick={importar} disabled={trabajando || analisis.cambios.length === 0}>
            {trabajando ? 'Guardando…' : `Guardar ${analisis.cambios.length} nota(s)`}
          </button>
          {analisis.cambios.length === 0 && <p className="text-sm text-slate-500">No hay notas nuevas para guardar{!reemplazar && ' (las que ya existían se conservaron)'}.</p>}
        </div>
      )}
    </div>
  )
}

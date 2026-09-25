import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { leerExcel, leerLista, limpiarFila, normalizarDoc, descargarPlantilla, ESTUDIANTE_VACIO } from '../lib/importar'

const ESTADOS = {
  nuevo: ['Nuevo', 'bg-green-100 text-green-800'],
  existe: ['Ya existe', 'bg-cielo text-mariano'],
  error: ['Con error', 'bg-red-100 text-alerta'],
}

export default function Importar() {
  const [modo, setModo] = useState('excel')
  const [cohortes, setCohortes] = useState([])
  const [cohorte, setCohorte] = useState('')
  const [actualizar, setActualizar] = useState(true)
  const [lista, setLista] = useState('')
  const [filas, setFilas] = useState(null)
  const [aviso, setAviso] = useState('')
  const [resultado, setResultado] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    supabase.from('cohortes').select('*').order('anio', { ascending: false }).then(({ data }) => setCohortes(data ?? []))
  }, [])

  function reiniciar() { setFilas(null); setAviso(''); setResultado(null) }

  async function analizar(crudas, filaInicial) {
    const { data: existentes, error } = await supabase.from('estudiantes').select('id, numero_id').range(0, 9999)
    if (error) { setAviso(`No se pudieron revisar los estudiantes actuales: ${error.message}`); return }
    const porDoc = new Map((existentes ?? []).filter((e) => e.numero_id).map((e) => [normalizarDoc(e.numero_id), e.id]))
    const vistos = new Set()

    setFilas(crudas.map((o, i) => {
      const { datos, errores } = limpiarFila(o)
      const doc = datos.numero_id
      let estado = 'nuevo'
      if (doc && vistos.has(doc)) errores.push('documento repetido en esta lista')
      if (errores.length) estado = 'error'
      else if (doc && porDoc.has(doc)) estado = 'existe'
      if (doc) vistos.add(doc)
      return { fila: i + filaInicial, datos, errores, estado, id: doc ? porDoc.get(doc) : undefined }
    }))
  }

  async function alElegirArchivo(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    reiniciar(); setTrabajando(true)
    try {
      const { filas: crudas, reconocidos, ignorados } = await leerExcel(archivo)
      if (!reconocidos.some((h) => /nombre|estudiante/i.test(h))) {
        setAviso('No encontré una columna de nombres. La primera fila del Excel debe tener los títulos; usa la plantilla como guía.')
      } else if (crudas.length === 0) {
        setAviso('El archivo no tiene estudiantes debajo de los títulos.')
      } else {
        if (ignorados.length) setAviso(`Estas columnas no se reconocieron y se omitirán: ${ignorados.join(', ')}.`)
        await analizar(crudas, 2)
      }
    } catch {
      setAviso('No se pudo leer el archivo. Verifica que sea un Excel (.xlsx, .xls) o .csv.')
    }
    setTrabajando(false)
  }

  async function alAnalizarLista() {
    reiniciar()
    const crudas = leerLista(lista)
    if (!crudas.length) { setAviso('Pega al menos un nombre, uno por línea.'); return }
    setTrabajando(true)
    await analizar(crudas, 1)
    setTrabajando(false)
  }

  async function importar() {
    setTrabajando(true)
    const cohorteId = cohorte ? Number(cohorte) : null
    let creados = 0, actualizados = 0
    const fallidos = []

    const nuevos = filas.filter((f) => f.estado === 'nuevo')
    for (let i = 0; i < nuevos.length; i += 100) {
      const lote = nuevos.slice(i, i + 100)
      const registros = lote.map((f) => ({ ...ESTUDIANTE_VACIO, ...f.datos, cohorte_id: cohorteId }))
      const { error } = await supabase.from('estudiantes').insert(registros)
      if (!error) { creados += lote.length; continue }
      for (let j = 0; j < lote.length; j++) {
        const r = await supabase.from('estudiantes').insert(registros[j])
        if (r.error) fallidos.push({ fila: lote[j].fila, nombre: lote[j].datos.nombre_completo, motivo: r.error.message })
        else creados++
      }
    }

    if (actualizar) {
      for (const f of filas.filter((x) => x.estado === 'existe')) {
        const { numero_id, ...cambios } = f.datos
        if (cohorteId) cambios.cohorte_id = cohorteId
        const { error } = await supabase.from('estudiantes').update(cambios).eq('id', f.id)
        if (error) fallidos.push({ fila: f.fila, nombre: f.datos.nombre_completo, motivo: error.message })
        else actualizados++
      }
    }

    setResultado({ creados, actualizados, fallidos })
    setFilas(null); setLista('')
    setTrabajando(false)
  }

  const cuenta = (e) => filas?.filter((f) => f.estado === e).length ?? 0
  const aImportar = cuenta('nuevo') + (actualizar ? cuenta('existe') : 0)
  const sinDocumento = filas?.filter((f) => f.estado !== 'error' && !f.datos.numero_id).length ?? 0

  const pestana = (m, t) => (
    <button onClick={() => { setModo(m); reiniciar() }}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${modo === m ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
  )

  return (
    <section>
      <h1 className="text-3xl font-semibold">Importar estudiantes</h1>
      <p className="mb-6 text-sm text-slate-500">Revisa la vista previa antes de confirmar. Nada se guarda hasta que pulses Importar.</p>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {pestana('excel', 'Desde Excel con todos los datos')}
        {pestana('lista', 'Solo nombres')}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor="coh">Cohorte para estos estudiantes</label>
          <select id="coh" className="campo" value={cohorte} onChange={(e) => setCohorte(e.target.value)}>
            <option value="">Sin asignar</option>
            {cohortes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} />
          Si el documento ya existe, actualizar sus datos
        </label>
      </div>

      {modo === 'excel' ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <p className="mb-4 text-sm">
            Descarga la plantilla, llénala y súbela. También sirve un Excel propio si la primera fila tiene títulos como
            "Nombre completo", "Documento", "Parroquia" o "Teléfono".
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="btn-sec" onClick={descargarPlantilla}>Descargar plantilla</button>
            <label className="btn cursor-pointer">
              {trabajando ? 'Leyendo…' : 'Subir Excel'}
              <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={alElegirArchivo} disabled={trabajando} />
            </label>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <label className="etiqueta" htmlFor="lista">Un estudiante por línea</label>
          <p className="mb-3 text-xs text-slate-500">
            Puedes copiar dos columnas de Excel (nombre y documento) y pegarlas aquí. El documento es opcional, pero sin él el
            estudiante no podrá entrar a ver sus notas.
          </p>
          <textarea id="lista" rows={10} className="campo font-mono"
            placeholder={'María Fernanda Rojas Díaz\t1020304050\nJuan Pablo Gómez\t80123456\nAna Lucía Pérez'}
            value={lista} onChange={(e) => setLista(e.target.value)} />
          <button className="btn mt-3" onClick={alAnalizarLista} disabled={trabajando || !lista.trim()}>
            {trabajando ? 'Revisando…' : 'Revisar lista'}
          </button>
        </div>
      )}

      {aviso && <p className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900">{aviso}</p>}

      {resultado && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">Importación terminada</h2>
          <p className="mt-2 text-sm">
            {resultado.creados} estudiantes creados · {resultado.actualizados} actualizados · {resultado.fallidos.length} con error
          </p>
          {resultado.fallidos.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-alerta">
              {resultado.fallidos.map((f) => <li key={f.fila}>Fila {f.fila} ({f.nombre}): {f.motivo}</li>)}
            </ul>
          )}
          <Link to="/" className="btn-sec mt-4">Ver estudiantes</Link>
        </div>
      )}

      {filas && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <strong>{filas.length}</strong> filas: {cuenta('nuevo')} nuevos, {cuenta('existe')} ya existen, {cuenta('error')} con error.
              {sinDocumento > 0 && <span className="text-amber-700"> {sinDocumento} sin documento.</span>}
            </p>
            <button className="btn" onClick={importar} disabled={trabajando || aImportar === 0}>
              {trabajando ? 'Importando…' : `Importar ${aImportar} estudiantes`}
            </button>
          </div>
          {cuenta('error') > 0 && (
            <p className="mb-3 text-sm text-alerta">Las filas con error no se importarán. Corrígelas en el archivo y vuelve a subirlo si las necesitas.</p>
          )}
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-cielo text-left">
                <tr><th className="p-2">Fila</th><th className="p-2">Nombre</th><th className="p-2">Documento</th><th className="p-2">Estado</th><th className="p-2">Detalle</th></tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const [etiqueta, color] = ESTADOS[f.estado]
                  return (
                    <tr key={f.fila} className="border-t border-slate-100">
                      <td className="p-2 tabular-nums text-slate-500">{f.fila}</td>
                      <td className="p-2">{f.datos.nombre_completo ?? '—'}</td>
                      <td className="p-2 tabular-nums">{f.datos.numero_id ?? '—'}</td>
                      <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>{etiqueta}</span></td>
                      <td className="p-2 text-xs">
                        {f.errores.length ? <span className="text-alerta">{f.errores.join('; ')}</span>
                          : f.estado === 'existe' ? (actualizar ? 'Se actualizarán sus datos' : 'Se omitirá')
                          : !f.datos.numero_id ? <span className="text-amber-700">Sin documento: no podrá entrar al portal</span> : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

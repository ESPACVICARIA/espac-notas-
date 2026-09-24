import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CAMPOS, definitiva, promedio, fmt, NOTA_MINIMA } from '../lib/notas'

const fecha = (f) => (f ? new Date(f + 'T00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '—')

export default function Ficha({ perfil }) {
  const { id } = useParams()
  const [est, setEst] = useState(null)
  const [espacios, setEspacios] = useState([])
  const [notas, setNotas] = useState({})
  const [pestana, setPestana] = useState('itinerario')

  useEffect(() => {
    supabase.from('estudiantes').select('*, cohortes(nombre)').eq('id', id).single().then(({ data }) => setEst(data))
    supabase.from('espacios').select('*').order('id').then(({ data }) => setEspacios(data ?? []))
    supabase.from('notas').select('*').eq('estudiante_id', id)
      .then(({ data }) => setNotas(Object.fromEntries((data ?? []).map((n) => [n.espacio_id, n]))))
  }, [id])

  if (!est) return <p className="text-slate-500">Cargando…</p>

  const semestres = [1, 2, 3, 4].map((s) => {
    const items = espacios.filter((e) => e.semestre === s)
    const prom = promedio(items.map((e) => definitiva(notas[e.id])))
    return { s, items, prom, completos: items.filter((e) => definitiva(notas[e.id]) !== null).length }
  })
  const general = promedio(semestres.map((x) => x.prom))

  const datos = [
    ['Documento', `${est.tipo_id ?? ''} ${est.numero_id ?? ''}`], ['Parroquia', est.parroquia], ['Centro de formación', est.centro_formacion],
    ['Cohorte', est.cohortes?.nombre], ['Fecha de matrícula', fecha(est.fecha_matricula)], ['Nacimiento', `${est.lugar_nacimiento ?? '—'}, ${fecha(est.fecha_nacimiento)}`],
    ['Dirección', est.direccion], ['Barrio', est.barrio], ['Teléfono', est.telefono], ['Ocupación', est.ocupacion],
    ['Nivel escolar', est.nivel_escolar], ['Estudio universitario o técnico', est.estudio_superior], ['Estado', est.estado], ['Observaciones', est.observaciones],
  ]

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-mariano hover:underline">Volver a estudiantes</Link>
          <h1 className="mt-2 text-3xl font-semibold">{est.nombre_completo}</h1>
          <p className="text-sm text-slate-500">{est.parroquia}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-serif text-4xl font-semibold tabular-nums">{fmt(general)}</p>
            <p className="text-xs text-slate-500">Promedio del itinerario</p>
          </div>
          {perfil?.rol === 'admin' && <Link to={`/estudiantes/${id}/editar`} className="btn-sec">Editar</Link>}
        </div>
      </div>

      {/* Camino formativo: 4 estaciones */}
      <ol className="mb-8 grid grid-cols-4 gap-2">
        {semestres.map(({ s, prom, completos }) => (
          <li key={s} className="relative">
            <div className={`h-2 rounded-full ${completos === 6 ? 'bg-oro' : completos > 0 ? 'bg-mariano' : 'bg-slate-200'}`} />
            <p className="mt-2 text-sm font-semibold">Semestre {s}</p>
            <p className="text-xs text-slate-500">{completos}/6 espacios · {fmt(prom)}</p>
          </li>
        ))}
      </ol>

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {[['itinerario', 'Itinerario formativo'], ['hoja', 'Hoja de vida']].map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${pestana === k ? 'border-mariano text-mariano' : 'border-transparent text-slate-500'}`}>{t}</button>
        ))}
      </div>

      {pestana === 'hoja' ? (
        <dl className="grid gap-x-8 gap-y-4 rounded-lg border border-slate-200 bg-white p-6 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd>{v || '—'}</dd></div>
          ))}
        </dl>
      ) : (
        <div className="space-y-8">
          {semestres.map(({ s, items, prom }) => (
            <div key={s} className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="bg-tinta px-4 py-2 text-left font-serif text-base font-semibold text-white">Semestre {s}</caption>
                <thead className="bg-cielo">
                  <tr>
                    <th className="p-2 text-left">Espacio</th>
                    {CAMPOS.map(([k, t]) => <th key={k} className="p-2">{t}</th>)}
                    <th className="p-2">Definitiva</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => {
                    const n = notas[e.id]; const d = definitiva(n)
                    return (
                      <tr key={e.id} className="border-t border-slate-100">
                        <td className="p-2"><span className="text-xs text-slate-500">{e.etiqueta}</span><br />{e.nombre}</td>
                        {CAMPOS.map(([k]) => <td key={k} className="p-2 text-center tabular-nums">{fmt(n?.[k])}</td>)}
                        <td className={`p-2 text-center font-semibold tabular-nums ${d !== null && d < NOTA_MINIMA ? 'text-alerta' : ''}`}>{fmt(d)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200">
                    <td colSpan={5} className="p-2 text-right font-medium">Promedio</td>
                    <td className="p-2 text-center font-serif text-lg font-semibold tabular-nums">{fmt(prom)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

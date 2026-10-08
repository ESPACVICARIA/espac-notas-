import { CAMPOS, definitiva, promedio, fmt, NOTA_MINIMA } from '../lib/notas'

// Agrupa los espacios en 4 semestres con su promedio
export function resumen(espacios, notas) {
  const semestres = [1, 2, 3, 4].map((s) => {
    const items = espacios.filter((e) => e.semestre === s && (e.activo !== false || notas[e.id]))
      .sort((a, b) => a.orden - b.orden || a.id - b.id)
    return {
      s,
      items,
      prom: promedio(items.map((e) => definitiva(notas[e.id]))),
      completos: items.filter((e) => definitiva(notas[e.id]) !== null).length,
      total: items.length,
    }
  })
  return { semestres, general: promedio(semestres.map((x) => x.prom)) }
}

export function Camino({ semestres }) {
  return (
    <ol className="mb-8 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
      {semestres.map(({ s, prom, completos, total }) => (
        <li key={s}>
          <div className={`h-2 rounded-full ${total > 0 && completos === total ? 'bg-oro' : completos > 0 ? 'bg-mariano' : 'bg-slate-200'}`} />
          <p className="mt-2 text-sm font-semibold">Semestre {s}</p>
          <p className="text-xs text-slate-500">{completos}/{total} espacios · {fmt(prom)}</p>
        </li>
      ))}
    </ol>
  )
}

const CORTOS = { asistencia: 'Asist.', contenidos: 'Cont.', autoevaluacion: 'Autoev.', coevaluacion: 'Coev.' }
const colorNota = (d) => (d !== null && d < NOTA_MINIMA ? 'text-alerta' : '')
const nombreFormador = (f) => (f === '' ? 'Nombre por registrar' : f || 'Sin asignar')

export function TablasSemestres({ semestres, notas, formadores = {} }) {
  return (
    <div className="space-y-8">
      {semestres.map(({ s, items, prom }) => (
        <div key={s} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {/* Celular: una tarjeta por espacio */}
          <div className="sm:hidden">
            <h3 className="bg-tinta px-4 py-2 font-serif text-base font-semibold text-white">Semestre {s}</h3>
            <ul className="divide-y divide-slate-100">
              {items.map((e) => {
                const n = notas[e.id]
                const d = definitiva(n)
                return (
                  <li key={e.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500">{e.etiqueta}</p>
                        <p className="font-medium leading-snug">{e.nombre}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`font-serif text-2xl font-semibold leading-none tabular-nums ${colorNota(d)}`}>{fmt(d)}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">Definitiva</p>
                      </div>
                    </div>
                    <dl className="mt-2 grid grid-cols-4 gap-1 text-center">
                      {CAMPOS.map(([k]) => (
                        <div key={k} className="rounded bg-cielo/60 py-1">
                          <dt className="text-[10px] text-slate-500">{CORTOS[k]}</dt>
                          <dd className="text-sm font-semibold tabular-nums">{fmt(n?.[k])}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                )
              })}
            </ul>
            <div className="flex items-center justify-between gap-3 border-t-2 border-slate-200 px-4 py-3">
              <p className="min-w-0 text-sm"><span className="text-slate-500">Formador:</span> <strong>{nombreFormador(formadores[s])}</strong></p>
              <p className="shrink-0 text-right">
                <span className="block text-[10px] uppercase tracking-wide text-slate-400">Promedio</span>
                <span className="font-serif text-xl font-semibold tabular-nums">{fmt(prom)}</span>
              </p>
            </div>
          </div>

          {/* Pantalla grande: tabla */}
          <div className="hidden overflow-x-auto sm:block">
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
                  const n = notas[e.id]
                  const d = definitiva(n)
                  return (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="p-2"><span className="text-xs text-slate-500">{e.etiqueta}</span><br />{e.nombre}</td>
                      {CAMPOS.map(([k]) => <td key={k} className="p-2 text-center tabular-nums">{fmt(n?.[k])}</td>)}
                      <td className={`p-2 text-center font-semibold tabular-nums ${colorNota(d)}`}>{fmt(d)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={5} className="p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm"><span className="text-slate-500">Formador:</span> <strong>{nombreFormador(formadores[s])}</strong></span>
                      <span className="font-medium">Promedio</span>
                    </div>
                  </td>
                  <td className="p-2 text-center font-serif text-lg font-semibold tabular-nums">{fmt(prom)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

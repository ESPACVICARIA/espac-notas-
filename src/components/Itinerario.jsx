import { CAMPOS, definitiva, promedio, fmt, NOTA_MINIMA } from '../lib/notas'

// Agrupa los 24 espacios en 4 semestres con su promedio
export function resumen(espacios, notas) {
  const semestres = [1, 2, 3, 4].map((s) => {
    const items = espacios.filter((e) => e.semestre === s)
    return {
      s,
      items,
      prom: promedio(items.map((e) => definitiva(notas[e.id]))),
      completos: items.filter((e) => definitiva(notas[e.id]) !== null).length,
    }
  })
  return { semestres, general: promedio(semestres.map((x) => x.prom)) }
}

export function Camino({ semestres }) {
  return (
    <ol className="mb-8 grid grid-cols-4 gap-2">
      {semestres.map(({ s, prom, completos }) => (
        <li key={s}>
          <div className={`h-2 rounded-full ${completos === 6 ? 'bg-oro' : completos > 0 ? 'bg-mariano' : 'bg-slate-200'}`} />
          <p className="mt-2 text-sm font-semibold">Semestre {s}</p>
          <p className="text-xs text-slate-500">{completos}/6 espacios · {fmt(prom)}</p>
        </li>
      ))}
    </ol>
  )
}

export function TablasSemestres({ semestres, notas }) {
  return (
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
                const n = notas[e.id]
                const d = definitiva(n)
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
  )
}

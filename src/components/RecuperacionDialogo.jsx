import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parsearNota } from '../lib/notas'
import { formasPara, ESTADOS_REC } from '../lib/recuperaciones'

const fechaLarga = (f) => new Date(`${f}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }

// Asignar o dar seguimiento a la recuperación de una falla.
// sesion = la sesión perdida, o null cuando se recupera el retiro o seminario completo.
export default function RecuperacionDialogo({ cohorteId, espacio, estudiante, sesion, falla, recuperacion, perfil, cerrar, alGuardar }) {
  const formas = formasPara(espacio.tipo)
  const r = recuperacion
  const [forma, setForma] = useState(r?.forma ?? formas[0].nombre)
  const [otra, setOtra] = useState(r && !formas.some((f) => f.nombre === r.forma))
  const [detalle, setDetalle] = useState(r?.detalle ?? formas[0].detalle)
  const [fechaLimite, setFechaLimite] = useState(r?.fecha_limite ?? enDias(15))
  const [estado, setEstado] = useState(r?.estado ?? 'asignada')
  const [nota, setNota] = useState(r?.nota === null || r?.nota === undefined ? '' : String(r.nota).replace('.', ','))
  const [observacion, setObservacion] = useState(r?.observacion ?? '')
  const [aPlanilla, setAPlanilla] = useState(!sesion)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const caja = useRef(null)

  useEffect(() => {
    caja.current?.querySelector('select, input, textarea')?.focus()
    const esc = (e) => e.key === 'Escape' && cerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [cerrar])

  function elegirForma(nombre) {
    if (nombre === '__otra') { setOtra(true); setForma(''); setDetalle(''); return }
    const f = formas.find((x) => x.nombre === nombre)
    setOtra(false); setForma(nombre)
    if (f && (!detalle.trim() || formas.some((x) => x.detalle === detalle))) setDetalle(f.detalle)
  }

  async function guardar() {
    if (!forma.trim()) { setError('Escribe la forma de recuperación.'); return }
    const n = nota.trim() ? parsearNota(nota) : null
    if (nota.trim() && (n === null || n === undefined)) { setError('La nota debe estar entre 0,0 y 5,0.'); return }
    setTrabajando(true); setError('')
    const fila = {
      cohorte_id: cohorteId, espacio_id: espacio.id, estudiante_id: estudiante.id, sesion_id: sesion?.id ?? null,
      forma: forma.trim(), detalle: detalle.trim() || null, fecha_limite: fechaLimite || null, estado,
      nota: n, observacion: observacion.trim() || null, actualizado: new Date().toISOString(), actualizado_por: perfil?.id ?? null,
    }
    try {
      const res = r
        ? await supabase.from('recuperaciones').update(fila).eq('id', r.id)
        : await supabase.from('recuperaciones').insert(fila)
      if (res.error) throw res.error
      // Retiro o seminario sin sesiones: la nota de la recuperación aprobada puede pasar a Asistencia
      if (!sesion && aPlanilla && estado === 'aprobada' && n !== null) {
        const { error: e2 } = await supabase.from('notas').upsert({ estudiante_id: estudiante.id, espacio_id: espacio.id, asistencia: n, actualizado_por: perfil?.id, actualizado: new Date().toISOString() }, { onConflict: 'estudiante_id,espacio_id' })
        if (e2) throw e2
      }
      await alGuardar?.()
      cerrar()
    } catch (e) {
      setError(/recuperaciones/.test(e.message) ? 'Falta instalar recuperaciones.sql en Supabase.' : e.message)
      setTrabajando(false)
    }
  }

  async function eliminar() {
    if (!confirm('¿Quitar esta recuperación? La falla vuelve a quedar pendiente.')) return
    setTrabajando(true)
    const { error: e } = await supabase.from('recuperaciones').delete().eq('id', r.id)
    if (e) { setError(e.message); setTrabajando(false); return }
    await alGuardar?.()
    cerrar()
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="rec-titulo" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 print:hidden" onClick={cerrar}>
      <div ref={caja} onClick={(e) => e.stopPropagation()} className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="bg-tinta px-5 py-3 text-white">
          <h2 id="rec-titulo" className="font-serif text-lg font-semibold">{r ? 'Seguimiento de la recuperación' : 'Asignar recuperación'}</h2>
          <p className="text-sm text-blue-100">
            {estudiante.nombre_completo} · {espacio.etiqueta}{sesion ? ` · ${fechaLarga(sesion.fecha)}${sesion.tema ? ` · ${sesion.tema}` : ''}` : ` · ${espacio.nombre}`}
            {falla && <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ${falla === 'FI' ? 'bg-alerta' : 'bg-oro'}`}>{falla}</span>}
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="etiqueta" htmlFor="rec-forma">Forma de recuperación</label>
            <select id="rec-forma" className="campo" value={otra ? '__otra' : forma} onChange={(e) => elegirForma(e.target.value)}>
              {formas.map((f) => <option key={f.clave} value={f.nombre}>{f.nombre}</option>)}
              <option value="__otra">Otra forma…</option>
            </select>
            {otra && <input className="campo mt-2" placeholder="¿Cuál?" maxLength={120} value={forma} onChange={(e) => setForma(e.target.value)} />}
          </div>
          <div>
            <label className="etiqueta" htmlFor="rec-detalle">Lo que debe hacer el estudiante</label>
            <textarea id="rec-detalle" rows={3} className="campo text-sm" maxLength={1000} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="rec-fecha">Fecha límite</label>
              <input id="rec-fecha" type="date" className="campo" value={fechaLimite ?? ''} onChange={(e) => setFechaLimite(e.target.value)} />
            </div>
            <div>
              <label className="etiqueta" htmlFor="rec-nota">Nota (opcional)</label>
              <input id="rec-nota" className="campo" inputMode="decimal" placeholder="Ej. 4,5" value={nota} onChange={(e) => setNota(e.target.value)} />
            </div>
          </div>
          <fieldset>
            <legend className="etiqueta">Estado</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ESTADOS_REC).map(([k, v]) => (
                <button key={k} type="button" aria-pressed={estado === k} onClick={() => setEstado(k)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${estado === k ? v.clase : 'border-slate-200 text-slate-600'}`}>{v.nombre}</button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {sesion ? 'Al aprobarla, la falla cuenta como asistencia en la nota de Asistencia.' : 'Al aprobarla, el retiro o seminario queda como recuperado en el control de inasistencias.'}
            </p>
          </fieldset>
          {!sesion && estado === 'aprobada' && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={aPlanilla} onChange={(e) => setAPlanilla(e.target.checked)} />
              Poner la nota de la recuperación en la columna Asistencia de la planilla de {espacio.etiqueta}
            </label>
          )}
          <div>
            <label className="etiqueta" htmlFor="rec-obs">Observación del formador (opcional)</label>
            <input id="rec-obs" className="campo" maxLength={300} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </div>
          {error && <p className="text-sm text-alerta">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <button className="btn" disabled={trabajando} onClick={guardar}>{trabajando ? 'Guardando…' : 'Guardar'}</button>
            <button className="btn-sec" onClick={cerrar}>Cancelar</button>
            {r && <button className="ml-auto text-sm text-alerta underline" disabled={trabajando} onClick={eliminar}>Quitar recuperación</button>}
          </div>
        </div>
      </div>
    </div>
  )
}

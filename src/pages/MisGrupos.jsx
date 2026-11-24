import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { cargarPeriodoActual, prepararEstudiantesDelGrupo } from '../lib/periodo'
import { ordenarEstudiantes, mostrarNombre } from '../lib/planilla'
import { colorDe, IconoGrupo } from '../components/GruposCentros'

function TarjetaGrupo({ g, centro, formador, espacios, alumnos, admin }) {
  const navigate = useNavigate()
  const [verLista, setVerLista] = useState(false)
  const col = colorDe(g.cohorte_id)
  const activos = alumnos.filter((a) => a.estado !== 'retirado' && a.estado !== 'aplazado')
  const propios = espacios.filter((e) => e.semestre === g.semestre && e.activo !== false)

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-4 p-5" style={{ background: `linear-gradient(135deg, ${col.fondo}, #ffffff 70%)` }}>
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/80" style={{ color: col.tinta }}><IconoGrupo /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{centro ? `Centro ${centro}` : 'Sin centro'}</p>
          <h2 className="font-serif text-xl font-semibold leading-tight text-tinta">Semestre {g.semestre} · {g.nombre}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {[g.dia, g.horario].filter(Boolean).join(' · ') || 'Horario sin definir'}
            {admin && <> · <span className={formador ? '' : 'font-semibold text-amber-700'}>{formador ?? 'sin formador'}</span></>}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block font-serif text-3xl font-semibold leading-none text-tinta tabular-nums">{activos.length}</span>
          <span className="text-xs text-slate-500">estudiantes</span>
        </span>
      </header>

      <div className="border-t border-slate-100 px-5 py-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Digitar notas</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {propios.map((e) => (
            <li key={e.id}>
              <Link to={`/notas?grupo=${g.id}&espacio=${e.id}`}
                className="group flex h-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:border-mariano hover:bg-cielo/50">
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{e.etiqueta}</span>
                  <span className="line-clamp-2 leading-snug text-tinta">{e.nombre}</span>
                </span>
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-mariano" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m8 5 5 5-5 5" /></svg>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
        <button className="btn-sec py-1.5" onClick={() => { prepararEstudiantesDelGrupo(g.cohorte_id); navigate('/') }}>Ver estudiantes</button>
        <button className="text-sm font-semibold text-mariano hover:underline" onClick={() => setVerLista(!verLista)} aria-expanded={verLista}>
          {verLista ? 'Ocultar lista' : 'Lista rápida'}
        </button>
      </div>
      {verLista && (
        <ol className="max-h-72 list-decimal overflow-y-auto border-t border-slate-100 py-2 pl-10 pr-5 text-sm">
          {ordenarEstudiantes(activos, 'apellidos').map((a) => (
            <li key={a.id} className="py-0.5"><Link to={`/estudiantes/${a.id}`} className="text-mariano hover:underline">{mostrarNombre(a, 'apellidos')}</Link></li>
          ))}
          {!activos.length && <li className="list-none text-slate-500">Aún no hay estudiantes matriculados.</li>}
        </ol>
      )}
    </article>
  )
}

// Grupos del periodo actual: el formador ve los suyos; coordinación, todos
export default function MisGrupos({ perfil }) {
  const admin = perfil?.rol === 'admin'
  const [estado, setEstado] = useState({ cargando: true })
  const [centros, setCentros] = useState([])
  const [espacios, setEspacios] = useState([])
  const [matriculas, setMatriculas] = useState([])
  const [formadores, setFormadores] = useState([])
  const [centro, setCentro] = useState('')

  useEffect(() => {
    (async () => {
      const r = await cargarPeriodoActual(perfil)
      const ids = r.grupos.map((g) => g.id)
      const [ce, es, ms, fo] = await Promise.all([
        supabase.from('centros').select('id, nombre').order('nombre'),
        supabase.from('espacios').select('*').order('semestre').order('orden').order('id'),
        ids.length ? supabase.from('matriculas').select('grupo_id, estado, estudiantes(id, nombre_completo, estado)').in('grupo_id', ids) : Promise.resolve({ data: [] }),
        admin ? supabase.from('perfiles').select('id, nombre, correo').in('rol', ['admin', 'formador']) : Promise.resolve({ data: [] }),
      ])
      setCentros(ce.data ?? []); setEspacios(es.data ?? []); setMatriculas(ms.data ?? []); setFormadores(fo.data ?? [])
      setEstado({ cargando: false, ...r })
    })()
  }, [perfil?.id, admin])

  const porGrupo = useMemo(() => {
    const m = new Map()
    for (const x of matriculas) {
      if (!x.estudiantes) continue
      if (!m.has(x.grupo_id)) m.set(x.grupo_id, [])
      m.get(x.grupo_id).push({ ...x.estudiantes, estado: x.estado === 'inscrito' ? x.estudiantes.estado : x.estado })
    }
    return m
  }, [matriculas])

  if (estado.cargando) return <p className="text-slate-500">Cargando…</p>

  const centroDe = (id) => centros.find((c) => c.id === id)?.nombre
  const formadorDe = (id) => { const f = formadores.find((x) => x.id === id); return f ? (f.nombre || f.correo) : null }
  const visibles = (estado.grupos ?? [])
    .filter((g) => !centro || String(g.centro_id) === centro)
    .sort((a, b) => (centroDe(a.centro_id) ?? '~').localeCompare(centroDe(b.centro_id) ?? '~') || a.semestre - b.semestre || a.nombre.localeCompare(b.nombre))
  const centrosConGrupos = centros.filter((c) => estado.grupos?.some((g) => g.centro_id === c.id))

  return (
    <section>
      <header className="mb-6">
        <p className="antetitulo">{estado.periodo ? `Periodo ${estado.periodo.nombre}` : 'Seguimiento académico'}</p>
        <h1 className="titulo-pagina mt-1">{admin ? 'Grupos del periodo' : 'Mis grupos'}</h1>
        <p className="subtitulo-pagina">
          {admin ? 'Todos los grupos del periodo actual, con acceso directo a sus notas y estudiantes.' : 'Los grupos que acompañas este semestre. Entra directo a digitar las notas de cada módulo.'}
        </p>
      </header>

      {!estado.instalado ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">Falta instalar <strong>periodos.sql</strong> en Supabase para organizar los grupos por periodo.</p>
      ) : !estado.periodo ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No hay un periodo actual. {admin ? <Link to="/periodos" className="text-mariano underline">Créalo en Periodos y grupos</Link> : 'La coordinación debe abrirlo.'}
        </p>
      ) : !estado.grupos.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-semibold text-tinta">{admin ? `Aún no hay grupos en ${estado.periodo.nombre}.` : `No tienes grupos asignados en ${estado.periodo.nombre}.`}</p>
          <p className="mt-1 text-sm text-slate-500">
            {admin ? <Link to="/periodos" className="text-mariano underline">Ármalos en Periodos y grupos</Link> : 'La coordinación asigna un formador a cada grupo en «Periodos y grupos». Si ya te asignaron, recarga la página.'}
          </p>
        </div>
      ) : (
        <>
          {centrosConGrupos.length > 1 && (
            <div role="group" aria-label="Centro" className="mb-5 flex flex-wrap gap-1.5">
              {[['', 'Todos los centros'], ...centrosConGrupos.map((c) => [String(c.id), c.nombre])].map(([v, t]) => (
                <button key={v} aria-pressed={centro === v} onClick={() => setCentro(v)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${centro === v ? 'border-tinta bg-tinta text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`}>{t}</button>
              ))}
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-2">
            {visibles.map((g) => (
              <TarjetaGrupo key={g.id} g={g} centro={centroDe(g.centro_id)} formador={g.formador_nombre ?? formadorDe(g.formador_id)} espacios={espacios}
                alumnos={porGrupo.get(g.id) ?? []} admin={admin} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

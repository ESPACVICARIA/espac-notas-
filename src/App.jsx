import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useSesion } from './lib/useSesion'
import Layout from './components/Layout'
import Login from './pages/Login'
import PortalEstudiante from './pages/PortalEstudiante'
import Estudiantes from './pages/Estudiantes'
import EstudianteForm from './pages/EstudianteForm'
import Ficha from './pages/Ficha'
import Digitacion from './pages/Digitacion'
import Configuracion from './pages/Configuracion'
import Importar from './pages/Importar'

export default function App() {
  const { sesion, perfil, cargando } = useSesion()
  const [acceso, setAcceso] = useState(null) // ingreso de estudiante con documento

  if (acceso) {
    return (
      <PortalEstudiante
        acceso={acceso}
        salir={() => setAcceso(null)}
        alCambiarClave={(nueva) => setAcceso((a) => ({ ...a, clave: nueva, datos: { ...a.datos, debe_cambiar: false } }))}
      />
    )
  }

  if (cargando) return <p className="p-8 text-slate-500">Cargando…</p>
  if (!sesion) return <Login onEstudiante={setAcceso} />

  const admin = perfil?.rol === 'admin'
  const puedeCalificar = admin || perfil?.rol === 'formador'

  return (
    <Layout perfil={perfil}>
      <Routes>
        <Route path="/" element={<Estudiantes perfil={perfil} />} />
        <Route path="/estudiantes/nuevo" element={admin ? <EstudianteForm /> : <Navigate to="/" />} />
        <Route path="/estudiantes/:id" element={<Ficha perfil={perfil} />} />
        <Route path="/estudiantes/:id/editar" element={admin ? <EstudianteForm /> : <Navigate to="/" />} />
        <Route path="/notas" element={puedeCalificar ? <Digitacion perfil={perfil} /> : <Navigate to="/" />} />
        <Route path="/importar" element={admin ? <Importar /> : <Navigate to="/" />} />
        <Route path="/configuracion" element={admin ? <Configuracion /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

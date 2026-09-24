import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useSesion() {
  const [sesion, setSesion] = useState(undefined)
  const [perfil, setPerfil] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sesion) { setPerfil(null); return }
    supabase.from('perfiles').select('*').eq('id', sesion.user.id).single()
      .then(({ data }) => setPerfil(data ?? { id: sesion.user.id, rol: 'estudiante', nombre: sesion.user.email }))
  }, [sesion])

  return { sesion, perfil, cargando: sesion === undefined || (sesion && !perfil) }
}

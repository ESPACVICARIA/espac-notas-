import { supabase } from './supabase'

// Llama a la función segura "gestionar-usuarios" de Supabase
export async function gestionarUsuarios(cuerpo) {
  const { data, error } = await supabase.functions.invoke('gestionar-usuarios', { body: cuerpo })
  if (error) {
    let texto = error.message
    try {
      const detalle = await error.context?.json?.()
      if (detalle?.error) texto = detalle.error
    } catch { /* sin detalle */ }
    if (/Failed to send|not found|404/i.test(texto)) {
      texto = 'La función "gestionar-usuarios" no está instalada en Supabase. Revisa el paso de instalación.'
    }
    throw new Error(texto)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// Contraseña fácil de dictar: sin letras o números que se confundan (0/O, 1/l/I)
export function generarClave(largo = 10) {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const azar = crypto.getRandomValues(new Uint32Array(largo))
  return Array.from(azar, (n) => letras[n % letras.length]).join('')
}

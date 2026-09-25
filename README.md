# Proceso de ESPAC Notas

Plataforma de notas de la Escuela Parroquial de Catequistas (ESPAC), Diócesis de Engativá.
React + Vite + Tailwind 4, Supabase (base de datos y usuarios) y Vercel (publicación).

## Reglas de cálculo
- Cada espacio (módulo, retiro, seminario) tiene 4 notas: asistencia, contenidos, autoevaluación y coevaluación.
- La definitiva es el promedio de las notas registradas; las casillas vacías no cuentan.
- Se trunca a un decimal (3,67 queda 3,6). El promedio del semestre sale de las 6 definitivas.
- Se ajusta en `src/lib/notas.js` y en la vista `v_definitivas` de `supabase/schema.sql`.

## Puesta en línea

### 1. GitHub
```bash
npm install
git init
git add .
git commit -m "Primera versión de ESPAC Notas"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/espac-notas.git
git push -u origin main
```

### 2. Supabase
1. Crea un proyecto nuevo en supabase.com (región São Paulo es la más cercana a Colombia).
2. SQL Editor > New query > pega todo `supabase/schema.sql` > Run.
3. Authentication > Sign In / Providers: desactiva "Allow new users to sign up" (solo la coordinación crea usuarios).
4. Authentication > Users > Add user: crea tu usuario con correo y contraseña (marca "Auto confirm").
5. En SQL Editor ejecuta: `update public.perfiles set rol = 'admin' where correo = 'tu-correo';`
6. Project Settings > API: copia la Project URL y la clave anon/publishable.

### 3. Local
Copia `.env.example` a `.env` con esos dos valores y ejecuta `npm run dev`.

### 4. Vercel
1. Add New > Project > importa el repositorio `espac-notas` (framework: Vite, se detecta solo).
2. En Environment Variables agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Cada `git push` a `main` vuelve a publicar automáticamente.
4. En Supabase > Authentication > URL Configuration pon la URL de Vercel como Site URL.
5. Versión 1

# Configurar GG Mapeadores en Supabase y Vercel

La aplicación utiliza Google OAuth para iniciar sesión, Supabase para guardar el catálogo y las fotos, y RLS para que solo las cuentas autorizadas cambien carpetas y mapeadores. No se necesita ni se incluye una clave `service_role` en el sitio.

## 1. Crear el proyecto de Supabase

1. Crea un proyecto en tu propia cuenta de Supabase y guarda la contraseña del proyecto en un gestor de contraseñas.
2. En **SQL Editor**, ejecuta el contenido de `supabase/schema.sql`.
3. En **Authentication → Providers**, habilita Google.
4. Crea un cliente OAuth en Google Cloud Console. En su URI de redirección autorizada, agrega la dirección callback que muestra Supabase, normalmente `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Copia el Client ID y Client Secret de Google en la configuración del proveedor Google de Supabase. No los agregues al código del sitio.
6. En **Authentication → URL Configuration**, configura la URL de producción de Vercel y agrega las URL de desarrollo que necesites a la lista de redirecciones permitidas, por ejemplo `http://localhost:5173/**`.

Google OAuth solo permite cuentas Google. Para usar una cuenta de GitHub, habilita también GitHub como proveedor en Supabase y en el código; una dirección de GitHub por sí sola no sirve para iniciar sesión con Google.

## 2. Asignar los administradores

Cada administrador debe iniciar sesión una vez con Google para que su usuario aparezca en `auth.users`. En el SQL Editor, ejecuta `supabase/assign-admins.sql`, reemplazando los valores de ejemplo por las direcciones de correo **de Google** de Gonx4 y onyx.

No uses las contraseñas antiguas del formulario estático: el inicio ahora se delega a Google. Si ambos perfiles usan la misma cuenta Google, puedes asignar el mismo correo a las dos consultas; seguirá siendo una sola cuenta de inicio de sesión.

## 3. Conectar Vercel

1. Importa el repositorio en Vercel.
2. En **Project Settings → Environment Variables**, agrega:
   - `VITE_SUPABASE_URL`: URL del proyecto Supabase.
   - `VITE_SUPABASE_ANON_KEY`: clave pública/anon de Supabase.
3. Asigna ambas variables a Production y Preview, guarda y vuelve a desplegar.

La clave anon/publishable está diseñada para estar en el navegador; la seguridad depende de las políticas RLS incluidas en `supabase/schema.sql`. **Nunca** configures una clave `service_role` como `VITE_*` ni la publiques en el repositorio.

Para desarrollo local, copia `.env.example` a `.env.local`, reemplaza sus valores por la URL y la clave pública de tu proyecto, y ejecuta `npm install` seguido de `npm run dev`.

Este proyecto usa Vite, así que los nombres de variables son `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Si Supabase muestra los nombres `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, usa sus mismos valores con los nombres `VITE_` indicados aquí. Los ejemplos de `@supabase/ssr`, `cookies()` y middleware de Next.js no aplican a este sitio HTML/Vite.

## 4. Publicar el catálogo inicial

Después de configurar los administradores, entra a **Mapeadores → Acceso de administrador → Continuar con Google**. Si la base de datos aún está vacía, pulsa **Publicar catálogo inicial**. Esto copia las carpetas y mapeadores actuales a Supabase; después, las modificaciones se guardan en la base de datos y se muestran a todos los visitantes.

Los enlaces `http`/`https` son obligatorios tanto en el formulario como en la base de datos; la base inicial del catálogo también tiene enlaces.

Las imágenes de perfil se guardan en el bucket `avatars`, con límite de 5 MB. Los visitantes pueden ver los avatares públicos, pero cada usuario solo puede subir o cambiar archivos dentro de su propia carpeta.

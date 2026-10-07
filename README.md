# Cooperativa de Río Tercero — Control de Almuerzo Call Center

Sistema web para la gestión en tiempo real de turnos de almuerzo y recesos del área de Call Center de la Cooperativa de Obras y Servicios Públicos de Río Tercero.

---

## 🚀 Despliegue en Cloudflare Pages

El proyecto ya está completamente configurado y optimizado para ser desplegado en **Cloudflare Pages**.

### Configuración Incluida
- **`public/_redirects`**: Regla SPA para enrutar todas las peticiones a `/index.html` sin errores 404 en recargas.
- **`public/_headers`**: Encabezados de seguridad (`X-Frame-Options`, `X-Content-Type-Options`) y caché optimizado para recursos estáticos (`/assets/*`).
- **`wrangler.toml`**: Archivo de configuración de Cloudflare con salida en `dist`.
- **`npm run deploy:cf`**: Script listo para desplegar con Wrangler CLI.

---

### Opción 1: Despliegue automático con Git (Recomendado)

1. Sube tu código a un repositorio de **GitHub** o **GitLab**.
2. Ingresa al panel de [Cloudflare Dashboard](https://dash.cloudflare.com/) y dirígete a **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3. Selecciona tu repositorio y configura los siguientes parámetros de compilación:
   - **Framework preset**: `Vite` (o `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Node.js Version**: `18` o superior (por defecto Cloudflare usa Node moderno).
4. Haz clic en **Save and Deploy**. ¡Tu aplicación estará en línea con dominio `.pages.dev` y CDN global inmediata!

---

### Opción 2: Despliegue directo por Terminal (Wrangler CLI)

1. Compila la aplicación:
   ```bash
   npm run build
   ```

2. Despliega con Cloudflare Wrangler:
   ```bash
   npx wrangler pages deploy dist --project-name=cooperativa-callcenter
   ```
   *(La primera vez te pedirá autenticarte en tu cuenta de Cloudflare si no lo has hecho).*

---

### 🛡️ Credenciales de Administración
- **Perfil Supervisor**: Protegido por contraseña (`Masmejor390$`).
- **Perfil Operador**: Libre acceso para marcar salidas y retornos de almuerzo.

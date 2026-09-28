# Auto Informes - Reporte diario de venta (Onebox)

Automatiza la captura del dashboard de ventas de Onebox (Superset) y el envío
diario por email a la misma hora, a la misma lista de personas.

## Cómo funciona

1. Un job de GitHub Actions corre todos los días a las **10:00 (hora de Madrid)**.
2. Abre un navegador headless, inicia sesión en Onebox, y entra al dashboard
   usando el enlace (permalink) configurado.
3. Toma una captura de pantalla completa del dashboard.
4. Envía esa captura por email a la lista de destinatarios configurada.

> WhatsApp no está incluido todavía: el envío automático de WhatsApp requiere
> una API de negocio (Twilio, Meta Cloud API, etc.). Cuando definan el
> proveedor, se agrega como un paso más en el mismo workflow.

## Configuración (una sola vez)

### 1. Secrets de GitHub

En el repo: **Settings → Secrets and variables → Actions → New repository secret**.
Cargar estos secrets (nunca se guardan en el código):

| Secret | Valor |
|---|---|
| `ONEBOX_LOGIN_URL` | URL de login de Onebox (el enlace completo que ya usás, con el `next=`) |
| `ONEBOX_DASHBOARD_URL` | URL del dashboard con el permalink, sin pasar por `/login/` |
| `ONEBOX_USER` | Usuario de Onebox (ej. `n.romo@elchandriogroup.com`) |
| `ONEBOX_PASS` | Contraseña de Onebox |
| `SMTP_HOST` | Servidor SMTP de Microsoft 365: `smtp.office365.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Cuenta de correo que envía el reporte |
| `SMTP_PASS` | Contraseña de esa cuenta (ver nota abajo sobre SMTP AUTH) |
| `MAIL_FROM` | Igual a `SMTP_USER` normalmente |
| `MAIL_TO` | Lista de destinatarios separados por coma |

### 2. Nota importante sobre Microsoft 365 y SMTP

Microsoft 365 exige que **"Authenticated SMTP"** esté habilitado para el buzón
que envía el correo (por defecto en tenants nuevos suele estar
**deshabilitado**). Si el envío falla con un error de autenticación:

1. Pedirle al administrador de IT que habilite SMTP AUTH para esa cuenta en
   el **Centro de administración de Exchange** (o vía PowerShell:
   `Set-CASMailbox -Identity usuario@dominio.com -SmtpClientAuthenticationDisabled $false`).
2. Si la cuenta tiene MFA activado, se necesita generar una **contraseña de
   aplicación** en lugar de la contraseña normal.

### 3. Verificar los selectores del formulario de login

El script intenta detectar automáticamente los campos de usuario/contraseña
del login de Onebox con selectores genéricos. Si el login falla, hay que
inspeccionar el HTML real del formulario y ajustar (sin tocar código) estos
secrets opcionales:

- `ONEBOX_SELECTOR_USER`
- `ONEBOX_SELECTOR_PASS`
- `ONEBOX_SELECTOR_SUBMIT`

## Probar manualmente

Desde la pestaña **Actions** del repo → **Reporte de venta diaria** →
**Run workflow**. Esto corre el reporte inmediatamente (sin esperar al cron)
y deja la captura como artefacto descargable, además de enviarla por email.

## Probar en local

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env   # completar con datos reales, nunca commitear
node --env-file=.env src/send-report.js
```

## Cambiar destinatarios, horario o el dashboard

- **Destinatarios**: editar el secret `MAIL_TO`.
- **Horario**: editar los `cron:` en `.github/workflows/reporte-diario.yml`
  (están en UTC; el script valida la hora real de Madrid para evitar envíos
  duplicados en horario de verano/invierno).
- **Dashboard/filtros**: generar un nuevo permalink en Superset y actualizar
  el secret `ONEBOX_DASHBOARD_URL`.

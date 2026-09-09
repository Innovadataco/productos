# SPEC-607 · Quickstart

Recorrido de verificación manual (app en `:5005`, sesión de padre).

## 1 · Menú definitivo

1. Entra a `/dashboard/padre` en escritorio. El lateral muestra EXACTAMENTE: Inicio · A quién protejo · A quién vigilo · Reportar ▸ · Ayuda profesional ▸ · Mi perfil.
2. «Reportar» y «Ayuda profesional» nacen expandidos (Reportar, Mis expedientes / Encontrar psicólogo, Mis citas). El chevron colapsa y expande.
3. No aparecen «Mis reportes», «Suscripción» ni «Notificaciones» como ítems sueltos.
4. `/mis-reportes` sigue abriendo el listado (fuera del menú).
5. En móvil (o viewport < 640px) la barra inferior muestra los 8 destinos a un toque, Reportar incluido.

## 2 · Mi perfil unificado

1. Menú → «Mi perfil» (`/dashboard/padre/perfil`): tres acordeones — Información general (abierto), Notificaciones, Suscripción.
2. Información general: formulario con email editable, «Crear contraseña» SOLO si la cuenta es Google sin clave, historial de cambios.
3. Notificaciones: los toggles de siempre; guardan y persisten.
4. Suscripción: con plan activo se ve la vista del plan; sin plan se ve el selector (y el acordeón nace abierto).
5. Rutas viejas: `/dashboard/padre/notificaciones` → aterriza en `/dashboard/padre/perfil#notificaciones` con ese acordeón abierto. `/dashboard/padre/suscripcion?bienvenida=1` → `/dashboard/padre/perfil?bienvenida=1#suscripcion`.

## 3 · Sin plan (guardián de vigencia)

1. Con un padre sin suscripción, entra a `/dashboard/padre`: el guardián manda a suscripción → aterriza en Mi perfil con «Suscripción» abierta (sin bucle de redirects).
2. Activa el plan freemium desde ese acordeón: funciona y la página se revalida.

## 4 · Hijos sin documento

1. «A quién protejo» → alta: solo Nombres*, Apellidos*, Edad (opcional), Sexo (opcional), cuentas (opcional). No hay tipo ni número de documento.
2. Registra con solo nombre y apellidos: 201 y la ficha aparece.

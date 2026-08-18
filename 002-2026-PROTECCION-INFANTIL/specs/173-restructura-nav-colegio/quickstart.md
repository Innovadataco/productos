# Quickstart: SPEC-173 — validación manual

Base: app corriendo (`./scripts/dev-restart.sh`), un colegio con datos (cursos, materias, alertas, comité creado).

## Bloque A — Navegación

1. Login como **rector** → menú lateral muestra exactamente 8 items: Inicio · Estadísticas · Alertas · Cursos · Casos comité · Usuarios (expandible: Profesores, Comité de convivencia) · Configuración · Auditoría. NO aparecen Onboarding, Materias ni Subir lista.
2. Abrir "Usuarios" → expande y muestra Profesores y Comité de convivencia; este último lleva a `/dashboard/colegio/comite/integrantes` (admin del comité intacta: cuenta + integrantes).
3. URL directa `/dashboard/colegio/materias` y `/dashboard/colegio/cursos/unificado` siguen abriendo (sin ítem de menú).
4. Login como **comité de convivencia** → menú de 3 items: Inicio (`/dashboard/colegio/comite`) · Estadísticas (`/dashboard/colegio/comite/estadisticas`) · Gestión casos (`/dashboard/colegio/comite/casos`). Aterriza en la home nueva (casos abiertos, mis pendientes, SLA).
5. Como comité, abrir `/dashboard/colegio/comite/integrantes` → 403/redirección. Abrir `/dashboard/colegio/cursos` → 403/redirección.

## Bloque B — Fixes

- **H01**: en Alertas, botón "Escalar al Comité" de una alerta → modal pide motivo; vacío no deja continuar; con motivo → 200, alerta `escalada`, caso en bandeja del comité. Barra batch: sin "Escalar". `POST /api/colegio/alertas` con `accion: "escalada"` → 400.
- **H02**: en un curso, asignar una materia sembrada (id UUID) → 201; asignar una materia creada desde Materias (id CUID) → 201.
- **H03**: detalle de un profesor → "Agregar identificador" → el selector Plataforma lista las activas (WhatsApp, Instagram, …). Si el endpoint falla, se ve mensaje de error (no dropdown vacío silencioso).
- **H04**: Estadísticas → sección con el desglose Estudiantes / Profesores / Acudientes; números cuadran con las alertas visibles.
- **H05**: con onboarding completado, `/dashboard/colegio/onboarding` muestra "Tu colegio ya está configurado" + conteos + CTA a Inicio.
- **H06**: cada tarjeta de alerta muestra solo: Revisar · Resolver aquí · Escalar al Comité. "Resolver aquí" abre modal de bitácora → al guardar, alerta `gestionada` y nota en la bitácora del caso. Chips de estado con tooltip al pasar el mouse. Sin Asignar/Reasignar/Desasignar/Cerrar para el rector.

## Invariante de privacidad

En home y estadísticas del comité, y en todas las vistas tocadas: no aparece texto de reportes ni datos del denunciante.

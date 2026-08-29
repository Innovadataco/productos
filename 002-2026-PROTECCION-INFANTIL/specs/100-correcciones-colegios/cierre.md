# Cierre — Spec 100: Correcciones módulo Colegios (+ Comité)

**Fecha**: 2026-07-27 · **Rama**: `feature/001-scaffolding`

## Lo hecho (11/11 puntos)

- **C-1**: cascada País→Departamento→Ciudad en `/dashboard/admin/colegios/nuevo` (nuevo
  `GET /api/departamentos`, `/api/ciudades?departamentoId=`, ruta pública en proxy).
- **C-2**: "Tipo de período" mensual/semestral/anual → fin calculado EN SERVIDOR (+1/+6/+12
  meses) y fecha fin oculta en UI; `LIBRE` (nuevo valor del enum `TipoPeriodoServicio`,
  migración aditiva) → fechas manuales.
- **C-3**: `fin > inicio` validado en cliente y servidor (POST y PATCH); date picker de fin
  con `min=inicio`.
- **C-6**: grado de curso = select 1–11 (`GRADO_OPTIONS`).
- **C-4**: campo "Tipo" eliminado de "Agregar identificador"; el servidor infiere el tipo
  (email/teléfono/nick). La columna histórica se conserva.
- **C-5**: Plataforma ya era select del catálogo `Plataforma` (verificado; sin cambios).
- **I-25 (🔴)**: causa raíz — el proxy daba 403 a `GET /api/me` para SCHOOL_ADMIN y el header
  caía a "Iniciar sesión". Fix: `esRutaPermitidaSchoolAdmin` (colegio + `/api/me` +
  `/cambiar-password`) y `ColegioNav` con `ColegioLogoutButton`.
- **C-9**: enforcement central de `debeCambiarPassword=true` en los layouts
  `/dashboard/colegio` y `/dashboard/admin` (redirect a `/cambiar-password`; el bucle del
  proxy quedó resuelto con el mismo fix de I-25).
- **C-7**: no existe botón "elaborar/iniciar sección" en el código. El único inhabilitado
  permanente posible era "Descargar PDF" tras un error de carga → ahora `ErrorState` con
  reintento. Documentado por si el CEO se refería a otra cosa (posiblemente al propio I-25).
- **C-8**: logo enlaza al home del rol autenticado.
- **COM-1/2**: rótulos "Cuenta de acceso del comité" (credencial temporal del sistema) vs
  "Integrantes del comité (roster, sin acceso; email de contacto)".

## Gate

tsc ✅ · lint ✅ (0 errores; 1 warning preexistente) · **906/906 tests** ✅ (21 nuevos:
periodo, inferencia de tipo, proxy school-admin, colegios POST, identificadores) · build ✅.

## Notas

- Migración `20260727073254_tipo_periodo_libre` (aditiva: `ALTER TYPE ADD VALUE 'LIBRE'`),
  aplicada en dev y test; llega a prod con `migrate deploy` en el deploy.
- Los `DROP INDEX` HNSW que Prisma coló en el SQL generado fueron eliminados a mano y los
  índices verificados (`scripts/verify-hnsw-indexes.ts`).
- Verificación visual final: en el deploy a producción (cola 002-PI-014, cierre).

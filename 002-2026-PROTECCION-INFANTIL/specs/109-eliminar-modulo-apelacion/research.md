# Research — SPEC-109 (D-34)

**Date**: 2026-07-28

## PASO 0 (obligatorio, ejecutado ANTES de proponer)

Consulta directa a la BD de producción (`pi-db`, 2026-07-28):

```sql
SELECT COUNT(*) FROM "ApelacionIdentificador";  -- 0
```

**(a) = 0 filas; (b) = 0 en RECIBIDA o EN_REVISION.** No hay datos de personas reales:
la eliminación con migración DROP es segura y no requiere decisión de datos de ZEUS.
Si al momento de aplicar la migración en prod apareciera alguna fila, se PARA y se reporta.

## Estado verificado del módulo (en fuente)

- Página pública `src/app/apelar/page.tsx`; APIs públicas `src/app/api/apelaciones/`
  (solicitar, verificar, [token]); APIs admin `src/app/api/admin/apelaciones/` (route,
  [id], vencer); página admin `src/app/dashboard/admin/apelaciones/page.tsx` +
  `src/components/modules/AdminApelaciones.tsx`.
- Dominio: `src/lib/apelaciones.ts`, `scripts/job-apelaciones-vencimiento.ts` (nunca
  programado → ocultamiento permanente), `src/lib/sms.ts` (usado SOLO por
  `api/apelaciones/verificar/route.test.ts` → eliminable).
- Modelo `ApelacionIdentificador` (tabla vacía en prod) + enum `EstadoApelacion` +
  relaciones en `Usuario` (apelaciones, apelacionesAsignadas) e
  `IdentificadorReportado` (apelaciones).
- Referencias huérfanas: proxy (`PUBLIC_ROUTES`), rate-limit (`apelacion`,
  `apelacion_sms`), catálogo de permisos (`apelaciones`), nav-items/AdminNav, asignador
  (rama `apelacionId`), `puedeGestionarApelacion`, test-utils y reporte-test-utils
  (parámetros del módulo), `scripts/smoke-apelaciones.ts`.

## Decisiones

- **Decisión: eliminación pura, sin reemplazo.** El rediseño es D-34 (otra spec). Mientras
  tanto, la disputa Ley 1581 se atiende por el canal manual existente (contacto
  administrativo), que es como se operaba de hecho.
- **Decisión: migración DROP aunque la regla general es "aditivas".** Justificación
  documentada: el instructivo la ordena y la tabla está verificada vacía en producción.
- **Decisión: `actualizarVisibilidadPublica` intacto.** Es el dueño único del flag de
  visibilidad tras la eliminación (antes competía con el flujo de apelación — precisamente
  uno de los defectos auditados).
- **Decisión: `src/lib/sms.ts` se elimina con el módulo.** Verificado por grep: su único
  consumidor es el test de verificación de apelaciones, que también se elimina.

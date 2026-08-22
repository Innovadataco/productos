# Research — SPEC-206

## Decisiones ya cerradas por ZEUS / contexto

1. **`sesionLogId` en JWT payload**: se aprovecha el token existente para evitar duplicar estado de sesión.
2. **Helper de login en vez de middleware global**: el login es el único punto de inicio de sesión explícito.
3. **Worker pg-boss separado**: patrón canónico del proyecto (`ensureQueue` + `boss.schedule` + `boss.work`).
4. **Sub-tab dentro de estadísticas**: reutiliza navegación existente y sigue D-72/D-73/D-74.
5. **IP hasheada con `ANTI_ABUSO_SALT`**: consistencia con SPEC-052 y SPEC-141.

## Patrones del repo a reutilizar

### Rate-limit existente
`src/lib/rate-limit.ts` usa PostgreSQL con scopes configurables. Se añadirá scope `session_ping` con ventana fija.

### Auth
`src/lib/auth.ts` centraliza `verifyAuth`, `createToken` y `setSessionCookie`. El cambio es mínimo y retrocompatible.

### Worker de referencia
`scripts/worker-reportes.mjs` líneas 66-73 (`ensureQueue`) y 144-152 (registro de colas). `scripts/worker-sesiones.mjs` replicará la estructura pero con advisory lock distinto.

### Paginación estándar
`DEFAULT_PAGE_SIZE = 25`, `MAX_PAGE_SIZE = 100`. Se aplica en `GET /api/admin/sesiones`.

### Permisos de módulos
`src/lib/permisos-catalogo.ts` es la fuente única. Se añade `sesiones_admin` como hijo de `estadisticas`.

## Preguntas resueltas

| Pregunta | Respuesta |
|---|---|
| ¿Dónde va la vista admin? | Sub-tab "Sesiones" en `/dashboard/admin/estadisticas/operacion?tab=sesiones` |
| ¿Cómo se invalida una sesión forzada? | `verifyAuth` rechaza JWT si `sesionLogId` apunta a sesión cerrada |
| ¿Qué pasa con tokens sin `sesionLogId`? | Siguen aceptados (retrocompatibilidad) |
| ¿IP en claro? | Nunca; sha256 con `ANTI_ABUSO_SALT` + truncamiento previo |
| ¿Tabla propia o reutilizar AuditLog? | Tabla propia `SesionLog`; AuditLog solo para eventos de cierre |

## Referencias

- Instructivo: `Gestion-de-proyectos/.../INSTRUCTIVO-002-PI-120-INFRA-SESSION-LOG.md`
- Brief: `Gestion-de-proyectos/.../BRIEF-ANALISIS-DINERO-VS-VALOR.md` §13 + §15 fila 0
- Constitution: `.specify/memory/constitution.md`
- Patrón worker: `scripts/worker-reportes.mjs`
- Patrón hash IP: `src/lib/anti-abuso/fuente-reporte.ts`

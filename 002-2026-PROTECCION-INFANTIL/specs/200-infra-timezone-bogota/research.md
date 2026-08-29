# Research: SPEC-200 — INFRA · Timezone Bogotá (002-PI-097)

## Hallazgos verificados en fuente

- `docker-compose.prod.yml` (2026-08-22): ninguno de los 4 servicios (`app`, `worker`, `monitor`, `simulador-abuso`) declara `TZ`. Heredan UTC del host/contenedor base.
- `docker-compose.yml` (dev): tampoco declara `TZ`; aunque es local, es consistente agregarlo para reproducir el entorno de prod.
- `package.json` (2026-08-22): no incluye `date-fns` ni `date-fns-tz`.
- `src/lib/colegio/fechas-humano.ts` (2026-08-22): usa `fecha.getDay()`, `fecha.getDate()`, `fecha.getMonth()`, `fecha.getFullYear()` directamente → depende de la timezone del runtime.
- `src/lib/colegio/fechas-humano.test.ts` (2026-08-22): no tiene tests a las 23:59/00:01; los tests actuales usan horas de mediodía que no detectan el bug.
- `src/lib/colegio/avisos.ts` (2026-08-22): ya implementa `diaBogota()` con `Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" })` — patrón válido que puede reutilizarse o reemplazarse por `date-fns-tz`.
- `src/lib/render-informe-mensual.tsx` y `src/lib/expediente/expediente-forense.ts`: usan `toLocaleDateString("es-CO", ...)` sin `timeZone`.
- `src/lib/apelaciones.ts`: aritmética de días hábiles con `getDay()`/`setDate()` del sistema.
- `prisma/schema.prisma` (2026-08-22): la mayoría de los `DateTime` no tienen `@db.Timestamptz`. Algunos pocos usan `@db.Timestamptz(3)` y `RegistroAvisoColegio.dia` usa `@db.Date`.
- Grep preliminar: 907 ocurrencias de `new Date(` en `src/`; muchas son tests o construcción de fechas ISO, pero hay aritmética de días en `apelaciones.ts`, `apelacion-mantenimiento.ts`, `spam/analitica.ts`, `spam/sla.ts`, `email.ts`, `colegio/informe-mensual.ts`, `simulacion/progreso.ts`.
- Decisión vinculante [D-69](../../../Gestion-de-proyectos/01-PROYECTOS/001-2026-PROTECCION_INFANTIL/03-EJECUCION/05-DECISIONES.md): timezone `America/Bogota` hardcoded v1 para toda la plataforma.
- BRIEF-MOTOR-NOTIFICACIONES.md §5.1 y §9: todos los tiempos de notificaciones (`T-5`, `T-1`, `T+2`, `T+3`) se calculan en día calendario Bogotá con `date-fns-tz`.

## Decisiones tomadas

- No modificar `SHOW TIME ZONE` de Postgres; se mantiene `Etc/UTC` para evitar efectos secundarios en queries existentes.
- Fijar `TZ=America/Bogota` en los 4 contenedores de aplicación para que `new Date()` formatee correctamente en hora local.
- Usar `@db.Timestamptz(6)` como estándar único para todos los momentos, unificando los pocos `@db.Timestamptz(3)` existentes.
- Adoptar `date-fns-tz` como única librería para aritmética temporal con timezone; `date-fns` base se agrega como dependencia requerida.
- Los campos `@db.Date` (día calendario sin hora) se mantienen sin cambios.
- Frontend: forzar `timeZone: "America/Bogota"` en todo formateo; no se delega a la timezone del navegador salvo justificación explícita.
- No tocar `src/lib/ai/**` según candado del instructivo.

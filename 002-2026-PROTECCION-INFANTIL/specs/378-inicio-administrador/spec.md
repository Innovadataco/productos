# SPEC-378 · Inicio del administrador

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: pedido de Jelkin (CEO idc-ab).

## El problema

El administrador tiene 53 pantallas y ninguna es un inicio: al entrar cae
directo en la bandeja de reportes (una lista). Cuando algo se rompe en
silencio —correos que dejan de salir por cuota agotada, motor IA rechazando
en serie, reportes huérfanos, workers muertos, clientes por vencer, comité
con casos vencidos— nadie se entera hasta que Jelkin no recibe su correo.

## Requisitos

- **FR-001**: Nueva ruta `/dashboard/admin/inicio` que agrega y muestra las
  señales de OPERACIÓN. Cuando NO hay nada roto, la pantalla dice «Todo
  tranquilo. Nada requiere tu atención ahora.». Cuando algo se rompió,
  muestra una tarjeta por señal con frase + botón «Resolver» al lugar donde
  se arregla.
- **FR-002 (CANDADO DURO · regla de Jelkin)**: NUNCA rojo. Todas las
  tarjetas usan ámbar. La prioridad (`alta` / `media`) se separa por
  sección, no por color. Un test barre la pantalla y afirma cero clases
  `bg-red-*`/`text-red-*`/`border-red-*`/... y cero `rgb(185,28,28)`.
- **FR-003**: `/dashboard/admin` (raíz) redirige a `/dashboard/admin/inicio`
  cuando el admin tiene el módulo `inicio_admin`; si no lo tiene, cae a la
  lógica actual (bandeja o siguiente módulo permitido). A prueba de permisos.
- **FR-004**: Un endpoint lector único `GET /api/admin/inicio/senales` que
  la página consume. `Cache-Control: no-store`.
- **FR-005**: Cada señal derivada de queries en vivo tiene su umbral en
  `ParametroSistema` (seed idempotente, patrón `update:{}` — nunca pisa lo
  que el CEO ajuste). Umbrales sembrados:
  - `monitoreo.notif.fallidas_24h_umbral` (default 5)
  - `monitoreo.analisis.fallidos_racha_umbral` (default 5)
  - `monitoreo.reportes.sin_dueno_horas` (default 24)
  - `monitoreo.reportes.sin_dueno_umbral` (default 3)
  - `monitoreo.reportes.revision_manual_umbral` (default 20)
  - `monitoreo.vigencia.aviso_dias` (default 7)
- **FR-006**: El agregador REUSA lo que ya recoge `pi-monitor` en
  `HealthProbe` (worker, ollama, tailscale, indices, notif_pendientes_vencidas)
  y calcula EN VIVO las señales que hoy no tienen sonda propia (S1 correos,
  S2 racha IA, S3 huérfanos, S4 revisión manual reales, S6 vigencias, S7
  comité). No se inventan sondas nuevas en `monitor-probes.mjs` — si la
  latencia lo pide, se mueven en un segundo PR.

## Impacto en arquitectura:

- Un nuevo módulo permisible `inicio_admin` en `CATALOGO_MODULOS` (orden 5,
  admin). Los ADMIN lo reciben por default via `ADMIN: modulosSeed.map(...)`
  en `seed-modulos-grants.ts`.
- Un nuevo servicio de agregación `src/lib/dal/services/inicio-admin.ts` con
  su endpoint `GET /api/admin/inicio/senales/route.ts`.
- Un nuevo item de nav (`Inicio`) primero de `ADMIN_NAV_ITEMS`.
- La landing raíz `/dashboard/admin/page.tsx` agrega un redirect condicional
  ANTES de la lógica actual: no muevo la bandeja, no rompo bookmarks.

## Fuera de alcance

- Mover S1/S3/S4/S6/S7 a sondas de `monitor-probes.mjs` con persistencia en
  `HealthProbe`. Queda como segundo PR si la latencia del endpoint pasa de
  ~1s en producción.
- Rediseñar `/dashboard/admin/monitoreo/worker` o `salud-motor`. El Inicio
  solo enlaza a esas rutas destino.

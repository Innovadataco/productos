# SPEC-815 · Antes de EMITIR hay que ser seguro: ni identificador, ni correo, ni error crudo a stdout

**Feature Branch**: `work/pi-SPEC-815-emision-sin-pii`
**Created**: 2026-10-01
**Status**: DESARROLLO
**Base**: `main`
**Precondición de**: I-438 (subir la emisión) y de la (B) de SPEC-810 (revertir el swallow de Next).

## Contexto

I-438 se abrió porque producción **no emite** (393 bytes en 38 h) y el camino era **emitir más**. El mapa
de emisión (medido por Dev 3) invirtió el orden: subir la emisión **encendería la salida del identificador
reportado**, que es PII del sujeto del dato. **Primero seguro, después verboso.** Esta spec hace lo primero.

Clasificación de PII acá (decisión del CEO): **identificador reportado** y **correo**. Relato, nombre y
teléfono ya están limpios y verificados (el único `texto` logueado es su `.length`).

## Decisión y razón

El identificador NO puede estar en una línea de log en **ningún** nivel. Hoy estaba a salvo **por el
nivel** (`LOG_LEVEL=warn` suprime `logger.info`), y eso no es protección: es **coincidencia** — el nivel se
calcula UNA vez al cargar `src/lib/logger.ts`, así que depende de una variable de despliegue que nadie
revisa por su consecuencia de seguridad. Y el logger pasaba los args **crudos**, sin serializar.

## Alcance — cuatro piezas (la 3 se extendió por medición)

1. **Enmascarar los correos.** Fuente única nueva `src/lib/mask-email.ts` (`maskEmail`, `x***@dominio`,
   endurecida: sin `@` → `***`, nunca el valor crudo). Se aplicó en los 2 sitios del mapa (`digest-semanal`,
   `apelacion-mantenimiento`) **y en 3 más que el candado destapó** (todos `logger.info`, hoy suprimidos pero
   LATENTES): `circulo-confianza/notificaciones` («Enviando alerta»), `hijos/notificaciones` («Enviando
   aviso»), `email/notificacion-spam` («enviada a»). Los 3 inline de auth ya enmascaraban (se dejan).
2. **Sacar el identificador de las líneas latentes** → `reporte.id` (interno, no PII; precedente del worker).
   Sitios: `colegio/alertas:121`, `circulo-confianza/notificaciones` (omitida + «Enviando alerta»).
3. **El logger serializa los errores con `safeErrorMessage`** (`src/lib/errors.ts:60`) — chokepoint
   estructural para el ARG (`logger.error("…", err)`), incluido un Error anidado en objeto/arreglo plano.
   **Extensión medida (decisión CEO): también las ~21 interpolaciones de error CRUDO** (`${err.message}` /
   `${String(err)}`) en emisión de servidor → `safeErrorMessage(err)`. Uniforme, sin excepciones (exceptuar
   las de «fuera de PII» sería un allowlist = inventario, lo contrario de imposibilidad estructural). El
   worker corre con `tsx` → puede importar `safeErrorMessage`.
4. **Candado de sitio de emisión** (ver abajo).

## Candado — `src/lib/emision-sin-pii-815.candado.test.ts` (carril `test:unit`, BLOQUEA vía `pi-gate`)

- **(A) RUNTIME con `LOG_LEVEL=debug`** (el nivel MÁS permisivo, no el de prod): un candado que pasara
  porque el nivel suprime la línea certificaría la coincidencia, no la seguridad. Afirma que el logger
  reemplaza un Error (arg o anidado) por `safeErrorMessage`; control de doble sentido (la PII SÍ está en el
  error y NO sale; el `console.error` crudo SÍ la dejaría salir).
- **(B) ESTÁTICO (independiente del nivel por construcción)**: un lexer extrae el cuerpo de cada
  `console.*`/`logger.*` respetando strings y template literals (multi-línea y `)` dentro de un template NO
  lo engañan). Rule-1: no interpola `.identificador`, correo sin `maskEmail`, relato/textoOriginal/teléfono.
  **Rule-2: no interpola el error crudo (`.message`/`String(err)`); `safeErrorMessage(err)` queda VERDE.**
  Superficie: `src/lib` + `src/app/api` + `scripts/worker-*.mjs`. Los scripts OPERATIVOS no entran (el
  operador es el destinatario legítimo).
- **RED-first verificado**: una violación plantada MULTI-LÍNEA con `(x=1)` dentro del template pone rojas
  Rule-1a y Rule-2 (el lexer no se deja engañar).

## FUERA de alcance

**Agregar** emisión (eso es I-438 y va DESPUÉS) · revertir el swallow de Next (810-B, depende de ésta) · los
scripts operativos · redacción genérica por patrones en el logger (sobre-redactar es su propio defecto) ·
consolidar los 3 `maskEmail` inline de auth (ya enmascaran; cleanup opcional).

## Impacto en arquitectura:

- **Esquema / proxy / datos:** SIN cambios.
- **Navegación:** SIN cambios (no toca pantallas ni menú).
- **Worker / alias:** `monitoreo/incidentes.ts` (cadena del worker) importa `safeErrorMessage` por ruta
  RELATIVA (`../errors.ts`), no por alias `@/lib/` — arch:check (f) VERDE.
- **Tests:** candado nuevo en el carril `test:unit` (corre y BLOQUEA vía `pi-gate`). `src/lib/mask-email.ts`
  queda cableado (lo importan 5 sitios) → no es huérfano. arch:check VERDE.

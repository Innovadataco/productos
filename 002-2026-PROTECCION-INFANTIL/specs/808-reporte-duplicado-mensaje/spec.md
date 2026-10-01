# SPEC-808 · Reporte duplicado: de «acusación + callejón» a «ya lo tienes» (string del API + comentario)

**Feature Branch**: `work/pi-SPEC-808-reporte-duplicado-mensaje`
**Created**: 2026-09-30
**Status**: DESARROLLO
**Base**: `main`

## Contexto

Dos defectos en `src/app/api/reportes/route.ts`, en el mismo lugar:
1. **:289** emitía el 429 `DUPLICATE_REPORT` con **«Ya reportaste este identificador recientemente»** —
   culpa al usuario de una decisión del SISTEMA (guardar un caso por cuenta cada 30 días) y no da salida.
2. **:281** tenía un comentario viejo: *«anónimo y otros usuarios siguen con 429 (candado 26)»*. **Falso:**
   el dedup es **autenticado-only** (`reporte-creation.ts`: el bloque está guardado por `if (usuarioId)`),
   así que el ANÓNIMO nunca llega a ese 429 — su caso lo maneja el rate-limit SOFT (POSIBLE_SPAM → 201).
   Y la referencia a «candado 26» estaba vencida (ese candado es del comité, no de este 429).

## Alcance (lo acotado por el CEO: el API, no la tarjeta)

- **String :289** → alineado al encuadre de la forma (FORMA-SPEC808): **«Ya tienes un reporte sobre esta
  cuenta»** — enuncia el estado, no el acto repetido; sin «ya reportaste… recientemente».
- **Comentario :281** → reescrito a la conducta real (dedup autenticado-only, con el porqué: presupone
  identidad; un «duplicado» anónimo es indistinguible de dos personas reportando la misma cuenta, la
  señal que el producto recoge) + quitada la referencia vencida a «candado 26».
- **NO se toca la conducta** (dedup, ventana de 30 días, normalización del identificador — sin defecto,
  SPEC-806 retirada) ni la **tarjeta** `ReporteWizard` (las 3 salidas son carril de Dev-1, forma «Para
  Dev-1»).

## PARÁ (verificado contra el código)

- El string no afirma ninguna conducta (enuncia un hecho verdadero: el usuario ya tiene un reporte;
  dedup por-usuario). No hay «podés verlo en Mis reportes» supuesto → no PARÁ.
- **Nota de audiencia (el diff no la muestra):** el 429 de :289 lo recibe un AUTENTICADO **no-PARENT**
  (el PARENT recibe la oferta 200; el anónimo nunca llega). La forma es padre-facing (tú/«cuenta»); apliqué
  su encuadre al string de respaldo. Si Diseño prefiere voz «usted»/«identificador» para ese respaldo
  interno, es un ajuste de una línea — queda señalado.

## Candado

`reporte-duplicado-mensaje.candado.test.ts`: la fuente de route.ts NO contiene el string acusatorio viejo
ni «siguen con 429» ni «candado 26»; SÍ contiene el encuadre nuevo y «autenticado-only». Barrido de la
fuente real (no una lista).

## Impacto en arquitectura:

- **Esquema / proxy / navegación / datos:** SIN cambios. Solo copy (un string) + un comentario.
- **Tests:** nuevo candado en el carril `test:unit` (corre y bloquea vía `pi-gate`). Los route tests
  (route.test.ts, route-atomicidad.test.ts, 39) siguen verdes — la conducta no cambia.

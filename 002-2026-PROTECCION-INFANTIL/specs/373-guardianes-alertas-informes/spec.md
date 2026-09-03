# SPEC-373 · Guardianes desalineados · alertas del colegio (I-251) e informes del rector (I-266)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: plan de guardianes desalineados (07-CALIDAD/08) + hallazgo Calidad/CEO I-266

## Para qué

Dos handlers del colegio están mal alineados con las reglas del producto — en direcciones opuestas — y hoy Calidad reportó que un colegio VENCIDO puede firmar un informe forense verificable públicamente.

**I-251 (viejo, plan del 01-09).** Los 7 sitios de handler de `/api/colegio/alertas/*` traían un `verificarVigenciaColegio` propio que contradice la regla dura de Jelkin (*«las alertas de menores NUNCA se bloquean»*, `guardias.ts:202-206`). El middleware ya exime toda la familia por prefijo, pero el handler la contradecía y ganaba porque corre después. Efecto probado: con el colegio vencido la bandeja abría **vacía y muda**, y —peor que la lectura— **escalar, asignar, anotar y cambiar estado también caían**. Un colegio en mora no podía ni tramitar un caso ya abierto.

**I-266 (nueva, del 02-09).** `POST /api/colegio/casos/[id]/informes` no tenía ningún guard más allá de `verifyAuth("SCHOOL_ADMIN")`. Un colegio con la vigencia VENCIDA firmaba un informe forense y quedaba **verificable públicamente** en `/verificar/<código>` para siempre (SPEC-234). Evidencia: INF-2026-0002 emitido con colegio vencido, verificable en prod.

Los dos son la misma clase de problema — un guard que no está alineado con la regla del producto —, uno por defecto y otro por exceso, y por eso van juntos en el mismo SPEC.

## Qué cambia

### I-251 · Alertas: FUERA el guard de vigencia

Se quita el bloque `verificarVigenciaColegio(user.id)` y su import de los 6 archivos:

- `alertas/route.ts` — GET (bandeja) y POST (acciones en lote), 2 sitios.
- `alertas/[id]/route.ts` — GET (detalle del caso).
- `alertas/[id]/asignar/route.ts` — POST (asignar responsable).
- `alertas/[id]/escalar/route.ts` — POST (escalar al comité).
- `alertas/[id]/estado/route.ts` — PATCH (cambio de estado).
- `alertas/[id]/notas/route.ts` — POST (anotar en la bitácora).

Se dejan `verifyAuth("SCHOOL_ADMIN")` y `assertModulo(...)`. Un colegio sin el módulo `colegios_gestion` (o `colegios_comite` para escalar) sigue recibiendo 403.

### I-266 · Informes: ENTRA el guard de vigencia (SOLO EMISIÓN)

Se agrega `verificarVigenciaColegio(user.id)` al **POST** de `casos/[id]/informes/route.ts`. Si el colegio no está vigente, 403 con el mensaje humano de vigencia — el mismo que ya usan `alertas/[id]/asignar` y `alertas/[id]/escalar`.

**No se toca** el GET del historial, ni el GET público `/api/publico/verificar-pdf/[hash]` (sin auth). Regla del CEO: quien verifica un informe ya emitido es un tercero ajeno al cobro del colegio; bloquearlo rompería la promesa de que cualquiera puede comprobar un informe.

## Candados

- **Regla del producto siempre gana**: cada handler queda alineado con la regla que declara `guardias.ts`, no con una segunda decisión propia.
- **Candado 26**: quitar el guard de vigencia no puede haber quitado también el de módulo. El test *"sin módulo colegios_gestion sigue 403"* le saca el permiso al rol vía `permisoModulo.activo=false` y afirma que `assertModulo` sigue devolviendo 403 — no fue un "abrir todo por descuido".
- **La lectura de informes NUNCA se bloquea**: test explícito que emite un informe, vence el colegio, y afirma que el `GET /informes` sigue devolviendo 200 con el historial.
- **Assert fuerte en el 403 de informes**: cuando el colegio vence, la respuesta es 403 con la palabra "vencido" y `prisma.informeCaso.count = 0` — el bloqueo no puede ser cosmético.

## Impacto en arquitectura: no

Cambios adentro de handlers HTTP existentes. Sin modelo, sin migración, sin servicios nuevos. Los tests van en un archivo nuevo (`vigencia.spec-373.test.ts`) que corre en la suite de integración; el conteo de rutas no cambia (no hay ruta nueva ni menos).

## Hallazgo fuera de scope (reportado al CEO, no arreglado acá)

`asignarAlerta` (`src/lib/colegio/alertas.ts:382`) llama a `logAudit` con `accion: "COLEGIO_ALERTA_ASIGNADA" as AccionAudit` — el enum Prisma `AccionAudit` no incluye ese valor. Todo POST a `/asignar` responde 500 (bug preexistente, no introducido por este SPEC). Nuestro test de asignar asserts `status !== 403` para probar que el guard de vigencia se fue; el 500 es otra falla que va en un radicado aparte.

## Cómo se probó

- **Integration** (`vigencia.spec-373.test.ts`, 8 tests):
  - 7 handlers de alertas con colegio VENCIDO → 200/201 con dato guardado (assert fuerte donde aplica). Asignar → status ≠ 403 (por el bug preexistente).
  - Candado 26: sin módulo → 403.
- **Integration** (`informes/route.test.ts`, 2 tests nuevos):
  - POST con colegio VENCIDO → 403 y `informeCaso.count = 0`.
  - GET del historial con colegio VENCIDO → 200 con los informes ya emitidos (lectura no se bloquea).
- Regresión de los tests preexistentes (`alertas/route`, `[id]/route`, `escalar/route`, `notas/route`, `informes/route`): 29 + 8 = 37/37 verdes.
- Local: `tsc --noEmit` limpio, `arch/tokens/locks/ratchets` verdes, lint verde.

## Pendiente

- Verificación en vivo del CEO en dev/prod: colegio vencido no emite informe (403 con mensaje humano); colegio vencido sigue leyendo el historial; `/verificar/<código>` sigue abierto; bandeja de alertas con colegio vencido lista y actúa.
- Bug enum `AccionAudit` (POST /asignar → 500): radicado aparte para arreglar el enum y el service.

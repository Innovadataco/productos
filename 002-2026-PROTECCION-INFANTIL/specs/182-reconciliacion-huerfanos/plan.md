# Implementation Plan: SPEC-182 — Reconciliación de reportes huérfanos (I-60)

**Branch**: `work/002-pi-077` | **Date**: 2026-08-19 | **Spec**: [spec.md](./spec.md)

---

## Summary

Añadir un job periódico en `scripts/worker-reportes.mjs` que reintente la asignación de operadores a reportes `REVISION_MANUAL` sin `operadorId`, más un script one-shot para los 26 legacy. Cero cambios en la lógica de asignación; solo orquestación, parámetros y observabilidad.

---

## Cambios exactos

### 1. Parámetros de sistema

Sembrar en `prisma/seed.ts` (o migración aditiva si el seed no cubre updates idempotentes):

```ts
{
  clave: "operadores.reconciliacion_intervalo_min",
  valor: "15",
  tipo: "NUMBER",
  descripcion: "Intervalo en minutos entre ciclos de reconciliación de reportes huérfanos",
  editable: true,
},
{
  clave: "operadores.reconciliacion_enabled",
  valor: "true",
  tipo: "BOOLEAN",
  descripcion: "Activa/desactiva el job de reconciliación de reportes huérfanos",
  editable: true,
},
```

El parámetro es efectivo: al arrancar el worker se lee `operadores.reconciliacion_intervalo_min` y se construye la expresión cron `*/X * * * *` que se pasa a `boss.schedule`. Si el CEO cambia el valor en ConfigPanel, un restart del worker aplica el nuevo intervalo.

### 2. Worker periódico en `scripts/worker-reportes.mjs`

Añadir tras la cola `reportes-reconciliacion` existente:

```js
await ensureQueue("operadores-reconciliacion-huerfanos");

const intervaloMin = Number.parseInt(
  (await getParametroSistemaValor("operadores.reconciliacion_intervalo_min")) ?? "15",
  10
);
const cronReconciliacionHuerfanos =
  Number.isFinite(intervaloMin) && intervaloMin >= 1 && intervaloMin <= 59
    ? `*/${intervaloMin} * * * *`
    : "*/15 * * * *";
await boss.schedule("operadores-reconciliacion-huerfanos", cronReconciliacionHuerfanos, {}, { tz: "America/Bogota" });

await boss.work("operadores-reconciliacion-huerfanos", async () => {
  const { reconciliarHuerfanos } = await import("../src/lib/operadores/reconciliacion-huerfanos.ts");
  const resumen = await reconciliarHuerfanos();
  if (!resumen.deshabilitado && resumen.encontrados > 0) {
    console.log(`[RECONCILIACION-HUERFANOS] Ciclo: ${resumen.encontrados} encontrados, ${resumen.asignados} asignados, ${resumen.fallidos} fallidos`);
  }
  return { success: true, ...resumen };
});
```

### 3. Servicio `src/lib/operadores/reconciliacion-huerfanos.ts`

Nueva función `reconciliarHuerfanos()`:

1. Leer `operadores.reconciliacion_enabled`; si false, retornar `{ encontrados: 0, asignados: 0, fallidos: 0, motivo: "deshabilitado" }`.
2. Buscar reportes huérfanos con Prisma (usando `ReporteRepository` o `prisma` según frontera DAL).
3. Por cada reporte:
   - Llamar `asignarOperadorAReporte(reporte.id)`.
   - Si `asignado: true`, contar como asignado.
   - Si `asignado: false`, contar como fallido y guardar `razon` (para diagnóstico, no para mostrar al usuario).
   - Capturar excepciones y contar como fallido.
4. Si `asignados > 0`, crear `AuditLog` agregado (`RECONCILIACION_HUERFANOS`) con el resumen.
5. Retornar resumen.

### 4. Script one-shot `scripts/reasignar-huerfanos-legacy.mjs`

```js
import "../src/lib/env-check.js"; // si aplica
import { reconciliarHuerfanos } from "../src/lib/operadores/reconciliacion-huerfanos.ts";

const resumen = await reconciliarHuerfanos();
console.log("[REASIGNAR-HUERFANOS-LEGACY] Resumen:", JSON.stringify(resumen, null, 2));
process.exit(resumen.fallidos > 0 ? 0 : 0); // éxito aunque haya fallidos; el log es la señal
```

Correr en prod:

```bash
docker exec -it pi-app node --import tsx scripts/reasignar-huerfanos-legacy.mjs
# o desde el host con DATABASE_URL de prod:
node --env-file=.env.production --import tsx scripts/reasignar-huerfanos-legacy.mjs
```

### 5. Test de integración

`src/lib/operadores/reconciliacion-huerfanos.test.ts`:

- Seed: crear tenant, operador con cupo, reporte `REVISION_MANUAL` sin `operadorId`.
- Llamar `reconciliarHuerfanos()`.
- Assert: `operadorId` no nulo, `AuditLog` creado.
- Caso negativo: reporte huérfano con operadores al cupo → sigue sin operador, razón registrada.

---

## Fuera de alcance

- No se modifica `asignarOperadorAReporte` ni su lógica de selección.
- No se toca `src/lib/ai/**`.
- No se crean endpoints HTTP; la reconciliación es trabajo background.
- No se envían emails; el asignador ya notifica por sus propios canales si aplica.

## Verificación

- Gate local: `npx tsc --noEmit`, `npm run lint`, `npm run arch:check`, `npm run test:unit`, `npm run test:integration`, `npm run build`.
- CI del PR verde.
- En prod (post-deploy, valida CEO): tras ~15 min, `AuditLog` con `RECONCILIACION_HUERFANOS` aparece; el script one-shot reporta el lote de 26.

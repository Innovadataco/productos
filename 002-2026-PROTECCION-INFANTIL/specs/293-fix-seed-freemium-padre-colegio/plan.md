# Plan de implementación — SPEC-293 · Fix seed freemium

## Alcance

Corregir la rama `update` del upsert de `seedPlanesPagos()` **solo** para las 2 filas freemium (PADRE MES_1 + COLEGIO MES_1 del año actual). Los 6 planes pagos siguen con `update:{}` (anti-I-100 protege ediciones del admin). Nuevo test de integración `seed-freemium.test.ts` como ratchet CI.

## Archivos que se tocan

| Archivo | Cambio |
|---|---|
| `prisma/seed.ts` (líneas 665-716) | Loop separado en 2 pasadas: (a) planes pagos con `update:{}` (comportamiento actual), (b) planes freemium con `update:{esFreemium, activo, precioBaseCOP, usosMaximosPorCliente, nombre}` que cura el estado heredado. |
| `src/lib/seed-freemium.test.ts` (nuevo) | Integration test que ejecuta el seed y verifica las 2 filas freemium activas del año actual. |

## Diseño técnico

### Cambio en `seedPlanesPagos()`

Antes (líneas 685-702, simplificado):
```ts
for (const plan of planesBase) {
    await prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: {…} },
        update: {},
        create: plan,
    });
}
```

Después:
```ts
for (const plan of planesBase) {
    // SPEC-293 (002-PI-194): las filas freemium tienen 5 campos canónicos que
    // NO son negociables por el admin (el freemium siempre es gratis y activo).
    // Los planes pagos siguen con update:{} para no pisar ediciones de precio.
    const updateFreemium = plan.esFreemium
        ? {
            esFreemium: true,
            activo: true,
            precioBaseCOP: 0,
            usosMaximosPorCliente: 1,
            nombre: plan.nombre,
        }
        : {};
    await prisma.plan.upsert({
        where: {
            tipoTitular_duracion_anio: {
                tipoTitular: plan.tipoTitular,
                duracion: plan.duracion,
                anio: plan.anio,
            },
        },
        update: updateFreemium,
        create: plan,
    });
}
```

Diseño clave: **el update literal `{}` sigue vigente para planes pagos**. Solo cambia para freemium — un vector de curación estrecho que no pisa ediciones legítimas del admin.

### Test de integración

`src/lib/seed-freemium.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { execSync } from "node:child_process";

describe("seed-freemium (SPEC-293)", () => {
    beforeAll(async () => {
        await resetDatabase();
        // El seed necesita al menos 1 admin; se siembra a mano antes de correrlo.
        await prisma.usuario.create({
            data: {
                email: `seed-freemium-admin-${Date.now()}@test.local`,
                rol: "ADMIN",
                passwordHash: "hash",
                estado: "activo",
            },
        });
        // Ejecutar el seed como proceso separado para que use la BD de test.
        execSync("npx tsx prisma/seed.ts", { stdio: "pipe", env: { ...process.env } });
    });

    it("crea exactamente 2 filas freemium activas del año actual", async () => {
        const anio = new Date().getFullYear();
        const freemiums = await prisma.plan.findMany({
            where: { esFreemium: true, activo: true, anio },
            orderBy: { tipoTitular: "asc" },
        });
        expect(freemiums).toHaveLength(2);
        expect(freemiums.map((p) => p.tipoTitular)).toEqual(["COLEGIO", "PADRE"]);
        expect(freemiums.every((p) => p.precioBaseCOP === 0)).toBe(true);
        expect(freemiums.every((p) => p.usosMaximosPorCliente === 1)).toBe(true);
    });

    it("cura estado heredado incorrecto: PADRE MES_1 con esFreemium=false → true tras seed", async () => {
        const anio = new Date().getFullYear();
        // Estado tipo prod: rompe el freemium a mano.
        await prisma.plan.update({
            where: { tipoTitular_duracion_anio: { tipoTitular: "PADRE", duracion: "MES_1", anio } },
            data: { esFreemium: false, activo: false, precioBaseCOP: 99999 },
        });
        // Segunda corrida del seed cura las filas freemium.
        execSync("npx tsx prisma/seed.ts", { stdio: "pipe", env: { ...process.env } });
        const padreMes1 = await prisma.plan.findUnique({
            where: { tipoTitular_duracion_anio: { tipoTitular: "PADRE", duracion: "MES_1", anio } },
        });
        expect(padreMes1?.esFreemium).toBe(true);
        expect(padreMes1?.activo).toBe(true);
        expect(padreMes1?.precioBaseCOP).toBe(0);
    });

    it("NO pisa ediciones del admin en planes pagos (MES_3 mantiene precio editado)", async () => {
        const anio = new Date().getFullYear();
        await prisma.plan.update({
            where: { tipoTitular_duracion_anio: { tipoTitular: "PADRE", duracion: "MES_3", anio } },
            data: { precioBaseCOP: 42999 },
        });
        execSync("npx tsx prisma/seed.ts", { stdio: "pipe", env: { ...process.env } });
        const padreMes3 = await prisma.plan.findUnique({
            where: { tipoTitular_duracion_anio: { tipoTitular: "PADRE", duracion: "MES_3", anio } },
        });
        expect(padreMes3?.precioBaseCOP).toBe(42999);
    });
});
```

Nota: el test usa `execSync("npx tsx prisma/seed.ts")` porque el seed tiene una CLI, no una función exportable pura. Es lento (~10-20 s), acepta como costo del ratchet.

## Riesgo y candados

- **Riesgo bajo**: el cambio afecta 2 filas (freemium PADRE MES_1 + COLEGIO MES_1). Los otros 6 planes pagos siguen con `update:{}`.
- **Candado FR-002/FR-003**: separación explícita — pagos siguen protegidos por I-100 (`update:{}`), freemium se cura en cada corrida. Documentado en el código y en el `cierre.md`.
- **Trade-off consciente**: el freemium **no puede desactivarse** desde el panel del admin (el seed lo reescribe). Para desactivar el freemium en prod hay que cambiar `pagos.freemium.activo=false` en `ParametroSistema` (ya soportado por `freemium-activacion.service.ts`). Este trade-off cura el estado heredado roto de prod y evita que vuelva a pasar.
- **Cero migración de schema** (D-81).

## Pruebas

- `src/lib/seed-freemium.test.ts` (nuevo, 3 tests): 2 freemium activos, cura de estado heredado, no pisa ediciones de plan pago.
- Verificación empírica en dev: correr el seed 2 veces seguidas, confirmar idempotencia.
- Verificación en vivo post-deploy prod (SC-A43-3): registro padre nuevo → activa freemium → `Suscripcion` con `esFreemium=true, estado=ACTIVA`.

## Rollback

Revertir el commit restaura el `update:{}` en el freemium. Los planes freemium en prod quedarían de nuevo bloqueados si su estado heredado se rompe otra vez — pero como el fix ya corrió una vez, las 2 filas quedan curadas y el 404 no vuelve inmediatamente. Rollback seguro.

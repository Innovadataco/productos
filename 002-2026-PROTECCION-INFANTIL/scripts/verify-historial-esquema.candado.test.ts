/**
 * CANDADO · SPEC-767 — el guardián de HISTORIAL ≠ ESQUEMA separa el DRIFT REAL de historial
 * (columnas/constraints que las migraciones construyen o dejan de construir respecto del esquema
 * declarado) del punto ciego benigno de Prisma que ESTA dirección de diff emite.
 *
 * DISTINTO de #760 (esquema vs BD viva): 767 mide migraciones vs esquema DECLARADO con dirección
 * `--from-schema-datamodel --to-migrations`. En esa dirección un campo que las migraciones NO
 * construyen aparece como `ADD COLUMN`/`SET NOT NULL` (el Plan.creadoEn huérfano de SPEC-766), y el
 * punto ciego sale como `SET DATA TYPE TIMESTAMPTZ` + `CREATE` de índice crudo — las formas que el
 * clasificador SÍ matchea. Reusa la FUENTE ÚNICA de Datos (importada del script, que la re-exporta).
 *
 * CONTROL POSITIVO (lección #665 / dictamen): se PLANTAN divergencias que el detector DEBE encontrar.
 * Un cero sin control positivo no prueba nada (una sonda mal escrita falla hacia cero y parece sana).
 *
 * Unit puro (clasificación de texto, sin BD). Escenarios REALES = medidos con `historial:check`.
 */
import { describe, it, expect } from "vitest";
import { clasificarDrift, partirStatements } from "./verify-historial-esquema";

// ── Drift REAL de HISTORIAL, medido con `historial:check` (SPEC-767, dirección --to-migrations) ──
// El historial construye `Plan.creadoEn` + `precio NOT NULL` que el esquema NO declara (declara
// `createdAt` y `precio` nullable). La cláusula `updatedAt SET DEFAULT` es benigna PERO va mezclada:
// el filtro por CLÁUSULA exige que TODAS sean benignas → el bloque entero cae en `drift`.
const PLAN_HISTORIAL_DRIFT = `ALTER TABLE "Plan" ADD COLUMN     "creadoEn" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "precio" SET NOT NULL,
ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;`;

// ── Punto ciego que ESTA dirección emite (benigno; medido) ──
const TIMESTAMPTZ = "ALTER TABLE \"Usuario\" ALTER COLUMN \"passwordCreadaEn\" SET DATA TYPE TIMESTAMPTZ(6);";
const INDICE_CRUDO = "CREATE INDEX \"EmbeddingReporte_vector_idx\" ON \"EmbeddingReporte\" USING hnsw (\"embedding\" vector_cosine_ops);";
const RENAME = "ALTER INDEX \"notificaciones_estado_enviarEn_idx\" RENAME TO \"idx_notificaciones_estado_enviarEn\";";

// ── CONTROL POSITIVO (A-3): un campo/constraint que NINGUNA migración reconcilia nace ROJO ──
// En esta dirección, un campo del esquema sin migración que lo construya → el target (migraciones)
// no lo tiene → `DROP COLUMN`; una columna extra construida por migración → `ADD COLUMN`. Ambos rojos.
const PLANTADO_ADD = "ALTER TABLE \"Reporte\" ADD COLUMN \"columnaFantasmaSinMigracion\" TEXT;";
const PLANTADO_DROP = "ALTER TABLE \"Usuario\" DROP COLUMN \"campoFantasmaSinMigracion\";";

describe("SPEC-767 · guardián de historial: drift de historial vs punto ciego de la dirección", () => {
    it("A-1 (born-ROJO): reporta el drift REAL de `Plan` pese a la cláusula benigna mezclada", () => {
        const { drift } = clasificarDrift(partirStatements(PLAN_HISTORIAL_DRIFT));
        // Un solo statement (ALTER TABLE multi-cláusula); el filtro por cláusula NO lo tapa:
        expect(drift).toHaveLength(1);
        expect(drift[0]).toContain("ADD COLUMN");
        expect(drift[0]).toContain("\"creadoEn\"");
        expect(drift[0]).toContain("\"precio\" SET NOT NULL");
    });

    it("SC-2: el punto ciego que ESTA dirección emite es benigno (cero falsos positivos)", () => {
        const { benignas, drift } = clasificarDrift([TIMESTAMPTZ, INDICE_CRUDO, RENAME]);
        expect(drift).toHaveLength(0);
        expect(benignas).toHaveLength(3);
        expect(new Set(benignas.map((b) => b.categoria))).toEqual(
            new Set(["prisma-representacion", "indice-crudo", "rename-indice"]),
        );
        for (const b of benignas) expect(b.razon.length).toBeGreaterThan(0); // toda entrada lleva RAZÓN
    });

    it("A-3 (control positivo): un campo/constraint sin migración que lo reconcilie nace ROJO", () => {
        const plantadas = [PLANTADO_ADD, PLANTADO_DROP];
        // Precondición del control: el escenario SÍ trae las divergencias (si no, no probaría nada).
        expect(plantadas).toHaveLength(2);
        const { benignas, drift } = clasificarDrift([TIMESTAMPTZ, INDICE_CRUDO, ...plantadas]);
        // El punto ciego benigno NO arrastra a las plantadas:
        expect(benignas.map((b) => b.stmt)).toEqual([TIMESTAMPTZ, INDICE_CRUDO]);
        for (const p of plantadas) expect(drift, `la divergencia plantada no fue detectada: ${p}`).toContain(p);
    });

    it("el drift de `Plan` NO se disuelve entre baseline benigno (regresión del hueco de meses)", () => {
        // El escenario COMPLETO: 3 benignos reales + el drift de Plan. El drift debe seguir saliendo.
        const { drift } = clasificarDrift([TIMESTAMPTZ, INDICE_CRUDO, RENAME, ...partirStatements(PLAN_HISTORIAL_DRIFT)]);
        expect(drift).toHaveLength(1);
        expect(drift[0]).toContain("\"Plan\"");
    });
});

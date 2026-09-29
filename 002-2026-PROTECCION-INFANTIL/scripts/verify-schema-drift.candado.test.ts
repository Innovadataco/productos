/**
 * CANDADO · SPEC-760 (D-121) — el clasificador del guardián de drift aísla el DRIFT REAL
 * del punto ciego benigno de Prisma, y es CONSERVADOR: lo desconocido nace ROJO.
 *
 * Datos REALES: las sentencias vienen del `migrate diff` medido contra la BD viva (SPEC-759).
 * CONTROL POSITIVO (lección #665 / dictamen): se PLANTAN divergencias que el detector DEBE
 * encontrar — si el clasificador fallara hacia «cero», estos las delatan. Un cero sin control
 * positivo no prueba nada (una sonda mal escrita falla hacia cero y parece sana).
 *
 * Unit puro (clasificación de texto, sin BD).
 */
import { describe, it, expect } from "vitest";
import { clasificarDrift, partirStatements } from "./verify-schema-drift";

// ── Benignos reales (medidos contra la base viva) ──
const TIMESTAMPTZ = `ALTER TABLE "Usuario" ALTER COLUMN "passwordCreadaEn" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "bloqueadoHasta" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "ultimaSesion" SET DATA TYPE TIMESTAMPTZ(6);`;
const INDICE_VECTOR = "CREATE INDEX \"EmbeddingReporte_vector_idx\" ON \"EmbeddingReporte\" USING hnsw (\"embedding\" vector_cosine_ops);";
const INDICE_PARCIAL = "CREATE INDEX \"idx_reportes_usuario_eliminado\" ON \"Reporte\"(\"usuarioId\") WHERE \"eliminadoEn\" IS NULL;";
const RENAME = "ALTER INDEX \"notificaciones_estado_enviarEn_idx\" RENAME TO \"idx_notificaciones_estado_enviarEn\";";
const EXTENSION = "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\" WITH SCHEMA \"public\" VERSION \"1.6\";";
const TESTMUTEX = "CREATE TABLE \"TestMutex\" (\n \"id\" TEXT NOT NULL,\n CONSTRAINT \"TestMutex_pkey\" PRIMARY KEY (\"id\")\n);";
// ── Skew de representación de DEFAULT de Prisma (benigno; medido contra la base viva, SPEC-760) ──
const DEFAULT_TS = "ALTER TABLE \"Suscripcion\" ALTER COLUMN \"updatedAt\" SET DEFAULT CURRENT_TIMESTAMP;";
const DEFAULT_ARRAY = "ALTER TABLE \"PerfilProfesional\" ALTER COLUMN \"especialidades\" SET DEFAULT ARRAY[]::TEXT[], ALTER COLUMN \"areasAtencion\" SET DEFAULT ARRAY[]::TEXT[];";
const COMBINADO_TS_DEFAULT = "ALTER TABLE \"worker_logs\" ALTER COLUMN \"id\" SET DEFAULT gen_random_uuid(), ALTER COLUMN \"creadoEn\" SET DATA TYPE TIMESTAMPTZ(6);";
const DEFAULT_ENUM = "ALTER TABLE \"SolicitudCita\" ALTER COLUMN \"estado\" SET DEFAULT 'PAGADA_PENDIENTE';";
// ── Drift REAL medido (SPEC-760): la test tiene columna extra + SET NOT NULL que main no declara ──
const PLAN_DRIFT = "ALTER TABLE \"Plan\" ADD COLUMN \"creadoEn\" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, ALTER COLUMN \"precio\" SET NOT NULL;";

// ── Drift REAL medido (SPEC-759): las 2 FK que faltan en la base viva ──
const FK_DRIFT_1 = "ALTER TABLE \"Suscripcion\" DROP CONSTRAINT \"Suscripcion_autorizadoPorAdminId_fkey\";";
const FK_DRIFT_2 = "ALTER TABLE \"BonoPromocional\" DROP CONSTRAINT \"BonoPromocional_beneficiarioUsuarioId_fkey\";";

// ── CONTROL POSITIVO: divergencias PLANTADAS que el detector debe encontrar ──
const PLANTADO_FK = "ALTER TABLE \"Fantasma\" DROP CONSTRAINT \"Fantasma_algo_fkey\";";
const PLANTADO_INDICE_NUEVO = "CREATE INDEX \"indice_crudo_nuevo_sin_catalogar\" ON \"Reporte\" USING gin (\"texto\");";
const PLANTADO_TABLA_NUEVA = "CREATE TABLE \"TablaDesconocida\" (\n \"id\" TEXT NOT NULL\n);";
const PLANTADO_EXTENSION = "CREATE EXTENSION IF NOT EXISTS \"postgis\" WITH SCHEMA \"public\";";

describe("SPEC-760 · clasificador de drift: baseline benigno vs drift real", () => {
    it("baselinea el punto ciego de Prisma y los objetos crudos conocidos (con razón)", () => {
        const { benignas, drift } = clasificarDrift([TIMESTAMPTZ, INDICE_VECTOR, INDICE_PARCIAL, RENAME, EXTENSION, TESTMUTEX]);
        expect(drift).toHaveLength(0);
        expect(benignas).toHaveLength(6);
        expect(new Set(benignas.map((b) => b.categoria))).toEqual(
            new Set(["prisma-representacion", "indice-crudo", "rename-indice", "extension", "arnes-test"]),
        );
        for (const b of benignas) expect(b.razon.length).toBeGreaterThan(0); // toda entrada lleva RAZÓN
    });

    it("reporta el DRIFT REAL medido: las 2 FK que faltan (SPEC-759)", () => {
        const { drift } = clasificarDrift([TIMESTAMPTZ, FK_DRIFT_1, FK_DRIFT_2, EXTENSION]);
        expect(drift).toEqual([FK_DRIFT_1, FK_DRIFT_2]);
    });

    it("CONTROL POSITIVO: divergencias plantadas nacen ROJAS (no se baselinean solas)", () => {
        const plantadas = [PLANTADO_FK, PLANTADO_INDICE_NUEVO, PLANTADO_TABLA_NUEVA, PLANTADO_EXTENSION];
        // Precondición del control: el escenario SÍ trae las divergencias (si no, no probaría nada).
        expect(plantadas).toHaveLength(4);
        const { drift, benignas } = clasificarDrift([TIMESTAMPTZ, INDICE_VECTOR, ...plantadas]);
        // Los benignos reales NO arrastran a las plantadas:
        expect(benignas.map((b) => b.stmt)).toEqual([TIMESTAMPTZ, INDICE_VECTOR]);
        // Cada plantada DEBE estar en drift (un índice/tabla/extensión NUEVO no catalogado nace rojo):
        for (const p of plantadas) expect(drift, `la divergencia plantada no fue detectada: ${p}`).toContain(p);
    });

    it("SPEC-760 born-green: baselinea el skew de DEFAULT de Prisma, pero NO una columna nueva real", () => {
        const skew = [DEFAULT_TS, DEFAULT_ARRAY, COMBINADO_TS_DEFAULT, DEFAULT_ENUM];
        const { benignas, drift } = clasificarDrift([...skew, PLAN_DRIFT]);
        // Los 4 de skew de representación son benignos (categoría prisma-representacion):
        expect(benignas.map((b) => b.stmt)).toEqual(skew);
        expect(new Set(benignas.map((b) => b.categoria))).toEqual(new Set(["prisma-representacion"]));
        // PLAN_DRIFT tiene ADD COLUMN + SET NOT NULL → NO es benigno: nace rojo (columna que main no declara).
        expect(drift).toEqual([PLAN_DRIFT]);
    });

    it("es CONSERVADOR: un índice crudo NO catalogado es drift, aunque se le parezca a uno conocido", () => {
        const casiConocido = "CREATE INDEX \"EmbeddingReporte_vector_idx_v2\" ON \"EmbeddingReporte\" USING hnsw (\"embedding\" vector_cosine_ops);";
        const { drift } = clasificarDrift([casiConocido]);
        expect(drift).toEqual([casiConocido]); // el nombre no está en el catálogo → rojo
    });

    it("partirStatements: separa por `;`, descarta vacíos y comentarios", () => {
        const script = "-- comentario\nALTER TABLE \"A\" ADD COLUMN \"x\" TEXT;\n\nCREATE EXTENSION \"pg_trgm\";";
        const stmts = partirStatements(script);
        expect(stmts).toEqual(["ALTER TABLE \"A\" ADD COLUMN \"x\" TEXT;", "CREATE EXTENSION \"pg_trgm\";"]);
    });
});

/**
 * SPEC-014 · 5 preguntas obligatorias (BRIEF §5).
 * Requiere infra: docker compose -f docker-compose.test.yml up (Postgres + bi-vanna)
 * + Ollama Mac Studio alcanzable + catálogo semilla cargado.
 * Corre solo con INTEGRATION=1.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { INTEGRATION_ACTIVA } from "./helpers/entorno";
import { preguntarTest, prismaTest } from "./helpers/motor";
import { vannaHealth } from "./helpers/vanna";

const suite = INTEGRATION_ACTIVA ? describe : describe.skip;

suite("SPEC-014 · 5 preguntas obligatorias", () => {
    beforeAll(async () => {
        const h = await vannaHealth();
        if (!h.ok || h.modelosDisponibles.length < 2) {
            throw new Error(
                `bi-vanna no listo: ok=${h.ok} modelos=${h.modelosDisponibles.length}`,
            );
        }
        // sanity: al menos una tabla activa
        const n = await prismaTest().bICatalogoTabla.count({ where: { activo: true } });
        if (n === 0) throw new Error("catálogo BI vacío · corre seed antes");
    }, 60_000);

    it("1 · 'cuántos reportes hoy' → OK · plantilla un-numero", async () => {
        const r = await preguntarTest("cuántos reportes hoy");
        expect(r.estado).toBe("OK");
        expect(r.plantilla).toBe("un-numero");
        expect(r.filas).toBeDefined();
        expect((r.filas ?? []).length).toBe(1);
    }, 300_000);

    it("2 · 'top 5 categorías esta semana' → OK · plantilla grafico bar", async () => {
        const r = await preguntarTest("top 5 categorías esta semana");
        expect(r.estado).toBe("OK");
        expect(r.plantilla).toBe("grafico");
        expect((r.filas ?? []).length).toBeLessThanOrEqual(5);
        const spec = r.graficoSpec as { mark?: string } | undefined;
        expect(spec?.mark).toBe("bar");
    }, 300_000);

    it("3 · 'por qué la latencia subió' → OK o REVISION documentado", async () => {
        const r = await preguntarTest("por qué la latencia subió");
        expect(["OK", "REVISION"]).toContain(r.estado);
        if (r.estado === "REVISION") {
            expect(r.razon).toBeTruthy();
            console.info("[SPEC-014 p3] REVISION esperada · razón:", r.razon);
        } else {
            expect(r.sqlGenerado).toBeTruthy();
        }
    }, 300_000);

    it("4 · 'DROP TABLE Reporte' → RECHAZADO · llamadasLlm=0", async () => {
        const r = await preguntarTest("DROP TABLE Reporte");
        expect(r.estado).toBe("RECHAZADO");
        expect(r.llamadasLlm).toBe(0);
        expect(r.razon).toMatch(/intencion_destructiva/i);
    }, 60_000);

    it("5 · 'muéstrame nombres de padres' → RECHAZADO por PII o tabla no permitida", async () => {
        const r = await preguntarTest("muéstrame nombres de padres");
        expect(r.estado).toBe("RECHAZADO");
        expect(r.razon || "").toMatch(/(pii|tabla_no_permitida|columna_excluida|falta_where_tenant)/i);
    }, 300_000);
});

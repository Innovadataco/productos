/**
 * SPEC-569 (hallazgos de Diseño, G2) — dos defectos de forma en el colegio, cada candado
 * ANCLADO A SU ELEMENTO (no a un conteo de ocurrencias, porque en la misma pantalla hay usos
 * legítimos del mismo color/estructura):
 *
 *  (1) `colegio/alertas` · el badge «SLA vencido» es URGENCIA operativa (vamos tarde), no
 *      criticidad REAL del hecho → ámbar (`warning`), nunca rubí (`danger`). En esa MISMA pantalla
 *      la prioridad ALTA sí pinta rubí (PRIORIDAD_VARIANTS) y es correcto — por eso el candado mira
 *      el badge de «SLA vencido», no cuenta `danger` en el archivo.
 *  (2) `colegio/auditoria` · un solo encabezado: la página rinde su `<h1>` local y NO le pasa
 *      `title`/`subtitle` al `AuditLogViewer` (que si los recibe pinta su propio `<h1>`, duplicando).
 *
 * Mutation-verified: (1) volver el badge a `danger` → rojo; (2) re-pasar `title` al viewer → rojo.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const alertas = fs.readFileSync(
    path.join(SRC, "app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx"),
    "utf-8"
);
const auditoria = fs.readFileSync(
    path.join(SRC, "app/dashboard/colegio/auditoria/ColegioAuditoriaPageClient.tsx"),
    "utf-8"
);

describe("SPEC-569 · forma del colegio (I-351/G2)", () => {
    it("(1) el badge «SLA vencido» va en ámbar (warning), no en rubí (danger)", () => {
        const m = alertas.match(/<Badge\s+variant="([a-z]+)"\s*>\s*SLA vencido\s*<\/Badge>/);
        expect(m, "no se encontró el badge «SLA vencido» — ¿cambió el texto?").not.toBeNull();
        expect(
            m![1],
            `«SLA vencido» es urgencia operativa, no criticidad del hecho → debe ser "warning", no "${m![1]}"`
        ).toBe("warning");
    });

    it("(2) auditoría del colegio tiene UN encabezado: no se pasa title al AuditLogViewer", () => {
        // La página conserva su <h1> local.
        expect((auditoria.match(/<h1\b/g) ?? []).length, "la página debe conservar su <h1> local").toBe(1);
        // …y NO delega el header al hijo (si le pasa `title`, el viewer pinta un segundo <h1>).
        const viewer = auditoria.match(/<AuditLogViewer[\s\S]*?\/>/);
        expect(viewer, "no se encontró el <AuditLogViewer />").not.toBeNull();
        expect(
            /\btitle\s*=/.test(viewer![0]),
            "el <AuditLogViewer> NO debe recibir `title` (duplicaría el encabezado); el <h1> local es el único"
        ).toBe(false);
    });
});

/**
 * SPEC-569 (hallazgos de Diseño, G2) + SPEC-573 (fold-in) — defectos de forma, cada candado
 * ANCLADO A SU ELEMENTO (no a un conteo de ocurrencias, porque en la misma pantalla hay usos
 * legítimos del mismo color/estructura):
 *
 *  (1) `colegio/alertas` · el badge «SLA vencido» es URGENCIA operativa (vamos tarde), no
 *      criticidad REAL del hecho → ámbar (`warning`), nunca rubí (`danger`). En esa MISMA pantalla
 *      la prioridad ALTA sí pinta rubí (PRIORIDAD_VARIANTS) y es correcto — por eso el candado mira
 *      el badge de «SLA vencido», no cuenta `danger` en el archivo.
 *  (2) LAS TRES auditorías (colegio, comité, operadores) comparten el `AuditLogViewer`. Cada una
 *      rinde su encabezado local (un solo título) y NO le pasa `title`/`subtitle` al viewer, que si
 *      los recibe pinta su propio título y DUPLICA el encabezado. SPEC-569 lo cerró en colegio;
 *      SPEC-573 extiende el candado a las dos de admin (misma clase, mismo componente compartido).
 *
 * Mutation-verified: (1) volver el badge a `danger` → rojo; (2) re-pasar `title` a cualquiera de
 * los tres viewers → rojo en esa página.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..", ".."); // .../src
const alertas = fs.readFileSync(
    path.join(SRC, "app/dashboard/colegio/alertas/AlertasColegioPageClient.tsx"),
    "utf-8"
);

/**
 * Las tres páginas de auditoría que montan el `AuditLogViewer`. El invariante es común: un solo
 * encabezado por pantalla — el `<h1>` local — y CERO delegación de título al hijo.
 */
const AUDITORIAS = [
    { nombre: "colegio", archivo: "app/dashboard/colegio/auditoria/ColegioAuditoriaPageClient.tsx" },
    { nombre: "comité", archivo: "app/dashboard/admin/comite/auditoria/page.tsx" },
    { nombre: "operadores", archivo: "app/dashboard/admin/operadores/auditoria/page.tsx" },
] as const;

describe("SPEC-569 · forma del colegio (I-351/G2)", () => {
    it("(1) el badge «SLA vencido» va en ámbar (warning), no en rubí (danger)", () => {
        const m = alertas.match(/<Badge\s+variant="([a-z]+)"\s*>\s*SLA vencido\s*<\/Badge>/);
        expect(m, "no se encontró el badge «SLA vencido» — ¿cambió el texto?").not.toBeNull();
        expect(
            m![1],
            `«SLA vencido» es urgencia operativa, no criticidad del hecho → debe ser "warning", no "${m![1]}"`
        ).toBe("warning");
    });
});

describe("SPEC-569/573 · un solo encabezado en las tres auditorías", () => {
    for (const { nombre, archivo } of AUDITORIAS) {
        it(`(${nombre}) un encabezado: conserva su <h1> local y NO le pasa title al AuditLogViewer`, () => {
            const src = fs.readFileSync(path.join(SRC, archivo), "utf-8");
            // La página conserva exactamente UN encabezado propio.
            expect(
                (src.match(/<h1\b/g) ?? []).length,
                `${nombre}: debe conservar exactamente un encabezado local`
            ).toBe(1);
            // …y NO delega el header al hijo (si le pasa `title`, el viewer pinta un segundo título).
            const viewer = src.match(/<AuditLogViewer[\s\S]*?\/>/);
            expect(viewer, `${nombre}: no se encontró el <AuditLogViewer />`).not.toBeNull();
            expect(
                /\btitle\s*=/.test(viewer![0]),
                `${nombre}: el <AuditLogViewer> NO debe recibir \`title\` (duplicaría el encabezado); el título local es el único`
            ).toBe(false);
        });
    }
});

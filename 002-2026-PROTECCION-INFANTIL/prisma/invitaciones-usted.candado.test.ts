/**
 * SPEC-909 · CANDADO — copy USTED de las invitaciones (colegio + comité) · Diseño §2.
 *
 * El defecto: colegio estaba en «tú» (oveja negra; la familia colegio ya es usted),
 * comité mixto (usted + «haz clic»/«esperabas») + anglicismo «link». Diseño (SHA
 * `446e8dc2`) los unificó en USTED (D-107). Este candado muere con una regresión de voz
 * o de forma sobre la FUENTE ÚNICA `INVITACIONES_USTED`:
 *   (1) VOZ usted: cero morfología de tú/voseo, cero «link»; sí «haga clic» + «su».
 *   (2) FORMA: cada copy tiene el CTA `[...]({{linkActivacion}})` A SOLAS en su línea →
 *       el motor lo pinta como BOTÓN, y el render no deja `**` crudos.
 *   (3) FUENTE ÚNICA: el seed usa `copyInvitacion()` (no un copy divergente hardcodeado).
 *
 * Puro (lee la data + render + el texto del seed). En el allowlist.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { INVITACIONES_USTED } from "./invitaciones-copy.seed-data";
import { renderizarEmail, markdownAHtml } from "../src/lib/notificaciones/render-html";

// Morfología prohibida (tú/voseo imperativo + anglicismo). No depende de una lista de frases.
const VOSEO_O_TU = [/\bhaz\b/i, /\bhacé\b/i, /\bactivá\b/i, /\bcreá\b/i, /\bdefiní\b/i, /\besperabas\b/i, /\bsolicitaste\b/i, /\bignora\b/i, /\btu\b/i, /\btus\b/i, /\blink\b/i];

describe("SPEC-909 · (1) voz USTED en las 2 invitaciones", () => {
    for (const copy of INVITACIONES_USTED) {
        it(`${copy.clave}: cero tú/voseo/«link», sí «haga» + «su»`, () => {
            const texto = `${copy.asunto}\n${copy.cuerpoMarkdown}`;
            for (const re of VOSEO_O_TU) {
                expect(re.test(texto), `no debe aparecer ${re} en ${copy.clave}`).toBe(false);
            }
            expect(/haga clic/i.test(copy.cuerpoMarkdown), "usa «haga clic» (usted)").toBe(true);
            expect(/\bsu\b/i.test(copy.cuerpoMarkdown), "usa «su» (usted)").toBe(true);
        });
    }
});

describe("SPEC-909 · (2) FORMA: CTA a solas → botón; sin ** crudos", () => {
    for (const copy of INVITACIONES_USTED) {
        it(`${copy.clave}: tiene el CTA [...]({{linkActivacion}}) a solas y rinde a botón`, () => {
            // El CTA ocupa su propia línea (→ párrafo de enlace solo → botón en el motor).
            expect(copy.cuerpoMarkdown).toMatch(/^\[[^\]]+\]\(\{\{linkActivacion\}\}\)$/m);
            // Render con la variable sustituida: botón §1.7 + negrita + cero ** crudos.
            const md = copy.cuerpoMarkdown.replace(/\{\{linkActivacion\}\}/g, "https://app.pi/activar/tok");
            const html = markdownAHtml(md);
            expect(html).toMatch(/<a href="https:\/\/app\.pi\/activar\/tok"[^>]*padding:15px 28px/);
            expect(html).toMatch(/<strong>/);
            expect(html).not.toContain("**");
            const { texto } = renderizarEmail(md, { asunto: copy.asunto });
            expect(texto).not.toContain("**");
        });
    }
});

describe("SPEC-909 · (3) el seed usa la FUENTE ÚNICA de copy", () => {
    it("prisma/seed.ts siembra las invitaciones vía copyInvitacion() (no un copy hardcodeado)", () => {
        const seed = fs.readFileSync(path.resolve(__dirname, "seed.ts"), "utf-8");
        expect(seed).toMatch(/copyInvitacion\s*\(/);
        // y ya NO lleva el copy viejo en «tú» embebido
        expect(seed).not.toContain("Has sido registrado como rector");
        expect(seed).not.toContain("haz clic en el siguiente link");
    });
});

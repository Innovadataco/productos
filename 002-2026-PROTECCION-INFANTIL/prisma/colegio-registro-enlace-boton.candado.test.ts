/**
 * SPEC-918 · CANDADO — el correo de activación por enlace del colegio
 * (`colegio.registro_enlace.email`) muestra un BOTÓN, no la URL pelada.
 *
 * El defecto: el cuerpo tenía `{{url}}` SUELTA en su línea (URL cruda). Debe ser el patrón de
 * `comite.invitacion.enviada.email`: lead-in + `[Activar mi cuenta]({{url}})` A SOLAS en su
 * párrafo → el motor (SPEC-909) lo pinta como botón bulletproof. Muere con el defecto:
 *   (1) ESTRUCTURA: no queda `{{url}}` (ni URL http) FUERA de un `[texto](url)`.
 *   (2) FORMA/CONDUCTA: el CTA está en PÁRRAFO PROPIO (línea en blanco antes y después) y el
 *       render produce el botón. Riesgo de Diseño: con `breaks:true`, un `\n` simple lo deja
 *       INLINE (enlace de texto, no botón) — se verifica por conducta del motor, no por texto.
 *   (3) VARIABLE: preserva `{{url}}` (no migró a `{{linkActivacion}}`).
 *   (4) FUENTE ÚNICA: el seed siembra desde `COLEGIO_REGISTRO_ENLACE_COPY` (no hardcodeado).
 *
 * Puro (lee la data + render + el texto del seed). En el allowlist de unit.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import { COLEGIO_REGISTRO_ENLACE_COPY } from "./colegio-registro-enlace-copy.seed-data";
import { markdownAHtml } from "../src/lib/notificaciones/render-html";

const COPY = COLEGIO_REGISTRO_ENLACE_COPY;
// Firma del botón bulletproof del motor (misma que verifica el candado de SPEC-909).
const FIRMA_BOTON = /padding:15px 28px/;

/** ¿Queda una `{{url}}` o una URL http FUERA de un `[texto](url)`? (URL pelada). */
function urlSueltaFuera(md: string): boolean {
    const sinLinks = md.replace(/\[[^\]]+\]\([^)]*\)/g, "");
    return /\{\{url\}\}/.test(sinLinks) || /https?:\/\//.test(sinLinks);
}

describe("SPEC-918 · activación por enlace del colegio: botón, no URL pelada", () => {
    it("control POSITIVO: el detector dispara con la URL suelta y pasa con el botón", () => {
        // El cuerpo VIEJO (URL pelada en su línea) → ROJO.
        expect(urlSueltaFuera("Abra este enlace y cree su contraseña:\n{{url}}\n\nEl enlace vence")).toBe(true);
        // El cuerpo NUEVO (dentro del link) → VERDE.
        expect(urlSueltaFuera(COPY.cuerpoMarkdown)).toBe(false);
    });

    it("(1) no queda `{{url}}` ni URL http FUERA de un `[texto](url)`", () => {
        expect(urlSueltaFuera(COPY.cuerpoMarkdown)).toBe(false);
    });

    it("(2) el CTA está en PÁRRAFO PROPIO (línea en blanco antes y después)", () => {
        expect(COPY.cuerpoMarkdown).toMatch(/\n\n\[[^\]]+\]\(\{\{url\}\}\)\n\n/);
    });

    it("(2b) CONDUCTA del motor: párrafo propio → BOTÓN; `\\n` simple → NO botón (enlace inline)", () => {
        // El copy real rinde a botón bulletproof.
        const md = COPY.cuerpoMarkdown
            .replace(/\{\{url\}\}/g, "https://app.pi/registro/tok")
            .replace(/\{\{nombreColegio\}\}/g, "Colegio X");
        expect(markdownAHtml(md)).toMatch(FIRMA_BOTON);
        // Prueba del riesgo de Diseño (independiente del copy): párrafo propio = botón; `\n` simple = no.
        const conParrafo = "Haga clic en el botón:\n\n[Activar mi cuenta](https://x/tok)\n\nvence.";
        const conSalto = "Haga clic en el botón:\n[Activar mi cuenta](https://x/tok)\nvence.";
        expect(markdownAHtml(conParrafo)).toMatch(FIRMA_BOTON);
        expect(markdownAHtml(conSalto)).not.toMatch(FIRMA_BOTON);
    });

    it("(3) preserva la variable `{{url}}` (no `{{linkActivacion}}`)", () => {
        expect(COPY.cuerpoMarkdown).toContain("{{url}}");
        expect(COPY.cuerpoMarkdown).not.toContain("{{linkActivacion}}");
    });

    it("(4) el seed siembra desde la FUENTE ÚNICA (no un copy hardcodeado)", () => {
        const seed = fs.readFileSync(path.resolve(__dirname, "seed.ts"), "utf-8");
        expect(seed).toContain("COLEGIO_REGISTRO_ENLACE_COPY");
        // Y ya NO lleva la URL pelada embebida en el bloque del evento.
        expect(seed).not.toContain("Abra este enlace y cree su contraseña:\\n{{url}}");
    });
});

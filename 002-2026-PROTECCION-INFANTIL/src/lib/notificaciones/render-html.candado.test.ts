/**
 * SPEC-909 · CANDADO — el motor de notificaciones envía correos con FORMATO.
 *
 * El defecto (prod): `enviar-email.ts` mandaba SOLO `text: cuerpo` con el Markdown
 * crudo, así que `**negrita**` y los enlaces salían literales (Jelkin vio
 * `**Colegio 1**`). El candado muere con el defecto en DOS planos:
 *
 *  (A) RENDER (render-html.ts · FORMA de Diseño SHA `446e8dc2`): `**x**` → `<strong>`;
 *      `[texto](url)` A SOLAS en su párrafo → BOTÓN §1.7 (no un enlace inline); un
 *      `[texto](url)` inline → enlace de texto; el acento es un SLOT/parámetro §1.3 (no
 *      pino hardcodeado); layout institucional §1.8 (encabezado + pie habeas data). CERO
 *      `**` en html NI en texto; HTML crudo y `href` `javascript:` saneados. Control positivo.
 *  (B) ENVÍO (enviar-email.ts): el ÚNICO punto del motor manda `html:` (renderado) +
 *      `text:` (respaldo). Si alguien revierte a `text: cuerpo` (sin `html`), (B) cae.
 *      El preview del admin comparte ESTE punto (ver aserción estática).
 *
 * Unitario puro (sin base): Resend mockeado; env desde `.env.test`. En el allowlist.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { markdownAHtml, markdownATextoPlano, renderizarEmail, ACENTO_PINO } from "./render-html";

// Mock de Resend ANTES de importar enviar-email (vi.mock se iza). Captura el payload.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({
    Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

const MD_CASO = "Usted está por activar la cuenta del **Colegio San José**.\n\n[Activar mi cuenta](https://app.pi/crear/abc)";

describe("SPEC-909 · (A) render Markdown → HTML + texto", () => {
    it("`**x**` → <strong> y `[texto](url)` A SOLAS → BOTÓN §1.7; CERO ** en el html", () => {
        const html = markdownAHtml(MD_CASO);
        expect(html).toMatch(/<strong>Colegio San José<\/strong>/);
        // botón §1.7: ancla inline-block con el acento de fondo y el padding de 15px 28px, al href real
        expect(html).toMatch(
            /<a href="https:\/\/app\.pi\/crear\/abc" style="display:inline-block;background:#0b6e5a;[^"]*padding:15px 28px/
        );
        expect(html).toContain("Activar mi cuenta");
        expect(html).not.toContain("**");
    });

    it("un `[texto](url)` INLINE es enlace de texto, NO botón", () => {
        const html = markdownAHtml("Vea el detalle en [el panel](https://app.pi/panel) cuando quiera.");
        expect(html).toMatch(/<a href="https:\/\/app\.pi\/panel" style="color:#0b6e5a;text-decoration:underline;">el panel<\/a>/);
        expect(html).not.toMatch(/padding:15px 28px/); // no se convirtió en botón
    });

    it("el acento es un SLOT/parámetro §1.3 (no pino hardcodeado)", () => {
        const pino = markdownAHtml("[Ir](https://z.com)");
        expect(pino).toMatch(/background:#0b6e5a/);
        const cielo = markdownAHtml("[Ir](https://z.com)", "#2c5f99");
        expect(cielo).toMatch(/background:#2c5f99/);
        expect(cielo).not.toMatch(/background:#0b6e5a/);
    });

    it("el texto de respaldo NO lleva `**` ni etiquetas, y conserva la URL cruda", () => {
        const texto = markdownATextoPlano(MD_CASO);
        expect(texto).not.toContain("**");
        expect(texto).not.toContain("<");
        expect(texto).toContain("Colegio San José");
        expect(texto).toContain("https://app.pi/crear/abc");
    });

    it("CONTROL POSITIVO: texto sin Markdown no inventa formato ni botón", () => {
        const html = markdownAHtml("Un aviso sin formato especial.");
        expect(html).not.toContain("<strong");
        expect(html).not.toMatch(/padding:15px 28px/);
        expect(html).not.toContain("**");
    });

    it("SANEO (§3): descarta HTML crudo y neutraliza `javascript:`", () => {
        const html = markdownAHtml("Aviso con <script>alert(1)</script> incrustado y <b>negrita</b> cruda.\n\n[ir](javascript:alert(1)) y [ok](https://z.com)");
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/<b>/i);
        expect(html).not.toMatch(/javascript:/i);
        expect(html).toMatch(/href="https:\/\/z\.com"/); // el enlace legítimo sobrevive
        expect(markdownAHtml("<script>evil()</script>")).not.toMatch(/<script/i); // bloque crudo a solas → vacío
    });

    it("renderizarEmail envuelve en el layout institucional §1.8 (encabezado + pie habeas data)", () => {
        const { html, texto } = renderizarEmail(MD_CASO, { asunto: "Active su cuenta" });
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain("Protección&nbsp;Infantil"); // wordmark del encabezado §1.8
        expect(html).toContain("Ley 1581 de 2012"); // pie habeas data §1.6
        expect(html).toContain(ACENTO_PINO); // acento por defecto = pino
        expect(html).toMatch(/<strong>Colegio San José<\/strong>/);
        expect(texto).not.toContain("**");
    });
});

describe("SPEC-909 · (B) el ÚNICO punto de envío manda html + text", () => {
    beforeEach(() => {
        sendMock.mockReset();
        sendMock.mockResolvedValue({ data: { id: "msg-test" }, error: null });
    });

    it("enviarEmailNotificacion renderiza el Markdown a html y manda también el texto de respaldo", async () => {
        const { enviarEmailNotificacion } = await import("./enviar-email");
        await enviarEmailNotificacion("rector@colegio.edu.co", "Active su cuenta", MD_CASO);

        expect(sendMock).toHaveBeenCalledTimes(1);
        const payload = sendMock.mock.calls[0][0] as { html?: unknown; text?: unknown };
        // DIES WITH THE DEFECT: revertir a `text: cuerpo` deja `html` sin definir.
        expect(typeof payload.html).toBe("string");
        expect(payload.html as string).toMatch(/<strong>Colegio San José<\/strong>/);
        expect(payload.html as string).toMatch(/padding:15px 28px/); // botón presente
        expect(payload.html as string).not.toContain("**");
        expect(typeof payload.text).toBe("string");
        expect(payload.text as string).not.toContain("**");
    });
});

describe("SPEC-909 · el preview del admin comparte el ÚNICO punto de envío", () => {
    it("enviarPreviewPlantilla sigue pasando por enviarEmailNotificacion (preview renderiza igual)", () => {
        const fuente = fs.readFileSync(path.resolve(__dirname, "../dal/services/notificacion-admin.ts"), "utf-8");
        expect(fuente).toMatch(/enviarEmailNotificacion\s*\(/);
    });
});

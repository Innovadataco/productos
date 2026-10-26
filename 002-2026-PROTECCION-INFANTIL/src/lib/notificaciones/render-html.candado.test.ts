/**
 * SPEC-909 · CANDADO — el motor de notificaciones envía correos con FORMATO.
 *
 * El defecto (prod): `enviar-email.ts` mandaba SOLO `text: cuerpo` con el Markdown
 * crudo, así que `**negrita**` y los enlaces salían literales (Jelkin vio
 * `**Colegio 1**`). El candado muere con el defecto en DOS planos:
 *
 *  (A) RENDER (render-html.ts): `**x**` → `<strong>`; `[texto](url)` → `<a>`/botón;
 *      CERO `**` literales en html NI en el texto de respaldo; HTML crudo y `href`
 *      `javascript:` saneados. Con control positivo (texto plano NO inventa formato).
 *  (B) ENVÍO (enviar-email.ts): el ÚNICO punto de envío manda `html:` (renderado) +
 *      `text:` (respaldo). Si alguien revierte a `text: cuerpo` (sin `html`), (B) cae.
 *      El preview del admin comparte ESTE punto (ver aserción estática), así que
 *      "el preview renderiza igual" queda amarrado sin tocar base de datos.
 *
 * Unitario puro (sin base): Resend mockeado; env desde `.env.test`. En el allowlist
 * `vitest.unit.includes.ts`.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { markdownAHtml, markdownATextoPlano, renderizarEmail } from "./render-html";

// Mock de Resend ANTES de importar enviar-email (vi.mock se iza). Captura el payload.
const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock("resend", () => ({
    Resend: vi.fn(() => ({ emails: { send: sendMock } })),
}));

const MD_CASO = "Usted está por activar la cuenta del **Colegio San José**.\n\n[Crear mi contraseña](https://app.pi/crear/abc)";

describe("SPEC-909 · (A) render Markdown → HTML + texto", () => {
    it("`**x**` → <strong> y `[texto](url)` → botón; CERO ** en el html", () => {
        const html = markdownAHtml(MD_CASO);
        expect(html).toMatch(/<strong[^>]*>Colegio San José<\/strong>/);
        // enlace Markdown explícito → ancla marcada como botón primario, al href real
        expect(html).toMatch(/<a [^>]*href="https:\/\/app\.pi\/crear\/abc"[^>]*data-rol="boton-primario"|<a [^>]*data-rol="boton-primario"[^>]*href="https:\/\/app\.pi\/crear\/abc"/);
        expect(html).toContain("Crear mi contraseña");
        expect(html).not.toContain("**");
    });

    it("el texto de respaldo NO lleva `**` ni etiquetas, y conserva el enlace legible", () => {
        const texto = markdownATextoPlano(MD_CASO);
        expect(texto).not.toContain("**");
        expect(texto).not.toContain("<");
        expect(texto).toContain("Colegio San José");
        expect(texto).toContain("https://app.pi/crear/abc");
    });

    it("CONTROL POSITIVO: texto sin Markdown no inventa formato", () => {
        const html = markdownAHtml("Un aviso sin formato especial.");
        expect(html).not.toContain("<strong");
        expect(html).not.toContain("data-rol=");
        expect(html).not.toContain("**");
    });

    it("SANEO: descarta HTML crudo y neutraliza `javascript:`", () => {
        // html crudo inline + enlace legítimo en un párrafo aparte
        const html = markdownAHtml("Aviso con <script>alert(1)</script> incrustado y <b>negrita</b> cruda.\n\n[ir](javascript:alert(1)) y [ok](https://z.com)");
        expect(html).not.toMatch(/<script/i);
        expect(html).not.toMatch(/<b>/i);
        expect(html).not.toMatch(/javascript:/i);
        // el enlace legítimo SÍ sobrevive como botón; el `javascript:` queda solo como texto "ir"
        expect(html).toMatch(/href="https:\/\/z\.com"/);
        // un bloque de HTML crudo a solas se descarta por completo (defensa en profundidad)
        expect(markdownAHtml("<script>evil()</script>")).not.toMatch(/<script/i);
    });

    it("renderizarEmail envuelve en un layout de correo válido (costura de Diseño)", () => {
        const { html, texto } = renderizarEmail(MD_CASO, { asunto: "Active su cuenta" });
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain("<title>Active su cuenta</title>");
        expect(html).toMatch(/<strong[^>]*>Colegio San José<\/strong>/);
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
        const payload = sendMock.mock.calls[0][0] as { html?: unknown; text?: unknown; subject?: string };
        // DIES WITH THE DEFECT: revertir a `text: cuerpo` deja `html` sin definir.
        expect(typeof payload.html).toBe("string");
        expect(payload.html as string).toMatch(/<strong[^>]*>Colegio San José<\/strong>/);
        expect(payload.html as string).toMatch(/data-rol="boton-primario"/);
        expect(payload.html as string).not.toContain("**");
        // respaldo de texto presente y sin sintaxis
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

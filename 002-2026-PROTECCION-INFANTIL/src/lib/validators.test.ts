import { describe, it, expect } from "vitest";
import { MotivoBajaReporte } from "@prisma/client";
import {
    authRegisterSchema,
    recuperarSolicitarSchema,
    restablecerPasswordSchema,
    crearReporteSchema,
    darDeBajaReporteSchema,
    reactivarReporteSchema,
    textoReporteTieneMultimedia,
    MENSAJE_SOLO_TEXTO,
    MENSAJE_SOLO_TEXTO_NOTA,
} from "./validators";

describe("authRegisterSchema", () => {
    it("acepta un payload válido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
        });
        expect(result.success).toBe(true);
    });

    it("rechaza email inválido", () => {
        const result = authRegisterSchema.safeParse({
            email: "no-es-email",
            password: "Segura123",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña corta", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "corta1",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña sin letra", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "12345678",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña sin número", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "SoloLetras",
            rol: "PARENT",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza rol inválido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "SUPER_ADMIN",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza campos adicionales", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
            extra: "campo no permitido",
        });
        expect(result.success).toBe(false);
    });

    it("acepta tenantId opcional válido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
            tenantId: "550e8400-e29b-41d4-a716-446655440000",
        });
        expect(result.success).toBe(true);
    });

    it("rechaza tenantId inválido", () => {
        const result = authRegisterSchema.safeParse({
            email: "nuevo@ejemplo.com",
            password: "Segura123",
            rol: "PARENT",
            tenantId: "id-invalido",
        });
        expect(result.success).toBe(false);
    });
});

describe("recuperarSolicitarSchema", () => {
    it("acepta email válido", () => {
        const result = recuperarSolicitarSchema.safeParse({ email: "usuario@ejemplo.com" });
        expect(result.success).toBe(true);
    });

    it("rechaza email inválido", () => {
        const result = recuperarSolicitarSchema.safeParse({ email: "no-es-email" });
        expect(result.success).toBe(false);
    });

    it("rechaza email vacío", () => {
        const result = recuperarSolicitarSchema.safeParse({ email: "" });
        expect(result.success).toBe(false);
    });

    it("rechaza email demasiado largo", () => {
        const longEmail = "a".repeat(250) + "@ejemplo.com";
        const result = recuperarSolicitarSchema.safeParse({ email: longEmail });
        expect(result.success).toBe(false);
    });
});

describe("restablecerPasswordSchema", () => {
    it("acepta token y contraseña válidos", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "NuevaPass456",
        });
        expect(result.success).toBe(true);
    });

    it("rechaza token vacío", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "",
            password: "NuevaPass456",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña débil", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "corta",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza contraseña sin número", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "SoloLetras",
        });
        expect(result.success).toBe(false);
    });

    it("rechaza campos adicionales", () => {
        const result = restablecerPasswordSchema.safeParse({
            token: "token-valido-123",
            password: "NuevaPass456",
            extra: "campo no permitido",
        });
        expect(result.success).toBe(false);
    });
});

// SPEC-893 · CANDADO del invariante SOLO-TEXTO. Muere con el defecto: sin el `.refine`
// de `crearReporteSchema.texto`, los casos de multimedia pasarían (success true) y estos
// `toBe(false)` se pondrían rojos (control positivo).
describe("crearReporteSchema · invariante SOLO-TEXTO (SPEC-893)", () => {
    const base = {
        identificador: "+573001112233",
        plataforma: "whatsapp",
        texto: "Vi a un adulto pidiendo fotos a un menor por WhatsApp al 3001112233.",
        fechaIncidente: new Date().toISOString(),
        ciudad: "Bogotá",
        pais: "Colombia",
    };
    const parseTexto = (texto: string) => crearReporteSchema.safeParse({ ...base, texto });

    it("ACEPTA prosa legítima que cita un teléfono y un nick (no hay falso positivo)", () => {
        expect(parseTexto("El usuario @juan_123 le escribió al 3001234567 pidiendo fotos a mi hija.").success).toBe(true);
    });

    it("ACEPTA prosa que DESCRIBE multimedia sin embeberla", () => {
        expect(parseTexto("Me dijeron que le mandó una foto por WhatsApp; yo no la vi.").success).toBe(true);
    });

    it("RECHAZA un data:-URI base64 (imagen embebida) con el mensaje neutral", () => {
        const r = parseTexto("Mire esto: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAoNUEVAAAAASUVORK5CYII=");
        expect(r.success).toBe(false);
        if (!r.success) {
            expect(r.error.issues.some((i) => i.message === MENSAJE_SOLO_TEXTO)).toBe(true);
        }
    });

    it("RECHAZA un blob base64 crudo largo (≥200 chars, sin prefijo data:)", () => {
        const blob = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAoNUEVA".repeat(6); // 240 chars contiguos, alfabeto base64
        expect(parseTexto(`adjunto ${blob}`).success).toBe(false);
    });

    it("RECHAZA un enlace a imagen (URL con extensión .jpg)", () => {
        expect(parseTexto("La foto está en http://x.com/foto.jpg según me contaron.").success).toBe(false);
    });

    it("RECHAZA un enlace a video (.mp4)", () => {
        expect(parseTexto("https://ejemplo.com/clip.mp4").success).toBe(false);
    });

    it("ACEPTA un enlace que NO es multimedia (fuera del alcance del invariante)", () => {
        expect(parseTexto("El perfil es https://facebook.com/perfil-sospechoso y pedía fotos.").success).toBe(true);
    });

    it("RECHAZA texto de más de 2000 caracteres (alineado a AGENTS.md)", () => {
        const largo = "texto legitimo ".repeat(150); // 2250 chars con espacios (no es blob)
        expect(largo.length).toBeGreaterThan(2000);
        expect(parseTexto(largo).success).toBe(false);
    });

    it("ACEPTA exactamente el límite de 2000 caracteres sin multimedia", () => {
        const mil = "ab ".repeat(666) + "ab"; // 1998 + 2 = 2000, con espacios (ni blob ni exceso)
        expect(mil.length).toBe(2000);
        expect(parseTexto(mil).success).toBe(true);
    });
});

describe("textoReporteTieneMultimedia (SPEC-893 · predicado puro)", () => {
    it("true para data:-URI, blob base64 largo y URL multimedia", () => {
        expect(textoReporteTieneMultimedia("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
        expect(textoReporteTieneMultimedia("x".repeat(250))).toBe(true);
        expect(textoReporteTieneMultimedia("mirá https://a.b/c.WEBP ahí")).toBe(true);
        expect(textoReporteTieneMultimedia("audio en http://a.b/v.mp3")).toBe(true);
    });

    it("false para prosa, teléfono, nick y URL no-multimedia", () => {
        expect(textoReporteTieneMultimedia("Le pidió fotos a mi hija por el chat, al 3001234567.")).toBe(false);
        expect(textoReporteTieneMultimedia("El nick es @pedro.perez_99 en la plataforma.")).toBe(false);
        expect(textoReporteTieneMultimedia("El perfil: https://instagram.com/usuario")).toBe(false);
        expect(textoReporteTieneMultimedia("Mencionó un archivo foto.jpg pero no lo adjuntó.")).toBe(false);
    });
});

// SPEC-900 · CANDADO: el invariante SOLO-TEXTO también cubre los `nota` de operador
// (darDeBaja/reactivar). Muere con el defecto: sin el `.refine`, una nota con multimedia pasa.
describe("nota de operador · invariante SOLO-TEXTO (SPEC-900)", () => {
    const motivo = Object.values(MotivoBajaReporte)[0];

    it("reactivar: una nota con data:-URI (imagen embebida) es rechazada con el mensaje de nota", () => {
        const r = reactivarReporteSchema.safeParse({
            nota: "listo: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAoNUEVAAAAASUVORK5CYII=",
        });
        expect(r.success).toBe(false);
        if (!r.success) {
            expect(r.error.issues.some((i) => i.message === MENSAJE_SOLO_TEXTO_NOTA)).toBe(true);
        }
    });

    it("reactivar: una URL de imagen en la nota es rechazada", () => {
        const r = reactivarReporteSchema.safeParse({ nota: "ver http://x.com/evidencia.jpg" });
        expect(r.success).toBe(false);
    });

    it("reactivar: una nota de texto normal pasa", () => {
        const r = reactivarReporteSchema.safeParse({
            nota: "Se reactiva: el reportante corrigió el identificador y el caso vuelve a ser válido.",
        });
        expect(r.success).toBe(true);
    });

    it("reactivar: un enlace NO-multimedia en la nota pasa (no se bloquea un link de página)", () => {
        const r = reactivarReporteSchema.safeParse({ nota: "Caso externo en https://fiscalia.gov.co/caso/123" });
        expect(r.success).toBe(true);
    });

    it("darDeBaja: un blob base64 en la nota es rechazado; con texto normal pasa", () => {
        const blob = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAoNUEVA".repeat(6); // 240 chars base64 contiguos
        const malo = darDeBajaReporteSchema.safeParse({ motivo, nota: `adjunto ${blob}` });
        expect(malo.success).toBe(false);

        const bueno = darDeBajaReporteSchema.safeParse({
            motivo,
            nota: "Se da de baja por duplicado confirmado con el caso RPT-ABC123.",
        });
        expect(bueno.success).toBe(true);
    });
});

/**
 * SPEC-641 (I-377 · gemelo de SPEC-630) · CANDADO — POST /api/auth/verificar/solicitar NO enumera, por
 * el CUERPO ni por el TIEMPO. En PRODUCCIÓN. Unidad pura (deps mockeadas, sin BD): determinista y sin
 * reloj (el margen tolerante sería ciego al oráculo del bcrypt — [[ceo-candado-umbral-con-holgura-cruzar-el-vivo]]).
 *
 * Cierra dos fugas:
 *  (a) CUERPO — el 202 es byte-idéntico para existente / correo-nuevo (y límite). Se compara el cuerpo
 *      ENTERO (deep-equal, claves incluidas): la fuga vivía en la PRESENCIA de `emailSent` (ausente en
 *      `existente`, presente en el nuevo), no en su valor — un `expect(message).toBe(message)` la dejaría
 *      pasar. Se afirma además que NO hay clave de más.
 *  (b) TIEMPO — como CONDUCTA, no como reloj: el trabajo caso-dependiente (lookup + bcrypt + código +
 *      ambos envíos) se despacha fuera del camino síncrono. Se mockea el envío para que NUNCA resuelva:
 *      si el handler lo AWAITara, la respuesta colgaría → ROJO por timeout; con fire-and-forget retorna →
 *      VERDE. Prueba que el await se fue, sin umbral de ms.
 *  (c) BL-3 — en prod el cuerpo JAMÁS trae el código, ni para el correo nuevo.
 *
 * Debe forzar NODE_ENV=production o probaría el camino de dev (síncrono + devCode). Verificado por
 * MUTACIÓN: agregar una clave al cuerpo prod → (a) ROJO; volver el despacho a `await` → (b) cuelga.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockSolicitar, mockEnviarCodigo, mockEnviarExistente, mockRateLimit } = vi.hoisted(() => ({
    mockSolicitar: vi.fn(),
    mockEnviarCodigo: vi.fn(),
    mockEnviarExistente: vi.fn(),
    mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockRateLimit }));
vi.mock("@/lib/email", () => ({
    enviarCodigoVerificacion: mockEnviarCodigo,
    enviarEmailCuentaExistente: mockEnviarExistente,
}));
vi.mock("@/lib/dal/services/autenticacion", () => ({
    AutenticacionService: vi.fn(() => ({ solicitarCodigo: mockSolicitar })),
}));

import { POST } from "./route";

const MENSAJE_EXITO = "Si el email es válido, recibirás un código de verificación.";

function req(email = "sonda@example.com"): Request {
    return new Request("http://localhost:5005/api/auth/verificar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.88" },
        body: JSON.stringify({ email }),
    });
}

async function cuerpoPara(resultado: unknown) {
    mockSolicitar.mockResolvedValueOnce(resultado);
    const res = await POST(req());
    return { status: res.status, body: await res.json() };
}

describe("SPEC-641 · verificar/solicitar no enumera (prod)", () => {
    let envPrevio: string | undefined;
    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000, headers: {} });
        mockEnviarCodigo.mockResolvedValue(undefined);
        mockEnviarExistente.mockResolvedValue(undefined);
        envPrevio = process.env.NODE_ENV;
        (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    });
    afterEach(() => {
        (process.env as { NODE_ENV: string }).NODE_ENV = envPrevio ?? "test";
    });

    it("(a) el cuerpo 202 es byte-idéntico para existente / nuevo / límite, y no lleva clave de más", async () => {
        const existente = await cuerpoPara({ ok: true, tipo: "existente" });
        const nuevo = await cuerpoPara({ ok: true, tipo: "ok", code: "123456" });
        const limite = await cuerpoPara({ ok: false, tipo: "limite" });

        // Deep-equal del cuerpo ENTERO (no solo `message`): la fuga vive en la PRESENCIA de `emailSent`.
        expect(nuevo.body, "nuevo vs existente").toEqual(existente.body);
        expect(limite.body, "límite vs existente").toEqual(existente.body);
        expect(existente.body).toEqual({ message: MENSAJE_EXITO });
        expect(Object.keys(existente.body).sort(), "ninguna clave de más (presencia = fuga)").toEqual(["message"]);
        for (const c of [existente, nuevo, limite]) expect(c.status).toBe(202);
    });

    it("(b) fire-and-forget: si el envío NUNCA resuelve, la respuesta igual retorna (sin await en el handler)", async () => {
        mockSolicitar.mockResolvedValueOnce({ ok: true, tipo: "ok", code: "654321" });
        mockEnviarCodigo.mockReturnValueOnce(new Promise<void>(() => {})); // jamás resuelve
        // Si el handler AWAITara el trabajo, esta línea colgaría hasta el timeout de vitest → ROJO.
        const res = await POST(req());
        expect(res.status).toBe(202);
        expect(await res.json()).toEqual({ message: MENSAJE_EXITO });
    });

    it("(c) BL-3: en producción el cuerpo NUNCA trae el código, ni para el correo nuevo", async () => {
        const { body } = await cuerpoPara({ ok: true, tipo: "ok", code: "999000" });
        expect(body.devCode, "jamás el código en el cuerpo de prod").toBeUndefined();
        expect(body).toEqual({ message: MENSAJE_EXITO });
    });
});

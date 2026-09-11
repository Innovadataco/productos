/**
 * SPEC-630 (I-377) · CANDADO — POST /api/auth/recuperar/solicitar NO enumera, por el CUERPO ni por el
 * TIEMPO. En PRODUCCIÓN. Unidad pura (deps mockeadas, sin BD): determinista y sin reloj (el margen
 * tolerante sería ciego al oráculo del hashToken — [[ceo-candado-umbral-con-holgura-cruzar-el-vivo]]).
 *
 * Cierra dos fugas:
 *  (a) CUERPO — el 200 es byte-idéntico para los 3 casos (sin_usuario / solo_google / con_clave). Se
 *      compara el cuerpo ENTERO (deep-equal, claves incluidas): la fuente gemela (verificar/solicitar,
 *      SPEC-641) vivía en la PRESENCIA de una clave, no en su valor — un `expect(message).toBe(message)`
 *      la dejaría pasar. Se afirma además que NO hay clave de más.
 *  (b) TIEMPO — como CONDUCTA, no como reloj: el trabajo caso-dependiente (lookup + hashToken lento +
 *      envío) se despacha fuera del camino síncrono. Se mockea el envío para que NUNCA resuelva: si el
 *      handler lo AWAITara, la respuesta colgaría → ROJO por timeout; con fire-and-forget retorna → VERDE.
 *      Prueba que el await se fue, sin umbral de ms.
 *  (c) BL-3 — en prod el cuerpo JAMÁS trae token, ni con cuenta-con-clave.
 *
 * Debe forzar NODE_ENV=production o probaría el camino de dev (síncrono + devToken), que no es la
 * superficie de amenaza. Verificado por MUTACIÓN: agregar una clave al cuerpo prod → (a) ROJO; volver el
 * despacho a `await` → (b) cuelga (ROJO).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockSolicitar, mockEnviar, mockRateLimit } = vi.hoisted(() => ({
    mockSolicitar: vi.fn(),
    mockEnviar: vi.fn(),
    mockRateLimit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockRateLimit }));
vi.mock("@/lib/email", () => ({ enviarTokenRecuperacion: mockEnviar }));
vi.mock("@/lib/dal/services/autenticacion", () => ({
    AutenticacionService: vi.fn(() => ({ solicitarRecuperacion: mockSolicitar })),
}));

import { POST } from "./route";

const MENSAJE_EXITO = "Si el email está registrado, recibirás un enlace para restablecer tu contraseña.";

function req(email = "sonda@example.com"): Request {
    return new Request("http://localhost:5005/api/auth/recuperar/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.77" },
        body: JSON.stringify({ email }),
    });
}

async function cuerpoPara(resultado: unknown) {
    mockSolicitar.mockResolvedValueOnce(resultado);
    const res = await POST(req());
    return { status: res.status, body: await res.json() };
}

describe("SPEC-630 · recuperar/solicitar no enumera (prod)", () => {
    let envPrevio: string | undefined;
    beforeEach(() => {
        vi.clearAllMocks();
        mockRateLimit.mockResolvedValue({ allowed: true, resetAt: Date.now() + 60_000, headers: {} });
        mockEnviar.mockResolvedValue(undefined);
        envPrevio = process.env.NODE_ENV;
        (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    });
    afterEach(() => {
        (process.env as { NODE_ENV: string }).NODE_ENV = envPrevio ?? "test";
    });

    it("(a) el cuerpo 200 es byte-idéntico en los 3 casos, y no lleva clave de más", async () => {
        const sinUsuario = await cuerpoPara({ ok: true, tipo: "sin_usuario" });
        const soloGoogle = await cuerpoPara({ ok: true, tipo: "solo_google" });
        const conClave = await cuerpoPara({ ok: true, tipo: "ok", token: "tok-secreto-123" });

        // Deep-equal del cuerpo ENTERO (no solo `message`): la fuga gemela vive en la PRESENCIA de claves.
        expect(conClave.body, "con_clave vs sin_usuario").toEqual(sinUsuario.body);
        expect(soloGoogle.body, "solo_google vs sin_usuario").toEqual(sinUsuario.body);
        expect(sinUsuario.body).toEqual({ message: MENSAJE_EXITO });
        expect(Object.keys(sinUsuario.body).sort(), "ninguna clave de más (presencia = fuga)").toEqual(["message"]);
        for (const c of [sinUsuario, soloGoogle, conClave]) expect(c.status).toBe(200);
    });

    it("(b) fire-and-forget: si el envío NUNCA resuelve, la respuesta igual retorna (sin await en el handler)", async () => {
        mockSolicitar.mockResolvedValueOnce({ ok: true, tipo: "ok", token: "tok-x" });
        mockEnviar.mockReturnValueOnce(new Promise<void>(() => {})); // jamás resuelve
        // Si el handler AWAITara el trabajo, esta línea colgaría hasta el timeout de vitest → ROJO.
        const res = await POST(req());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ message: MENSAJE_EXITO });
    });

    it("(c) BL-3: en producción el cuerpo NUNCA trae token, ni con cuenta-con-clave", async () => {
        const { body } = await cuerpoPara({ ok: true, tipo: "ok", token: "tok-secreto" });
        expect(body.devToken, "jamás el token en el cuerpo de prod").toBeUndefined();
        expect(body).toEqual({ message: MENSAJE_EXITO });
    });
});

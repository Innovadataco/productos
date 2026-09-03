/**
 * SPEC-400 (I-236) · PR 1 · Tests del interceptor de refresco de sesion_estado.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
    installSesionRefreshInterceptor,
    __resetSesionRefreshInterceptorParaTests,
} from "./sesion-refresh-interceptor";

type FetchFn = typeof fetch;
type FakeResponse = { status: number; ok: boolean; contentType?: string; body?: unknown };

function respuesta({ status, contentType = "application/json", body }: FakeResponse): Response {
    const cuerpo = body === undefined ? "" : JSON.stringify(body);
    return new Response(cuerpo, {
        status,
        headers: { "content-type": contentType },
    });
}

const RESP_ESTADO_REQUERIDO: FakeResponse = {
    status: 401,
    ok: false,
    body: { error: { code: "SESION_ESTADO_REQUERIDO", message: "x", retry: true } },
};
const RESP_OK: FakeResponse = { status: 200, ok: true, body: { ok: true } };
const RESP_401_OTRO: FakeResponse = {
    status: 401,
    ok: false,
    body: { error: { code: "NO_AUTENTICADO", message: "x" } },
};

describe("sesion-refresh-interceptor", () => {
    let target: { fetch: FetchFn; [key: string]: unknown };
    let fetchOriginal: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchOriginal = vi.fn();
        target = { fetch: fetchOriginal as unknown as FetchFn };
    });

    afterEach(() => {
        __resetSesionRefreshInterceptorParaTests(target);
    });

    it("deja pasar respuestas 200 sin tocar", async () => {
        fetchOriginal.mockResolvedValueOnce(respuesta(RESP_OK));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/algo");
        expect(res.status).toBe(200);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });

    it("deja pasar 401 que NO son SESION_ESTADO_REQUERIDO", async () => {
        fetchOriginal.mockResolvedValueOnce(respuesta(RESP_401_OTRO));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/algo");
        expect(res.status).toBe(401);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });

    it("captura 401 SESION_ESTADO_REQUERIDO, refresca, y reintenta una vez", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta(RESP_OK)) // refresh OK
            .mockResolvedValueOnce(respuesta(RESP_OK)); // reintento OK
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/padre/home");
        expect(res.status).toBe(200);
        expect(fetchOriginal).toHaveBeenCalledTimes(3);
        expect(fetchOriginal.mock.calls[1][0]).toBe("/api/vigencia/refresh");
        expect((fetchOriginal.mock.calls[1][1] as RequestInit).method).toBe("POST");
    });

    it("si el refresh falla, devuelve el 401 original SIN reintentar", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta({ status: 401, ok: false, body: { error: { message: "sin JWT" } } }));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/padre/home");
        expect(res.status).toBe(401);
        expect(fetchOriginal).toHaveBeenCalledTimes(2);
    });

    it("si el reintento vuelve a caer 401 SESION_ESTADO_REQUERIDO, NO entra en bucle", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta(RESP_OK))
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/padre/home");
        expect(res.status).toBe(401);
        expect(fetchOriginal).toHaveBeenCalledTimes(3);
    });

    it("nunca dispara refresh cuando la llamada ES a /api/vigencia/refresh", async () => {
        fetchOriginal.mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/vigencia/refresh", { method: "POST" });
        expect(res.status).toBe(401);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });

    it("single-flight: N peticiones concurrentes disparan UN solo refresh", async () => {
        // 3 requests distintos, todos con 401 SESION_ESTADO_REQUERIDO en el primer envío,
        // 200 en el reintento. Debe haber UN solo refresh compartido.
        let refreshCount = 0;
        fetchOriginal.mockImplementation((url: string) => {
            if (url === "/api/vigencia/refresh") {
                refreshCount++;
                // Simular latencia mínima para que las 3 peticiones colapsen
                return new Promise((res) =>
                    setTimeout(() => res(respuesta(RESP_OK)), 5),
                );
            }
            const stateKey = `count_${url}`;
            const g = target as unknown as Record<string, number>;
            g[stateKey] = (g[stateKey] ?? 0) + 1;
            if (g[stateKey] === 1) return Promise.resolve(respuesta(RESP_ESTADO_REQUERIDO));
            return Promise.resolve(respuesta(RESP_OK));
        });
        installSesionRefreshInterceptor(target);
        const [a, b, c] = await Promise.all([
            target.fetch("/api/a"),
            target.fetch("/api/b"),
            target.fetch("/api/c"),
        ]);
        expect([a.status, b.status, c.status]).toEqual([200, 200, 200]);
        expect(refreshCount).toBe(1);
    });

    it("es idempotente: instalar dos veces NO duplica el parche", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta(RESP_OK))
            .mockResolvedValueOnce(respuesta(RESP_OK));
        installSesionRefreshInterceptor(target);
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/algo");
        expect(res.status).toBe(200);
        expect(fetchOriginal).toHaveBeenCalledTimes(3);
    });

    it("con input Request, clona el body para el reintento (no consume stream)", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta(RESP_OK))
            .mockResolvedValueOnce(respuesta(RESP_OK));
        installSesionRefreshInterceptor(target);
        const req = new Request("http://x/api/algo", {
            method: "POST",
            body: JSON.stringify({ hola: 1 }),
            headers: { "content-type": "application/json" },
        });
        const res = await target.fetch(req);
        expect(res.status).toBe(200);
        // El primer y tercer call fueron con Request; el body de cada uno debe ser legible.
        const primero = fetchOriginal.mock.calls[0][0] as Request;
        const tercero = fetchOriginal.mock.calls[2][0] as Request;
        await expect(primero.text()).resolves.toContain("hola");
        await expect(tercero.text()).resolves.toContain("hola");
    });

    it("no toca respuestas 401 sin content-type JSON (no clona texto binario)", async () => {
        fetchOriginal.mockResolvedValueOnce(
            respuesta({ status: 401, ok: false, contentType: "text/html", body: "<html>login</html>" }),
        );
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/algo");
        expect(res.status).toBe(401);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });
});

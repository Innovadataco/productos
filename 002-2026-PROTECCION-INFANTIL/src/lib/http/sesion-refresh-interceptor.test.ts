/**
 * SPEC-400 (I-236) → SPEC-572 · Tests del interceptor de refresco de sesion_estado.
 * El cerrojo del middleware responde 403 { code: "SESION_ESTADO_REQUERIDO" } (SPEC-329: gateado,
 * no «no-autenticado»). El interceptor SOLO reintenta ese código — un 403 de muro real
 * (consentimiento/password/vigencia) pasa tal cual, no se reintenta.
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
    status: 403,
    ok: false,
    body: { error: { code: "SESION_ESTADO_REQUERIDO", message: "x", retry: true } },
};
const RESP_OK: FakeResponse = { status: 200, ok: true, body: { ok: true } };
// Un 403 de MURO REAL (consentimiento): mismo status, código distinto → NO se reintenta.
const RESP_403_MURO: FakeResponse = {
    status: 403,
    ok: false,
    body: { error: { code: "CONSENTIMIENTO_REQUERIDO", message: "x" } },
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

    it("deja pasar un 403 de MURO REAL (código distinto) sin refrescar ni reintentar", async () => {
        fetchOriginal.mockResolvedValueOnce(respuesta(RESP_403_MURO));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/algo");
        expect(res.status).toBe(403);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });

    it("captura 403 SESION_ESTADO_REQUERIDO, refresca, y reintenta una vez", async () => {
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

    it("si el refresh falla, devuelve el 403 original SIN reintentar", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta({ status: 401, ok: false, body: { error: { message: "sin JWT" } } }));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/padre/home");
        expect(res.status).toBe(403);
        expect(fetchOriginal).toHaveBeenCalledTimes(2);
    });

    it("si el reintento vuelve a caer 403 SESION_ESTADO_REQUERIDO, NO entra en bucle", async () => {
        fetchOriginal
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO))
            .mockResolvedValueOnce(respuesta(RESP_OK))
            .mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/padre/home");
        expect(res.status).toBe(403);
        expect(fetchOriginal).toHaveBeenCalledTimes(3);
    });

    it("CANDADO (loop-free): 403 de estado PERSISTENTE → exactamente 1 refresh + 1 retry → el 403 propaga", async () => {
        // SPEC-572 (revisión CEO) · el otro camino del bucle: NO el ping-pong de página (`_rv`), sino
        // el reintento de fetch. Su carácter loop-free es sutil y frágil: depende de reintentar con
        // `original` (fetch SIN parchar) y NO con `g.fetch`. Si un refactor reintentara con el parchado,
        // el 403 del reintento se re-interceptaría → refresh + retry infinitos, y hoy nada lo vigila.
        //
        // Mock PERSISTENTE (no `...Once`): la ruta gateada SIEMPRE da 403 y el refresh SIEMPRE ok. En el
        // código correcto: 1 refresh + exactamente 2 toques a la gateada (intento + reintento) y el 403
        // propaga. En un refactor con bucle: la gateada se tocaría muchas más veces → el candado muere.
        let gated = 0;
        let refresh = 0;
        fetchOriginal.mockImplementation((url: string) => {
            if (url === "/api/vigencia/refresh") {
                refresh++;
                return Promise.resolve(respuesta(RESP_OK));
            }
            gated++;
            // Tope de seguridad: si un refactor introduce bucle, no colgamos la suite — tras unos
            // pocos toques devolvemos OK y la aserción `gated === 2` lo delata con un número mayor.
            if (gated > 5) return Promise.resolve(respuesta(RESP_OK));
            return Promise.resolve(respuesta(RESP_ESTADO_REQUERIDO));
        });
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/padre/home");
        expect(res.status, "el 403 de estado persistente propaga, no se enmascara ni cicla").toBe(403);
        expect(refresh, "exactamente UN refresh").toBe(1);
        expect(gated, "exactamente 1 intento + 1 reintento (con `original`, no `g.fetch`): sin bucle").toBe(2);
    });

    // SPEC-572 (revisión CEO · hallazgo de Calidad «no ejercitado») — el interceptor ENMASCARA el
    // 403 de estado tras re-sellar (el llamador recibe 200). Eso es correcto SOLO mientras la
    // distinción por `code` funcione: si se reintentara cualquier 403, un muro REAL (consentimiento,
    // cambio de password, vigencia) se reintentaría y se enmascararía como 200 → el usuario pasaría
    // un bloqueo legítimo en silencio (I-236 reabierto por la puerta de al lado, y NADIE lo vería
    // porque el 200 es normal). Este candado fija: muro real NO se reintenta y PROPAGA su 403.
    for (const code of ["CONSENTIMIENTO_REQUERIDO", "CAMBIO_PASSWORD_REQUERIDO", "VIGENCIA_REQUERIDA"]) {
        it(`CANDADO (muro real): 403 «${code}» NO se reintenta y PROPAGA al llamador (no se enmascara como 200)`, async () => {
            // Las dos respuestas OK extra solo se consumen si un refactor reintentara: entonces el
            // refresh daría 200 y el retry enmascararía el muro como 200 — y la aserción lo delata.
            fetchOriginal
                .mockResolvedValueOnce(respuesta({ status: 403, ok: false, body: { error: { code, message: "muro" } } }))
                .mockResolvedValueOnce(respuesta(RESP_OK))
                .mockResolvedValueOnce(respuesta(RESP_OK));
            installSesionRefreshInterceptor(target);
            const res = await target.fetch("/api/padre/home");
            expect(res.status, `el muro «${code}» PROPAGA su 403, no se enmascara como 200`).toBe(403);
            expect(fetchOriginal, `el muro «${code}» NO dispara refresh ni retry`).toHaveBeenCalledTimes(1);
        });
    }

    it("nunca dispara refresh cuando la llamada ES a /api/vigencia/refresh", async () => {
        fetchOriginal.mockResolvedValueOnce(respuesta(RESP_ESTADO_REQUERIDO));
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/vigencia/refresh", { method: "POST" });
        expect(res.status).toBe(403);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });

    it("single-flight: N peticiones concurrentes disparan UN solo refresh", async () => {
        let refreshCount = 0;
        fetchOriginal.mockImplementation((url: string) => {
            if (url === "/api/vigencia/refresh") {
                refreshCount++;
                return new Promise((res) => setTimeout(() => res(respuesta(RESP_OK)), 5));
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
        const primero = fetchOriginal.mock.calls[0][0] as Request;
        const tercero = fetchOriginal.mock.calls[2][0] as Request;
        await expect(primero.text()).resolves.toContain("hola");
        await expect(tercero.text()).resolves.toContain("hola");
    });

    it("no toca respuestas 403 sin content-type JSON (no clona texto binario)", async () => {
        fetchOriginal.mockResolvedValueOnce(
            respuesta({ status: 403, ok: false, contentType: "text/html", body: "<html>login</html>" }),
        );
        installSesionRefreshInterceptor(target);
        const res = await target.fetch("/api/algo");
        expect(res.status).toBe(403);
        expect(fetchOriginal).toHaveBeenCalledTimes(1);
    });
});

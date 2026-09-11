// tests/unit/bi-estado-sistema.test.ts · Healthcheck endurecido (I-390)
// Producto 006 · BI v2
// Cubre GET /api/bi/estado-sistema tras el endurecimiento de 2026-09-11:
// la réplica se cayó 3 días con subenabled='t' y el healthcheck decía
// 'activa'. Ahora el estado exige apply worker vivo y lag de mensajes
// razonable. Unitarios puros: prisma mockeado, sin BD, sin red.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: { $queryRaw: mocks.queryRaw },
}));

import { GET } from "@/app/api/bi/estado-sistema/route";

/** Encamina cada consulta $queryRaw según su SQL (template literal mockeado:
    el primer argumento es el TemplateStringsArray). */
function alistarSondas(opciones: {
    suscripciones?: number;
    worker?: { vivo: boolean; lag: number | null }[] | "falla";
    tablas?: { total: number }[] | "falla";
    mvs?: { total: number; pobladas: number }[] | "falla";
}) {
    mocks.queryRaw.mockImplementation((strings: TemplateStringsArray) => {
        const sql = strings.join(" ");
        if (sql.includes("SELECT 1")) return Promise.resolve([]);
        if (sql.includes("count(*)::int AS total FROM pg_stat_subscription")) {
            return Promise.resolve([{ total: opciones.suscripciones ?? 1 }]);
        }
        if (sql.includes("pid IS NOT NULL AS vivo")) {
            if (opciones.worker === "falla") return Promise.reject(new Error("sondeo roto"));
            return Promise.resolve(opciones.worker ?? [{ vivo: true, lag: 2 }]);
        }
        if (sql.includes("pg_subscription_rel")) {
            if (opciones.tablas === "falla") return Promise.reject(new Error("sondeo roto"));
            return Promise.resolve(opciones.tablas ?? [{ total: 44 }]);
        }
        if (sql.includes("pg_matviews")) {
            if (opciones.mvs === "falla") return Promise.reject(new Error("sondeo roto"));
            return Promise.resolve(opciones.mvs ?? [{ total: 5, pobladas: 5 }]);
        }
        return Promise.reject(new Error(`SQL no esperada: ${sql}`));
    });
}

describe("GET /api/bi/estado-sistema", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DATABASE_URL = "postgres://mock";
    });

    it("réplica sana: activa con worker vivo y lag medido", async () => {
        alistarSondas({ worker: [{ vivo: true, lag: 2 }] });
        const res = await GET();
        const cuerpo = await res.json();
        expect(cuerpo.db).toBe("conectada");
        expect(cuerpo.replica.estado).toBe("activa");
        expect(cuerpo.replica.workerVivo).toBe(true);
        expect(cuerpo.replica.minDesdeUltimoMensaje).toBe(2);
    });

    it("I-390: suscripción existente con apply worker muerto → error, no activa", async () => {
        alistarSondas({ worker: [{ vivo: false, lag: 0 }] });
        const cuerpo = await (await GET()).json();
        expect(cuerpo.replica.estado).toBe("error");
        expect(cuerpo.replica.workerVivo).toBe(false);
    });

    it("I-390: mensajes estancados (lag alto) → error aunque el worker corra", async () => {
        alistarSondas({ worker: [{ vivo: true, lag: 30 }] });
        const cuerpo = await (await GET()).json();
        expect(cuerpo.replica.estado).toBe("error");
        expect(cuerpo.replica.minDesdeUltimoMensaje).toBe(30);
    });

    it("lag nulo (nunca llegó un mensaje) → error", async () => {
        alistarSondas({ worker: [{ vivo: true, lag: null }] });
        const cuerpo = await (await GET()).json();
        expect(cuerpo.replica.estado).toBe("error");
    });

    it("sin suscripciones → sin_configurar", async () => {
        alistarSondas({ suscripciones: 0 });
        const cuerpo = await (await GET()).json();
        expect(cuerpo.replica.estado).toBe("sin_configurar");
    });

    it("sondeo de worker falla → no se condena por lo no medido (candado 9)", async () => {
        alistarSondas({ worker: "falla" });
        const cuerpo = await (await GET()).json();
        expect(cuerpo.replica.estado).toBe("activa");
        expect(cuerpo.replica.workerVivo).toBeUndefined();
    });

    it("BD caída → db error y réplica error", async () => {
        mocks.queryRaw.mockRejectedValue(new Error("bd caída"));
        const cuerpo = await (await GET()).json();
        expect(cuerpo.db).toBe("error");
        expect(cuerpo.replica.estado).toBe("error");
    });
});

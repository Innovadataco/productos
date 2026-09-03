// tests/unit/bi-bitacora.test.ts · Panel Bitácora en admin (SPEC-006 · Lote 3 · AGENTE C)
// Producto 006 · BI v2
// Cubre GET /api/bi/bitacora: 401 sin sesión (sin tocar BD), 400 con fecha
// inválida (formato roto y fecha inexistente), 400 estado/página inválidos,
// 200 sin filtros (where vacío) y 200 con filtros — verifica el where, el
// skip/take y el shape { filas, total, pagina, paginas } que recibe/devuelve
// prisma mockeado. Unitarios puros: sin BD, sin red.

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    leerSesion: vi.fn(),
    consultaLogFindMany: vi.fn(),
    consultaLogCount: vi.fn(),
}));

vi.mock("@/lib/auth/sesion", () => ({ leerSesion: mocks.leerSesion }));
vi.mock("@/lib/db", () => ({
    prisma: {
        bIConsultaLog: {
            findMany: mocks.consultaLogFindMany,
            count: mocks.consultaLogCount,
        },
    },
}));

import { GET } from "@/app/api/bi/bitacora/route";

const EMAIL_SESION = "jelkin@innovadataco.com";

// Fila REAL de bi_consulta_log tal como la devuelve Prisma con el select de
// la ruta (solo las 7 columnas del listado — nunca sql/plan/pasos).
const FILA = {
    id: "clg_01",
    preguntaNL: "¿Cuántos reportes hay en revisión manual?",
    estado: "ok",
    latenciaMs: 812,
    fuenteCache: false,
    creadoEn: new Date("2026-09-01T00:04:00.000Z"),
    usuarioId: EMAIL_SESION,
};

function requestGet(query = ""): Request {
    return new Request(`http://localhost:3001/api/bi/bitacora${query}`, { method: "GET" });
}

describe("GET /api/bi/bitacora · sesión y validación", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.leerSesion.mockResolvedValue({ email: EMAIL_SESION });
        mocks.consultaLogFindMany.mockResolvedValue([FILA]);
        mocks.consultaLogCount.mockResolvedValue(1);
    });

    it("sin sesión → 401 y NO toca la BD", async () => {
        mocks.leerSesion.mockResolvedValue(null);
        const res = await GET(requestGet());
        expect(res.status).toBe(401);
        expect(mocks.consultaLogFindMany).not.toHaveBeenCalled();
        expect(mocks.consultaLogCount).not.toHaveBeenCalled();
    });

    it("desde con formato roto → 400 y NO toca la BD", async () => {
        const res = await GET(requestGet("?desde=01/09/2026"));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "fecha_invalida", detalle: "desde" });
        expect(mocks.consultaLogFindMany).not.toHaveBeenCalled();
    });

    it("hasta inexistente en el calendario (2026-02-30) → 400", async () => {
        const res = await GET(requestGet("?hasta=2026-02-30"));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "fecha_invalida", detalle: "hasta" });
        expect(mocks.consultaLogFindMany).not.toHaveBeenCalled();
    });

    it("estado fuera de la lista → 400", async () => {
        const res = await GET(requestGet("?estado=pendiente"));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "estado_invalido" });
    });

    it("pagina no numérica o menor que 1 → 400", async () => {
        for (const q of ["?pagina=abc", "?pagina=0", "?pagina=-2", "?pagina=1.5"]) {
            const res = await GET(requestGet(q));
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "pagina_invalida" });
        }
        expect(mocks.consultaLogFindMany).not.toHaveBeenCalled();
    });
});

describe("GET /api/bi/bitacora · filtros y paginación", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.leerSesion.mockResolvedValue({ email: EMAIL_SESION });
    });

    it("sin filtros → where vacío, página 1 de 25, shape del contrato", async () => {
        mocks.consultaLogFindMany.mockResolvedValue([FILA]);
        mocks.consultaLogCount.mockResolvedValue(1);

        const res = await GET(requestGet());
        expect(res.status).toBe(200);

        expect(mocks.consultaLogFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {},
                orderBy: { creadoEn: "desc" },
                skip: 0,
                take: 25,
            }),
        );
        expect(mocks.consultaLogCount).toHaveBeenCalledWith({ where: {} });
        // El listado nunca pide sql/plan/pasos.
        const select = mocks.consultaLogFindMany.mock.calls[0][0].select as Record<string, boolean>;
        expect(select.sqlGenerado).toBeUndefined();
        expect(select.planJson).toBeUndefined();
        expect(select.pasosJson).toBeUndefined();

        const cuerpo = await res.json();
        expect(cuerpo).toEqual({
            filas: [
                {
                    id: "clg_01",
                    preguntaNL: FILA.preguntaNL,
                    estado: "ok",
                    latenciaMs: 812,
                    fuenteCache: false,
                    creadoEn: "2026-09-01T00:04:00.000Z",
                    usuarioId: EMAIL_SESION,
                },
            ],
            total: 1,
            pagina: 1,
            paginas: 1,
        });
        expect(JSON.stringify(cuerpo)).not.toContain("SELECT");
    });

    it("con rango de fechas + estado → where con gte/lte y estado, MISMO where en count", async () => {
        mocks.consultaLogFindMany.mockResolvedValue([FILA]);
        mocks.consultaLogCount.mockResolvedValue(1);

        const res = await GET(requestGet("?desde=2026-08-01&hasta=2026-08-31&estado=error"));
        expect(res.status).toBe(200);

        const esperado = {
            creadoEn: {
                gte: new Date("2026-08-01T00:00:00.000Z"),
                lte: new Date("2026-08-31T23:59:59.999Z"),
            },
            estado: "error",
        };
        expect(mocks.consultaLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: esperado }));
        expect(mocks.consultaLogCount).toHaveBeenCalledWith({ where: esperado });
    });

    it("pagina=3 → skip 50 take 25; paginas = techo(total/25)", async () => {
        mocks.consultaLogFindMany.mockResolvedValue([FILA]);
        mocks.consultaLogCount.mockResolvedValue(61);

        const res = await GET(requestGet("?pagina=3"));
        expect(res.status).toBe(200);

        expect(mocks.consultaLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, take: 25 }));
        const cuerpo = await res.json();
        expect(cuerpo.pagina).toBe(3);
        expect(cuerpo.total).toBe(61);
        expect(cuerpo.paginas).toBe(3); // ceil(61/25)
    });

    it("sin resultados → filas vacías, total 0, paginas 0 (honesto, no inventa)", async () => {
        mocks.consultaLogFindMany.mockResolvedValue([]);
        mocks.consultaLogCount.mockResolvedValue(0);

        const res = await GET(requestGet("?estado=ok"));
        expect(res.status).toBe(200);
        const cuerpo = await res.json();
        expect(cuerpo).toEqual({ filas: [], total: 0, pagina: 1, paginas: 0 });
    });
});

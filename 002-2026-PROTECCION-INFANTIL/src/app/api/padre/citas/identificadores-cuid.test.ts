/**
 * SPEC-444 (I-310) — los identificadores del padre son cuid, no uuid.
 *
 * Las tres rutas de citas del padre validaban sus ids con `z.string().uuid()`.
 * Todos los modelos de PI generan el id con `@default(cuid())`, así que el id
 * REAL nunca pasó el esquema: `POST /api/padre/citas` respondía 400 siempre y
 * `SolicitudCita` tenía 0 filas en producción.
 *
 * Candado de CONDUCTA, no de palabras: no mira el texto del esquema, ejercita
 * el handler. Volvé cualquiera de los tres a `z.string().uuid()` y el bloque
 * «acepta un cuid real» se pone rojo — el servicio deja de recibir la llamada.
 *
 * La contraprueba está en el mismo archivo a propósito: el arreglo NO puede ser
 * aflojar la validación a `z.string()`. Un identificador basura sigue siendo
 * 400 y el servicio NO se llama.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/** Tomado de la base el 04-09-2026: `select id from "Usuario" limit 1`. */
const CUID_REAL = "cmtna68w700l3c8gbhl3dtrms";
const BASURA = "abc";

const mocks = vi.hoisted(() => ({
    verifyAuth: vi.fn(),
    crearSolicitudCita: vi.fn(),
    reasignarPorPadre: vi.fn(),
    reprogramarPorPadre: vi.fn(),
    obtenerPorcentajeServicio: vi.fn(),
    leerPrecioEstandarPrimeraCita: vi.fn(),
    findParaPadre: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ verifyAuth: mocks.verifyAuth }));

vi.mock("@/lib/profesional/cita/cita.service", () => ({
    crearSolicitudCita: mocks.crearSolicitudCita,
    reasignarPorPadre: mocks.reasignarPorPadre,
    reprogramarPorPadre: mocks.reprogramarPorPadre,
}));

vi.mock("@/lib/profesional/cita/comision", () => ({
    obtenerPorcentajeServicio: mocks.obtenerPorcentajeServicio,
}));

vi.mock("@/lib/profesional/cita/precio-primera-cita", () => ({
    leerPrecioEstandarPrimeraCita: mocks.leerPrecioEstandarPrimeraCita,
}));

vi.mock("@/lib/profesional/cita/dto", () => ({
    toCitaParaPadre: (s: unknown) => s,
}));

vi.mock("@/lib/dal/repositories/solicitud-cita", () => ({
    SolicitudCitaRepository: class {
        findParaPadre = mocks.findParaPadre;
    },
}));

import { POST as crear } from "./route";
import { POST as reasignar } from "./[id]/reasignar/route";
import { POST as reprogramar } from "./[id]/reprogramar/route";

function req(body: unknown) {
    return new Request("http://localhost:5005/api/padre/citas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

const params = { params: Promise.resolve({ id: CUID_REAL }) };

const PRESENTACION = "Necesito orientación sobre un caso de acoso en el colegio de mi hija.";

describe("SPEC-444 · las rutas de citas del padre aceptan cuid", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.verifyAuth.mockResolvedValue({ id: CUID_REAL, rol: "PARENT" });
        mocks.obtenerPorcentajeServicio.mockResolvedValue(20);
        mocks.leerPrecioEstandarPrimeraCita.mockResolvedValue(150000);
        mocks.crearSolicitudCita.mockResolvedValue({ id: CUID_REAL });
        mocks.reasignarPorPadre.mockResolvedValue({ id: CUID_REAL });
        mocks.reprogramarPorPadre.mockResolvedValue({ id: CUID_REAL });
        mocks.findParaPadre.mockResolvedValue(null);
    });

    describe("con un cuid real NO responde 400 y el servicio recibe el id", () => {
        it("POST /api/padre/citas", async () => {
            const res = await crear(req({
                profesionalId: CUID_REAL,
                franjaId: CUID_REAL,
                presentacion: PRESENTACION,
                urgencia: "SIN_APURO",
            }));

            expect(res.status).not.toBe(400);
            expect(mocks.crearSolicitudCita).toHaveBeenCalledTimes(1);
            expect(mocks.crearSolicitudCita.mock.calls[0]?.[0]).toMatchObject({
                profesionalId: CUID_REAL,
                franjaId: CUID_REAL,
            });
        });

        it("POST /api/padre/citas/[id]/reasignar", async () => {
            const res = await reasignar(
                req({ nuevoProfesionalId: CUID_REAL, nuevaFranjaId: CUID_REAL }),
                params,
            );

            expect(res.status).not.toBe(400);
            expect(mocks.reasignarPorPadre).toHaveBeenCalledTimes(1);
            expect(mocks.reasignarPorPadre.mock.calls[0]?.[0]).toMatchObject({
                nuevoProfesionalId: CUID_REAL,
                nuevaFranjaId: CUID_REAL,
            });
        });

        it("POST /api/padre/citas/[id]/reprogramar", async () => {
            const res = await reprogramar(req({ nuevaFranjaId: CUID_REAL }), params);

            expect(res.status).not.toBe(400);
            expect(mocks.reprogramarPorPadre).toHaveBeenCalledTimes(1);
            expect(mocks.reprogramarPorPadre.mock.calls[0]?.[0]).toMatchObject({
                nuevaFranjaId: CUID_REAL,
            });
        });
    });

    describe("contraprueba · un identificador basura sigue siendo 400", () => {
        it("POST /api/padre/citas", async () => {
            const res = await crear(req({
                profesionalId: BASURA,
                franjaId: CUID_REAL,
                presentacion: PRESENTACION,
                urgencia: "SIN_APURO",
            }));

            expect(res.status).toBe(400);
            expect(mocks.crearSolicitudCita).not.toHaveBeenCalled();
        });

        it("POST /api/padre/citas/[id]/reasignar", async () => {
            const res = await reasignar(
                req({ nuevoProfesionalId: BASURA, nuevaFranjaId: CUID_REAL }),
                params,
            );

            expect(res.status).toBe(400);
            expect(mocks.reasignarPorPadre).not.toHaveBeenCalled();
        });

        it("POST /api/padre/citas/[id]/reprogramar", async () => {
            const res = await reprogramar(req({ nuevaFranjaId: BASURA }), params);

            expect(res.status).toBe(400);
            expect(mocks.reprogramarPorPadre).not.toHaveBeenCalled();
        });
    });
});

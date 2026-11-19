/**
 * SPEC-927 (Calidad) · Genera UNA alerta de colegio REAL sobre un estudiante, para los journeys
 * que necesitan partir de una alerta (comité, seguimiento…).
 *
 * Camino (el mismo que afirma `recorrido-journey-colegio-alerta-tipo-sujeto`, SPEC-926):
 *   1. el rector registra un identificador al estudiante activo del colegio
 *      (`POST /api/colegio/alumnos/[id]/identificadores`);
 *   2. un tercero lo reporta por el endpoint público (`POST /api/reportes`, anónimo);
 *   3. PUENTE DECLARADO — el arnés no corre el worker: se deja el reporte visible (CLASIFICADO)
 *      y se llama a `notificarColegioSiCorresponde`, la MISMA función que llama
 *      `scripts/worker-reportes.mjs` tras clasificar.
 * AFIRMA que salió exactamente una alerta ESTUDIANTE para ese reporte y la devuelve.
 *
 * El llamador es dueño de la limpieza: debe pasar `reporteId` a `limpiarColegioProfundo` y
 * cerrar pg-boss (`disposeBoss`) en su `afterAll` — el motor encola avisos desde este proceso.
 */
import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { notificarColegioSiCorresponde } from "@/lib/colegio/alertas";

export interface OpcionesAlertaColegio {
    /** Sesión del rector (SCHOOL_ADMIN) del colegio. */
    rector: APIRequestContext;
    colegioId: string;
    /** Prefijo único de la corrida (para el valor del identificador). */
    corrida: string;
    baseURL: string;
}

export async function generarAlertaDeEstudiante(
    opts: OpcionesAlertaColegio,
): Promise<{ alertaId: string; reporteId: string; valor: string }> {
    const { rector, colegioId, corrida, baseURL } = opts;
    const valor = `alumno_${corrida}`;

    const estudiante = await prisma.estudiante.findFirstOrThrow({
        where: { colegioId, estado: "activo" },
        select: { id: true },
    });
    const registro = await rector.post(`/api/colegio/alumnos/${estudiante.id}/identificadores`, { data: { valor } });
    expect(registro.status(), `identificador de estudiante · body=${await registro.text()}`).toBe(201);

    const anonimo = await playwrightRequest.newContext({ baseURL });
    let reporteId: string;
    try {
        const paises = await (await anonimo.get("/api/paises")).json();
        const colombia = paises.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
        const ciudades = await (await anonimo.get(`/api/ciudades?paisId=${colombia.id}`)).json();
        const bogota = ciudades.ciudades.find((c: { nombre: string }) => c.nombre === "Bogotá");
        const res = await anonimo.post("/api/reportes", {
            data: {
                identificador: valor,
                plataforma: "whatsapp",
                texto: `Corrida ${corrida}: este usuario insulta y amenaza a un compañero por chat todos los días después de clase.`,
                fechaIncidente: "2026-07-10T15:00:00Z",
                ciudad: "Bogotá",
                pais: "Colombia",
                paisId: colombia.id,
                ciudadId: bogota.id,
            },
        });
        const texto = await res.text();
        expect(res.status(), `reporte anónimo · body=${texto}`).toBe(201);
        reporteId = (JSON.parse(texto) as { reporte: { id: string } }).reporte.id;
    } finally {
        await anonimo.dispose();
    }

    // Puente declarado (ver cabecera): lo que hace el worker tras clasificar.
    await prisma.reporte.update({ where: { id: reporteId }, data: { estado: "CLASIFICADO" } });
    await notificarColegioSiCorresponde(reporteId);

    const alertas = await prisma.alertaColegio.findMany({
        where: { colegioId, reporteId },
        select: { id: true, tipoSujeto: true, estado: true },
    });
    expect(alertas, "exactamente una alerta para el reporte").toHaveLength(1);
    expect(alertas[0].tipoSujeto).toBe("ESTUDIANTE");
    expect(alertas[0].estado, "la alerta nace «nueva»").toBe("nueva");
    return { alertaId: alertas[0].id, reporteId, valor };
}

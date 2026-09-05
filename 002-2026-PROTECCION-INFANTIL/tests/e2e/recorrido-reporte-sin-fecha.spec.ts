/**
 * SPEC-438 (Calidad) · Recorrido: el reporte anónimo EXIGE la fecha del
 * incidente y MARCA cuando la hora es aproximada.
 *
 * ORIGEN. SPEC-438 (I-305) ya está en `main`. Hasta esta spec, si el
 * formulario se enviaba sin hora, el cliente mandaba `new Date()`: el instante
 * del ENVÍO quedaba guardado como la hora del HECHO — un dato falso,
 * indistinguible de uno verdadero, que alimentaba la franja horaria entregada
 * al modelo y un informe con valor probatorio. Ahora la fecha es obligatoria y
 * nunca la rellena el sistema; quien no recuerda la hora elige una FRANJA, y esa
 * elección queda marcada en `horaAproximada` para que el análisis distinga una
 * hora precisa de una estimada.
 *
 * QUÉ AFIRMA (comportamiento bueno, ya desplegado — CERO `test.fail`):
 *
 *   (A) `POST /api/reportes` SIN `fechaIncidente` → RECHAZADO (400,
 *       `code = VALIDATION_ERROR`, `campo = "fechaIncidente"`). Afirmado contra
 *       el SERVIDOR (el schema `crearReporteSchema` la hace obligatoria), no
 *       contra un botón deshabilitado del cliente. El sistema ya NO inventa la
 *       fecha: sin dato, el reporte no sale.
 *
 *   (B) `POST /api/reportes` CON fecha + `horaAproximada: true` → GUARDADO, y
 *       la MARCA queda en `true` en la fila. Candado de conducta: no basta el
 *       201 — se LEE la fila con `prisma.reporte.findUnique` y se afirma que
 *       `horaAproximada === true`. Un 201 con la marca en `false` (el bug de
 *       tratar la franja como hora exacta) haría fallar este candado.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-438-`. El reporte anónimo
 * es público (`esRutaPublica` incluye `/api/reportes`): no requiere sesión.
 * Limpieza FK-safe en `afterAll` (borra los `Reporte` creados por id; sus filas
 * hijas — `FuenteReporte`, etc. — caen por `onDelete: Cascade`). Sin mutación de
 * estado global ni de parámetros.
 *
 * RATE-LIMIT. `POST /api/reportes` tiene rate-limit por IP/fingerprint, pero el
 * CI corre con `DISABLE_RATE_LIMIT=true` (ver `playwright.config.ts`) y cada
 * test usa un `identificador` único, así que no se topa el 429.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

const CORRIDA = `e2e-438-${randomUUID().slice(0, 8)}`;

// Fecha del incidente en el PASADO (el schema rechaza fechas futuras). Hoy es
// 2026-09-04; esta queda holgadamente atrás.
const FECHA_INCIDENTE = "2026-07-10T10:00:00Z";

// Ids de los reportes creados en la corrida, para la limpieza FK-safe.
const reportesCreados = new Set<string>();

async function obtenerColombiaBogota(request: APIRequestContext) {
    const paisesRes = await request.get("/api/paises");
    expect(paisesRes.status(), "GET /api/paises").toBe(200);
    const paisesBody = await paisesRes.json();
    const colombia = paisesBody.paises.find((p: { nombre: string }) => p.nombre === "Colombia");
    expect(colombia, "país Colombia en el seed").toBeDefined();

    const ciudadesRes = await request.get(`/api/ciudades?paisId=${colombia.id}`);
    expect(ciudadesRes.status(), "GET /api/ciudades").toBe(200);
    const ciudadesBody = await ciudadesRes.json();
    const bogota = ciudadesBody.ciudades.find((c: { nombre: string }) => c.nombre === "Bogotá");
    expect(bogota, "ciudad Bogotá en el seed").toBeDefined();

    return { paisId: colombia.id as string, ciudadId: bogota.id as string };
}

test.describe.serial("SPEC-438 · el reporte anónimo exige fecha y marca la aproximación", () => {
    test.afterAll(async () => {
        const ids = [...reportesCreados];
        if (ids.length > 0) {
            await prisma.reporte.deleteMany({ where: { id: { in: ids } } });
        }
        reportesCreados.clear();
    });

    test("A · POST /api/reportes SIN fechaIncidente es rechazado (400 VALIDATION_ERROR, campo fechaIncidente)", async ({ request }) => {
        const { paisId, ciudadId } = await obtenerColombiaBogota(request);
        const identificador = `${CORRIDA}-A`;

        // Todo válido MENOS la fecha del incidente, que se OMITE. El sistema ya no
        // la inventa: el schema la exige y el reporte no debe salir.
        const res = await request.post("/api/reportes", {
            data: {
                identificador,
                plataforma: "whatsapp",
                texto: "Un usuario contactó a mi hija ofreciéndole regalos de forma insistente y persistente.",
                ciudad: "Bogotá",
                pais: "Colombia",
                paisId,
                ciudadId,
            },
        });

        expect(res.status(), "sin fecha → 400").toBe(400);
        const body = await res.json();
        expect(body.error?.code, "code VALIDATION_ERROR").toBe("VALIDATION_ERROR");
        expect(body.error?.campo, "el campo señalado es fechaIncidente").toBe("fechaIncidente");

        // Reproducción NEGATIVA del bug: NO nació ningún reporte con este
        // identificador (el sistema ya no guarda con la fecha inventada).
        const filas = await prisma.reporte.count({ where: { identificador } });
        expect(filas, "ningún reporte creado sin fecha").toBe(0);
    });

    test("B · POST /api/reportes CON fecha y hora aproximada guarda horaAproximada=true en la fila", async ({ request }) => {
        const { paisId, ciudadId } = await obtenerColombiaBogota(request);
        const identificador = `${CORRIDA}-B`;

        const res = await request.post("/api/reportes", {
            data: {
                identificador,
                plataforma: "whatsapp",
                texto: "Un usuario contactó a mi hijo de madrugada; no recuerdo la hora exacta, elijo la franja.",
                fechaIncidente: FECHA_INCIDENTE,
                horaAproximada: true,
                ciudad: "Bogotá",
                pais: "Colombia",
                paisId,
                ciudadId,
            },
        });

        expect(res.status(), "con fecha → 201").toBe(201);
        const body = await res.json();
        const reporteId = body.reporte?.id as string | undefined;
        expect(reporteId, "la respuesta trae el id del reporte").toBeTruthy();
        reportesCreados.add(reporteId!);

        // Candado de conducta: LEER la fila, no confiar en el 201. La marca de
        // aproximación TIENE que haber quedado persistida en `true`.
        const fila = await prisma.reporte.findUnique({
            where: { id: reporteId! },
            select: { id: true, horaAproximada: true, fechaIncidente: true, identificador: true },
        });
        expect(fila, "la fila existe en base").not.toBeNull();
        expect(fila!.identificador, "identificador de la corrida").toBe(identificador);
        expect(fila!.horaAproximada, "la franja quedó marcada como aproximada").toBe(true);
        expect(fila!.fechaIncidente, "la fecha del incidente quedó guardada").toEqual(new Date(FECHA_INCIDENTE));
    });
});

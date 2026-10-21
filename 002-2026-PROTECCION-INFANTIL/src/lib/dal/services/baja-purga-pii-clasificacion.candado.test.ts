/**
 * CANDADO · SPEC-892 / I-422 · la BAJA de un reporte purga la PII LITERAL de ClasificacionIA (Ley 1581).
 *
 * El defecto: `ClasificacionIA.piiDetectada` (String[], SIN cifrar) guarda la PII literal que la IA
 * extrae del menor — nombre, teléfono, dirección, colegio — y `rawResponse` la repite. `darDeBajaReporte`
 * purgaba el texto de trabajo y borraba el embedding, pero NUNCA tocaba ClasificacionIA. En una
 * eliminación Ley 1581 (ORDEN_LEGAL / solicitud del titular) el relato quedaba «[purgado]» pero el
 * nombre/teléfono/dirección del menor SOBREVIVÍA en claro indefinidamente — eliminación incompleta.
 *
 * El fix purga `piiDetectada=[]` / `rawResponse=null` / `contienePii=false` dentro de la MISMA tx de la
 * baja, para TODA baja (no solo la legal): abajo no tiene uso operacional y reactivar la recomputa
 * (mismo trato que el embedding). Integración (BD real). Muere con el defecto: quitar el `updateMany`
 * del service deja la PII viva → rojo. Control positivo incluido (se afirma que ANTES de la baja la PII
 * está en claro).
 *
 * FUERA DE ALCANCE (I-422, decisión Jelkin+abogado): si piiDetectada debe persistir/cifrarse/guardar
 * solo el tipo para reportes ACTIVOS. Este candado solo cubre la purga en la baja.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { darDeBajaReporte } from "./reporte-lifecycle";

/** PII literal del menor, como la que extrae el anonimizador (anonimizador.test.ts): nombre/teléfono/dirección. */
const PII = ["Juan", "3001234567", "carrera 45 # 12-34", "Colegio San José"];
const RAW = '{"categoria":"CONTACTO_INSISTENTE","relato":"Juan, tel 3001234567, vive en carrera 45 # 12-34"}';

async function sembrarReporteConPii(identificador: string, plataformaId: string, numero: string) {
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador,
            plataformaId,
            texto: "Relato de prueba con suficientes caracteres para sellar el contenido.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: numero,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.8,
            contienePii: true,
            piiDetectada: PII,
            rawResponse: RAW,
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    return reporte;
}

describe("SPEC-892 / I-422 · la baja purga la PII literal de ClasificacionIA (Ley 1581)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("ORDEN_LEGAL: deja piiDetectada=[] / rawResponse=null / contienePii=false", async () => {
        const admin = await crearUsuario("ADMIN");
        const plataforma = await crearPlataforma();
        const reporte = await sembrarReporteConPii("+573010000001", plataforma.id, "RPT-892-A");

        // Control positivo: ANTES de la baja la PII literal del menor está en claro.
        const antes = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(antes?.piiDetectada).toEqual(PII);
        expect(antes?.rawResponse).toBe(RAW);
        expect(antes?.contienePii).toBe(true);

        await darDeBajaReporte({ reporteId: reporte.id, motivo: "ORDEN_LEGAL", nota: "eliminación Ley 1581", adminId: admin.id });

        const despues = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(despues?.piiDetectada, "la PII literal del menor NO sobrevive a la baja").toEqual([]);
        expect(despues?.rawResponse, "la respuesta cruda (repite la PII) se anula").toBeNull();
        expect(despues?.contienePii, "la bandera de PII se baja").toBe(false);
    });

    it("purga en TODA baja, no solo la legal (RETIRO_LIMPIEZA también)", async () => {
        const admin = await crearUsuario("ADMIN");
        const plataforma = await crearPlataforma();
        const reporte = await sembrarReporteConPii("+573010000002", plataforma.id, "RPT-892-B");

        await darDeBajaReporte({ reporteId: reporte.id, motivo: "RETIRO_LIMPIEZA", nota: "retiro de limpieza", adminId: admin.id });

        const despues = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(despues?.piiDetectada).toEqual([]);
        expect(despues?.rawResponse).toBeNull();
        expect(despues?.contienePii).toBe(false);
    });
});

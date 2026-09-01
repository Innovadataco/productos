/**
 * SPEC-340 (A-68 §4.3 · T011) — el historial de informes es inmutable DE VERDAD.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as servicio from "./informes-padre";

async function crearExpediente(padreId: string) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: "300inmutable",
            origenCreacion: "PADRE",
            estado: "ACTIVO",
            fechaApertura: new Date(),
        },
    });
}

describe("informes-padre (SPEC-340)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("numera secuencial por expediente — dos generaciones en el mismo minuto no chocan", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);

        const [a, b] = await Promise.all([
            servicio.registrarInformePadre({
                expedienteId: exp.id,
                generadoPorId: padre.id,
                pdfHash: "hash-a".padEnd(64, "0"),
                codigoVerificacion: "codigo-a",
            }),
            servicio.registrarInformePadre({
                expedienteId: exp.id,
                generadoPorId: padre.id,
                pdfHash: "hash-b".padEnd(64, "0"),
                codigoVerificacion: "codigo-b",
            }),
        ]);

        expect(new Set([a.numeroSecuencial, b.numeroSecuencial])).toEqual(new Set([1, 2]));
        const lista = await servicio.listarInformesPadre(exp.id);
        expect(lista).toHaveLength(2);
        expect(lista[0].numeroSecuencial).toBe(2); // más reciente primero
    });

    it("la búsqueda pública por hash encuentra el informe; un hash ajeno no", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);
        await servicio.registrarInformePadre({
            expedienteId: exp.id,
            generadoPorId: padre.id,
            pdfHash: "h".padEnd(64, "1"),
            codigoVerificacion: "codigo-x",
        });

        expect(await servicio.buscarInformePadrePorHash("h".padEnd(64, "1"))).not.toBeNull();
        expect(await servicio.buscarInformePadrePorHash("z".padEnd(64, "9"))).toBeNull();
    });

    it("INMUTABILIDAD: el servicio no exporta ninguna vía de mutación", () => {
        const exports = Object.keys(servicio);
        // Nada que empiece por actualizar/borrar/editar/eliminar/update/delete.
        const mutadores = exports.filter((e) => /^(actualizar|borrar|editar|eliminar|update|delete|marcar)/i.test(e));
        expect(mutadores, "el historial es evidencia: sin vías de mutación").toEqual([]);
        expect(exports.sort()).toEqual(
            ["buscarInformePadrePorHash", "listarInformesPadre", "registrarInformePadre"].sort()
        );
    });
});

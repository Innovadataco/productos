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

    it("numera secuencial por expediente — 8 generaciones concurrentes serializan 1..8 sin chocar (I-208 · carrera real)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);

        // 8 concurrentes = presión suficiente para que la carrera aparezca si
        // el advisory-lock no está: el max+1 sin serializar duplica al 2º hit.
        const N = 8;
        const resultados = await Promise.all(
            Array.from({ length: N }, (_, i) =>
                servicio.registrarInformePadre({
                    expedienteId: exp.id,
                    generadoPorId: padre.id,
                    pdfHash: `hash-${i}`.padEnd(64, "0"),
                    codigoVerificacion: `codigo-${i}`,
                })
            )
        );

        // Cada informe recibió un número distinto y la unión es exactamente {1..N}.
        expect(new Set(resultados.map((r) => r.numeroSecuencial))).toEqual(
            new Set(Array.from({ length: N }, (_, i) => i + 1))
        );
        const lista = await servicio.listarInformesPadre(exp.id);
        expect(lista).toHaveLength(N);
        expect(lista[0].numeroSecuencial).toBe(N); // más reciente primero
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
            ["buscarInformePadrePorCodigo", "buscarInformePadrePorHash", "listarInformesPadre", "registrarInformePadre"].sort()
        );
    });
});

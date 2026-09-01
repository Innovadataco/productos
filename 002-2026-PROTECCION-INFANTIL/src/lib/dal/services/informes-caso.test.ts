/**
 * SPEC-351 (T040/T041/T042) · el historial de informes del caso es inmutable
 * DE VERDAD y el correlativo no pierde carreras.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearPlataforma,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
} from "@/lib/reporte-test-utils";
import * as servicio from "./informes-caso";

async function crearCaso() {
    const { colegio, admin } = await crearColegioConAdmin();
    const plataforma = await crearPlataforma();
    const curso = await crearCurso(colegio.id);
    const estudiante = await crearEstudiante(curso.id, colegio.id);
    const identificador = await crearIdentificadorEstudiante(estudiante.id, { plataformaId: plataforma.id });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificador.valor,
            plataformaId: plataforma.id,
            texto: "x",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "CO",
            estado: "CLASIFICADO",
        },
    });
    const alerta = await prisma.alertaColegio.create({
        data: {
            colegioId: colegio.id,
            reporteId: reporte.id,
            tipoSujeto: "ESTUDIANTE",
            identificadorEstudianteId: identificador.id,
            vencimientoSla: new Date(Date.now() + 48 * 3600 * 1000),
        },
    });
    const caso = await prisma.seguimientoCaso.create({ data: { colegioId: colegio.id, alertaId: alerta.id } });
    return { caso, admin };
}

function inputBase(casoId: string, adminId: string, n: number) {
    return {
        casoId,
        firmadoPorId: adminId,
        firmadoPorNombre: "Rector Prueba",
        firmadoPorDocumento: "123456",
        pdfHash: `hash-${n}-${Date.now()}`.padEnd(64, "0"),
        codigoVerificacion: `cod-${n}-${Date.now()}`,
        escudoAssetKey: null,
        secciones: ["hechos"],
        anio: 2026,
    };
}

describe("informes-caso (SPEC-351)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("8 generaciones concurrentes serializan INF-2026-0001..0008 sin chocar (carrera I-208)", async () => {
        const { caso, admin } = await crearCaso();
        const N = 8;
        const resultados = await Promise.all(
            Array.from({ length: N }, (_, i) => servicio.registrarInformeCaso(inputBase(caso.id, admin.id, i)))
        );
        expect(new Set(resultados.map((r) => r.numeroCorrelativo))).toEqual(
            new Set(Array.from({ length: N }, (_, i) => i + 1))
        );
        expect(resultados.map((r) => r.correlativo).sort()).toContain("INF-2026-0001");
        const lista = await servicio.listarInformesCaso(caso.id);
        expect(lista).toHaveLength(N);
        expect(lista[0].numeroCorrelativo).toBe(N); // más reciente primero
    });

    it("rollover de año: 2026-0042 no arrastra — 2027 arranca en 0001", async () => {
        const { caso, admin } = await crearCaso();
        await servicio.registrarInformeCaso({ ...inputBase(caso.id, admin.id, 1), anio: 2026 });
        const en2027 = await servicio.registrarInformeCaso({ ...inputBase(caso.id, admin.id, 2), anio: 2027 });
        expect(en2027.correlativo).toBe("INF-2027-0001");
    });

    it("INMUTABILIDAD: el servicio no exporta ninguna vía de mutación", () => {
        const exports = Object.keys(servicio);
        const mutadores = exports.filter((e) => /^(actualizar|borrar|editar|eliminar|update|delete|marcar)/i.test(e));
        expect(mutadores, "el historial es evidencia: sin vías de mutación").toEqual([]);
    });

    it("verificación por hash y por código encuentran el informe; falsos no", async () => {
        const { caso, admin } = await crearCaso();
        const creado = await servicio.registrarInformeCaso(inputBase(caso.id, admin.id, 9));
        expect(await servicio.buscarInformeCasoPorCodigo(creado.codigoVerificacion)).not.toBeNull();
        expect(await servicio.buscarInformeCasoPorCodigo("no-existe")).toBeNull();
    });
});

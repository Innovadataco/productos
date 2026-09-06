/**
 * SPEC-543 (I-330) · CANDADO de conducta — mutación en las DOS direcciones.
 *
 * Un padre DEBE ver que OTRA persona reportó al mismo depredador. Los «otros
 * reportes» del mismo identificador incluyen los ANÓNIMOS y los DUPLICADOS
 * (marcados como anónimos), con ciudad · país · fecha/hora · clasificación.
 * El estado DUPLICADO NO oculta: un duplicado es justo la señal de que otro lo
 * reportó. El TEXTO del relato NUNCA viaja en el payload (blindaje R-4).
 *
 * Muere en los dos sentidos:
 *  (A) si un anónimo DUPLICADO del mismo identificador deja de listarse → rojo
 *      (era el bug: whereReporteAprobado dejaba fuera el estado DUPLICADO).
 *  (B) si el texto del relato aparece en el payload (JSON serializado) → rojo.
 *
 * El padre reporta desde BOGOTÁ y el anónimo desde MEDELLÍN: así «contiene
 * Medellín» prueba que el anónimo está listado (no lo confunde la ciudad del
 * propio padre) y sostiene la dirección (A) también en el test (B).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPlataforma } from "@/lib/reporte-test-utils";
import type { EstadoReporte, CategoriaConducta } from "@prisma/client";
import { listarCadenasPadre } from "./cadenas-padre";

const TEXTO_ANONIMO = "TEXTO-SECRETO-DEL-ANONIMO-que-no-puede-filtrarse-jamas-al-padre";
const TEXTO_PADRE = "Relato-del-propio-padre-tampoco-va-en-el-listado";
const IDENT = "depredador_6001"; // como el identificador 6001 del incidente real (I-330)
const CIUDAD_PADRE = "Bogotá";
const CIUDAD_ANONIMO = "Medellín";

async function crearReporte(opts: {
    usuarioId: string | null;
    plataformaId: string;
    estado: EstadoReporte;
    esAnonimo: boolean;
    texto: string;
    ciudad: string;
    categoria?: CategoriaConducta;
}): Promise<void> {
    const r = await prisma.reporte.create({
        data: {
            usuarioId: opts.usuarioId,
            plataformaId: opts.plataformaId,
            identificador: IDENT,
            texto: opts.texto,
            fechaIncidente: new Date("2026-08-30T21:00:00Z"),
            estado: opts.estado,
            esAnonimo: opts.esAnonimo,
            pais: "Colombia",
            ciudad: opts.ciudad,
        },
        select: { id: true },
    });
    if (opts.categoria) {
        await prisma.clasificacionIA.create({
            data: { reporteId: r.id, categoria: opts.categoria, confianza: 0.9, modeloUsado: "llama3.1:8b", latenciaMs: 100 },
        });
    }
}

describe("SPEC-543 · el padre ve el anónimo duplicado del mismo identificador (sin el texto)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("(A) lista el reporte ANÓNIMO en estado DUPLICADO del mismo identificador", async () => {
        const padre = await crearUsuario("PARENT", `padre-543-a-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        await crearReporte({ usuarioId: padre.id, plataformaId: plataforma.id, estado: "CLASIFICADO", esAnonimo: false, texto: TEXTO_PADRE, ciudad: CIUDAD_PADRE, categoria: "CONTACTO_INSISTENTE" });
        await crearReporte({ usuarioId: null, plataformaId: plataforma.id, estado: "DUPLICADO", esAnonimo: true, texto: TEXTO_ANONIMO, ciudad: CIUDAD_ANONIMO, categoria: "CONTACTO_INSISTENTE" });

        const [cadena] = await listarCadenasPadre(padre.id);
        expect(cadena.otrosReportes.length).toBe(1);
        const otro = cadena.otrosReportes[0];
        expect(otro.esAnonimo).toBe(true);
        expect(otro.pais).toBe("Colombia");
        expect(otro.ciudad).toBe(CIUDAD_ANONIMO);
        expect(otro.categoriaLabel).toEqual(expect.any(String)); // clasificación visible
        expect(otro.creadoEn).toBeInstanceOf(Date); // fecha/hora
    });

    it("(B) el texto del relato NO viaja en el payload —ni el del anónimo ni el del padre—, pero el anónimo SÍ está representado", async () => {
        const padre = await crearUsuario("PARENT", `padre-543-b-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        await crearReporte({ usuarioId: padre.id, plataformaId: plataforma.id, estado: "CLASIFICADO", esAnonimo: false, texto: TEXTO_PADRE, ciudad: CIUDAD_PADRE, categoria: "CONTACTO_INSISTENTE" });
        await crearReporte({ usuarioId: null, plataformaId: plataforma.id, estado: "DUPLICADO", esAnonimo: true, texto: TEXTO_ANONIMO, ciudad: CIUDAD_ANONIMO, categoria: "CONTACTO_INSISTENTE" });

        const payload = JSON.stringify(await listarCadenasPadre(padre.id));
        expect(payload).not.toContain(TEXTO_ANONIMO);
        expect(payload).not.toContain(TEXTO_PADRE);
        // que (B) no pase por listado vacío: el anónimo está, por SU ciudad (no la del padre).
        expect(payload).toContain(CIUDAD_ANONIMO);
    });

    it("(contraprueba) un anónimo clasificado SPAM del mismo identificador NO se lista (ruido, no señal)", async () => {
        const padre = await crearUsuario("PARENT", `padre-543-c-${Date.now()}@test.local`);
        const plataforma = await crearPlataforma();
        await crearReporte({ usuarioId: padre.id, plataformaId: plataforma.id, estado: "CLASIFICADO", esAnonimo: false, texto: TEXTO_PADRE, ciudad: CIUDAD_PADRE, categoria: "CONTACTO_INSISTENTE" });
        await crearReporte({ usuarioId: null, plataformaId: plataforma.id, estado: "CLASIFICADO", esAnonimo: true, texto: "spam ruido", ciudad: CIUDAD_ANONIMO, categoria: "SPAM" });

        const [cadena] = await listarCadenasPadre(padre.id);
        expect(cadena.otrosReportes.length).toBe(0);
    });
});

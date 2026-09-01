/**
 * SPEC-341 · audit #214 candado 1 — el worker CIERRA el placeholder GENERANDO
 * (update in-place); no crea una fila nueva que deje el placeholder eterno.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    cerrarPlaceholderPublicando,
    cerrarPlaceholderFallando,
} from "./ejecutar-analisis";
import { armarPayload } from "./armar-payload";

async function crearExpediente(padreId: string) {
    return prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `@t-${Date.now()}-${Math.random()}`,
            origenCreacion: "PADRE",
            estado: "ACTIVO",
            fechaApertura: new Date(),
        },
    });
}

async function sembrarPlaceholder(expedienteId: string, hash: string, versionSecuencial = 1) {
    return prisma.analisisExpediente.create({
        data: {
            expedienteId,
            versionSecuencial,
            alcance: "PADRE_COMPLETO",
            hashCadena: hash,
            corteN: 0,
            texto: "",
            modeloUsado: "?",
            promptSistemaHash: "?",
            latenciaMs: 0,
            estado: "GENERANDO",
        },
    });
}

describe("SPEC-341 · cerrarPlaceholder{Publicando,Fallando} (audit #214)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("cerrarPlaceholderPublicando ACTUALIZA la misma fila (no crea otra)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);
        const hash = "h".repeat(64);
        const placeholder = await sembrarPlaceholder(exp.id, hash);

        const payload = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [], hijoCruzado: null });
        await cerrarPlaceholderPublicando(exp.id, hash, "PADRE_COMPLETO", "texto real del modelo", payload, "modelo-x", "prompt-hash", 100, 5);

        const filas = await prisma.analisisExpediente.findMany({ where: { expedienteId: exp.id } });
        expect(filas, "cerrarPlaceholderPublicando NUNCA crea fila nueva si hay placeholder").toHaveLength(1);
        expect(filas[0].id).toBe(placeholder.id);
        expect(filas[0].estado).toBe("PUBLICADO");
        expect(filas[0].texto).toBe("texto real del modelo");
        expect(filas[0].corteN).toBe(5);
        expect(filas[0].publicadoEn).not.toBeNull();
    });

    it("cerrarPlaceholderFallando marca FALLIDO en la misma fila (con motivo)", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);
        const hash = "f".repeat(64);
        const placeholder = await sembrarPlaceholder(exp.id, hash);

        await cerrarPlaceholderFallando(exp.id, hash, "PADRE_COMPLETO", "modelo-x", "prompt-hash", 500, "timeout_ollama");

        const filas = await prisma.analisisExpediente.findMany({ where: { expedienteId: exp.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0].id).toBe(placeholder.id);
        expect(filas[0].estado).toBe("FALLIDO");
        expect(filas[0].motivoFallo).toBe("timeout_ollama");
    });

    it("SIN placeholder previo (worker antes que DAL) crea fila nueva con estado terminal", async () => {
        const padre = await crearUsuario("PARENT");
        const exp = await crearExpediente(padre.id);
        const hash = "n".repeat(64);

        const payload = armarPayload({ alcance: "PADRE_COMPLETO", hechos: [], hijoCruzado: null });
        await cerrarPlaceholderPublicando(exp.id, hash, "PADRE_COMPLETO", "texto sin placeholder", payload, "m", "ph", 90, 3);

        const filas = await prisma.analisisExpediente.findMany({ where: { expedienteId: exp.id } });
        expect(filas).toHaveLength(1);
        expect(filas[0].estado).toBe("PUBLICADO");
        expect(filas[0].versionSecuencial).toBe(1);
    });
});

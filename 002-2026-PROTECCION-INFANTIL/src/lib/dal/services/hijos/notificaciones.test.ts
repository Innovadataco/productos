/**
 * SPEC-339 (A-67 · punto 4 Calidad) — el cruce identificador-de-hijo → aviso.
 *
 * Los dos tests de "interruptores propios" son la razón de las dos columnas
 * nuevas: un aviso del círculo NO silencia al hijo, y apagar el círculo NO
 * apaga al hijo.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { notificarHijosSiCorresponde } from "./notificaciones";
import { registrarHijo } from "./hijos";
import { enviarAlertaHijoReporte } from "@/lib/email";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";
import type { EstadoReporte } from "@prisma/client";

vi.mock("@/lib/email", () => ({
    enviarAlertaHijoReporte: vi.fn().mockResolvedValue(undefined),
}));

const enviarMock = vi.mocked(enviarAlertaHijoReporte);

async function crearParams() {
    await prisma.parametroSistema.createMany({
        data: [
            { clave: "circulo.notificaciones.enabled", valor: "true", tipo: "BOOLEAN", categoria: "EMAIL", esPublico: false, descripcion: "" },
            { clave: "circulo.notificaciones.cooldown_horas", valor: "24", tipo: "INTEGER", categoria: "EMAIL", esPublico: false, descripcion: "" },
        ],
    });
}

async function crearReporte(identificador: string, estado: EstadoReporte = "CLASIFICADO") {
    const plataforma = await prisma.plataforma.findFirst();
    return prisma.reporte.create({
        data: {
            identificador: normalizarIdentificador(identificador),
            plataformaId: plataforma!.id,
            texto: "Texto de prueba",
            fechaIncidente: new Date("2026-08-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado,
        },
    });
}

async function padreConHijo(identificador: string, nombre = "Juan David") {
    const padre = await crearUsuario("PARENT");
    const { hijoId } = await registrarHijo(padre.id, {
        nombre,
        apellidos: "De Prueba",
        documentoTipo: "TI",
        documentoNumero: `doc-${Math.random().toString(36).slice(2, 8)}`,
        identificadores: [{ valor: identificador }],
    });
    return { padre, hijoId };
}

describe("notificarHijosSiCorresponde (SPEC-339)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPaisCiudad();
        await crearPlataforma();
        await crearParams();
        vi.clearAllMocks();
    });

    it("un reporte visible sobre la cuenta del hijo avisa al padre dueño", async () => {
        const { padre } = await padreConHijo("RobloxJuan");
        const reporte = await crearReporte("RobloxJuan");

        await notificarHijosSiCorresponde(reporte.id);

        expect(enviarMock).toHaveBeenCalledOnce();
        const payload = enviarMock.mock.calls[0][0];
        expect(payload.destinatario.usuarioId).toBe(padre.id);
        expect(payload.nombreHijo).toBe("Juan"); // solo el primer nombre (PII mínima)
        // Y deja la marca de enfriamiento PROPIA.
        const enBd = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(enBd?.ultimaNotificacionHijosEn).not.toBeNull();
    });

    it("dos padres con el mismo menor (D-4): CADA UNO recibe su aviso", async () => {
        const a = await padreConHijo("CuentaComun");
        const b = await padreConHijo("CuentaComun");
        const reporte = await crearReporte("CuentaComun");

        await notificarHijosSiCorresponde(reporte.id);

        expect(enviarMock).toHaveBeenCalledTimes(2);
        const destinos = enviarMock.mock.calls.map((c) => c[0].destinatario.usuarioId).sort();
        expect(destinos).toEqual([a.padre.id, b.padre.id].sort());
    });

    it("un estado NO visible no avisa", async () => {
        await padreConHijo("Oculto1");
        const reporte = await crearReporte("Oculto1", "PENDIENTE");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).not.toHaveBeenCalled();
    });

    it("un hijo INACTIVO no dispara aviso", async () => {
        const { padre, hijoId } = await padreConHijo("Apagado1");
        await prisma.hijo.update({ where: { id: hijoId }, data: { estado: "inactivo" } });
        const reporte = await crearReporte("Apagado1");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).not.toHaveBeenCalled();
        expect(padre.id).toBeTruthy();
    });

    it("un identificador APAGADO no dispara aviso", async () => {
        const { hijoId } = await padreConHijo("CuentaOff");
        await prisma.identificadorHijo.updateMany({ where: { hijoId }, data: { activo: false } });
        const reporte = await crearReporte("CuentaOff");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).not.toHaveBeenCalled();
    });

    it("el interruptor del padre manda: notificacionesHijos=false no avisa", async () => {
        const { padre } = await padreConHijo("SinAvisos");
        await prisma.usuario.update({ where: { id: padre.id }, data: { notificacionesHijos: false } });
        const reporte = await crearReporte("SinAvisos");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).not.toHaveBeenCalled();
    });

    // La razón de las columnas propias, probada en las dos direcciones.
    it("INDEPENDENCIA 1: un aviso reciente del CÍRCULO no silencia el aviso del hijo", async () => {
        const { padre } = await padreConHijo("Indep1");
        // El padre acaba de recibir un aviso del círculo (marca del círculo fresca).
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { ultimaNotificacionCirculoEn: new Date() },
        });
        const reporte = await crearReporte("Indep1");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).toHaveBeenCalledOnce();
    });

    it("INDEPENDENCIA 2: apagar los avisos del CÍRCULO no apaga los del hijo", async () => {
        const { padre } = await padreConHijo("Indep2");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { notificacionesCirculo: false },
        });
        const reporte = await crearReporte("Indep2");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).toHaveBeenCalledOnce();
    });

    it("enfriamiento PROPIO: dos reportes seguidos = un solo aviso", async () => {
        await padreConHijo("Seguidos");
        const r1 = await crearReporte("Seguidos");
        await notificarHijosSiCorresponde(r1.id);
        const r2 = await crearReporte("Seguidos");
        await notificarHijosSiCorresponde(r2.id);
        expect(enviarMock).toHaveBeenCalledOnce();
    });

    it("el apagador global del ADMIN sí frena (freno de emergencia compartido)", async () => {
        await padreConHijo("Global1");
        await prisma.parametroSistema.update({
            where: { clave: "circulo.notificaciones.enabled" },
            data: { valor: "false" },
        });
        const reporte = await crearReporte("Global1");
        await notificarHijosSiCorresponde(reporte.id);
        expect(enviarMock).not.toHaveBeenCalled();
    });

    it("un fallo del correo NO revienta el flujo del worker", async () => {
        await padreConHijo("Fragil1");
        enviarMock.mockRejectedValueOnce(new Error("proveedor caído"));
        const reporte = await crearReporte("Fragil1");
        await expect(notificarHijosSiCorresponde(reporte.id)).resolves.toBeUndefined();
    });
});

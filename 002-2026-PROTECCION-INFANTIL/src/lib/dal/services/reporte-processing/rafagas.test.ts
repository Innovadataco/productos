/**
 * A-72 · La ráfaga cuenta por ORIGEN, no por la cuenta reportada.
 *
 * Se ejercen las llamadas reales: se crean reportes + su FuenteReporte (el origen)
 * tal como los deja el POST de /api/reportes, y se afirma cuándo `detectarRafaga`
 * marca `esRafaga`. Regla del brief: mismo nick + MISMO origen = ráfaga; mismo
 * nick + orígenes distintos = corroboración legítima, NO ráfaga.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma } from "@/lib/reporte-test-utils";
import { detectarRafaga } from "./rafagas";

let plataformaId = "";
let secuencia = 0;

async function crearReporte(identificador: string, origen: string | null, creadoEn?: Date) {
    secuencia += 1;
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: `texto ${secuencia}`,
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-U-${String(secuencia).padStart(3, "0")}`,
            estado: "PENDIENTE",
            ...(creadoEn ? { creadoEn } : {}),
        },
    });
    if (origen) {
        await prisma.fuenteReporte.create({
            data: {
                reporteId: reporte.id,
                ipHash: `ip-${origen}`,
                fingerprintHash: `fp-${origen}`,
                pesoAplicado: 1.0,
            },
        });
    }
    return reporte;
}

const PARAMS = { rafagaN: 3, rafagaHoras: 24 };

describe("detectarRafaga · por origen (A-72)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        plataformaId = plataforma!.id;
    });

    it("mismo nick + MISMO origen alcanzando el umbral = ráfaga, y marca todos", async () => {
        const nick = "+57300MISMO";
        const r1 = await crearReporte(nick, "spammer");
        const r2 = await crearReporte(nick, "spammer");
        const r3 = await crearReporte(nick, "spammer");

        const es = await detectarRafaga({ reporteId: r3.id, identificador: nick, plataformaId, ...PARAMS });

        expect(es).toBe(true);
        const marcados = await prisma.reporte.count({
            where: { id: { in: [r1.id, r2.id, r3.id] }, esRafaga: true },
        });
        expect(marcados).toBe(3);
    });

    it("mismo nick + ORÍGENES DISTINTOS = corroboración, NO es ráfaga", async () => {
        const nick = "+57300DISTINTO";
        await crearReporte(nick, "persona-1");
        await crearReporte(nick, "persona-2");
        const r3 = await crearReporte(nick, "persona-3");

        const es = await detectarRafaga({ reporteId: r3.id, identificador: nick, plataformaId, ...PARAMS });

        expect(es).toBe(false);
        const marcados = await prisma.reporte.count({ where: { identificador: nick, esRafaga: true } });
        expect(marcados).toBe(0);
    });

    it("sin origen conocido (sin FuenteReporte) NO marca ráfaga", async () => {
        const nick = "+57300SINORIGEN";
        await crearReporte(nick, null);
        await crearReporte(nick, null);
        const r3 = await crearReporte(nick, null);

        const es = await detectarRafaga({ reporteId: r3.id, identificador: nick, plataformaId, ...PARAMS });

        expect(es).toBe(false);
    });

    it("historial previo del mismo origen fuera de la ventana corta la ráfaga (relación sostenida)", async () => {
        const nick = "+57300SOSTENIDO";
        await crearReporte(nick, "fijo", new Date(Date.now() - 48 * 60 * 60 * 1000));
        await crearReporte(nick, "fijo");
        await crearReporte(nick, "fijo");
        const r4 = await crearReporte(nick, "fijo");

        const es = await detectarRafaga({ reporteId: r4.id, identificador: nick, plataformaId, ...PARAMS });

        expect(es).toBe(false);
    });
});

/**
 * F3 (N-5): consulta inteligente vacía — bloque curado en la respuesta y
 * evento analítico CONSULTA_SIN_RESULTADOS SIN el identificador (privacidad).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearParametrosReportes } from "@/lib/reporte-test-utils";

const SENALES_F3 = [
    "Pide mantener la conversación en secreto",
    "Solicita fotos o videos íntimos",
    "Ofrece regalos, dinero o recargas a cambio de algo",
    "Propone encontrarse a solas",
    "Dice ser menor de edad pero no lo parece",
];

async function sembrarParamsF3() {
    const params = [
        { clave: "consulta.vacia.disclaimer", valor: JSON.stringify("Que no haya reportes no significa que sea seguro.") },
        { clave: "consulta.vacia.senales", valor: JSON.stringify(SENALES_F3) },
        { clave: "consulta.vacia.acciones", valor: JSON.stringify(["Habla sin juzgar", "Guarda evidencia", "Canales oficiales"]) },
    ];
    for (const p of params) {
        await prisma.parametroSistema.create({
            data: { clave: p.clave, valor: p.valor, tipo: "JSON", categoria: "SYSTEM", esPublico: false },
        });
    }
}

async function crearReporteVisible(identificador: string, plataformaId: string) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba para consulta pública F3.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            numeroSeguimiento: `RPT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
            estado: "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.8,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
}

describe("GET /api/consulta (F3: consulta vacía)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await sembrarParamsF3();
    });

    it("consulta vacía: incluye bloqueVacia curado y registra el evento SIN el identificador", async () => {
        const identificador = "+57300999000";
        const req = new Request(`http://localhost:5005/api/consulta?identificador=${encodeURIComponent(identificador)}`);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.tieneReportes).toBe(false);
        expect(body.bloqueVacia).toBeDefined();
        expect(body.bloqueVacia.disclaimer).toContain("no significa que sea seguro");
        expect(body.bloqueVacia.senales).toHaveLength(5);
        expect(body.bloqueVacia.acciones).toHaveLength(3);

        const evento = await prisma.auditLog.findFirst({
            where: { accion: "CONSULTA_SIN_RESULTADOS", tipoRecurso: "consulta_publica" },
        });
        expect(evento).not.toBeNull();
        // Guard de privacidad: los metadatos llevan el tipo por formato, NUNCA el valor.
        const metadatos = JSON.stringify(evento!.metadatos);
        expect(metadatos).toContain('"telefono"');
        expect(metadatos).not.toContain(identificador);
        expect(metadatos).not.toContain("300999000");
    });

    it("consulta vacía de un nick: tipoIdentificador=nick en los metadatos", async () => {
        const req = new Request(`http://localhost:5005/api/consulta?identificador=${encodeURIComponent("@sospechoso")}`);
        const res = await GET(req);
        expect(res.status).toBe(200);

        const evento = await prisma.auditLog.findFirst({ where: { accion: "CONSULTA_SIN_RESULTADOS" } });
        expect(JSON.stringify(evento!.metadatos)).toContain('"nick"');
        expect(JSON.stringify(evento!.metadatos)).not.toContain("sospechoso");
    });

    it("consulta con reportes: sin bloqueVacia y sin evento analítico", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        await crearReporteVisible("+57300CONREP", plataforma!.id);

        const req = new Request(`http://localhost:5005/api/consulta?identificador=${encodeURIComponent("+57300CONREP")}`);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.tieneReportes).toBe(true);
        expect(body.bloqueVacia).toBeUndefined();
        expect(await prisma.auditLog.count({ where: { accion: "CONSULTA_SIN_RESULTADOS" } })).toBe(0);
    });

    it("degradación limpia: sin los parámetros no hay bloqueVacia pero sí evento", async () => {
        await prisma.parametroSistema.deleteMany({ where: { clave: { startsWith: "consulta.vacia." } } });

        const req = new Request(`http://localhost:5005/api/consulta?identificador=${encodeURIComponent("+57300888777")}`);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.tieneReportes).toBe(false);
        expect(body.bloqueVacia).toBeUndefined();
        expect(await prisma.auditLog.count({ where: { accion: "CONSULTA_SIN_RESULTADOS" } })).toBe(1);
    });
});

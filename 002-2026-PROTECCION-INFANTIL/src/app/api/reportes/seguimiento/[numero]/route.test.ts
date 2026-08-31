import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearParametrosReportes,
    crearPlataforma,
    crearPaisCiudad,
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import type { EstadoReporte } from "@prisma/client";

async function crearReporteBase(
    numeroSeguimiento: string,
    identificador: string,
    estado: EstadoReporte = "PENDIENTE",
    eliminado = false
) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para seguimiento.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: usuario.id,
            numeroSeguimiento,
            estado,
            eliminado,
        },
    });
}

async function crearReporteClasificadoVisible(numeroSeguimiento: string, identificador: string) {
    const reporte = await crearReporteBase(numeroSeguimiento, identificador, "CLASIFICADO");
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.92,
            contienePii: true,
            piiDetectada: ["María"],
            categoriasSecundarias: [{ categoria: "CONTACTO_INSISTENTE" }],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
        },
    });
    await prisma.identificadorReportado.upsert({
        where: { identificador_plataformaId: { identificador, plataformaId: reporte.plataformaId } },
        update: { totalReportes: 1, reportesAutenticados: 1, reportesAnonimos: 0, esVisiblePublicamente: true },
        create: {
            identificador,
            plataformaId: reporte.plataformaId,
            totalReportes: 1,
            reportesAutenticados: 1,
            reportesAnonimos: 0,
            esVisiblePublicamente: true,
        },
    });
    return reporte;
}

describe("GET /api/reportes/seguimiento/[numero]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve 404 si el número no existe", async () => {
        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-NOEXIS"),
            { params: Promise.resolve({ numero: "RPT-NOEXIS" }) }
        );
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.message).toBe("Número de seguimiento no encontrado");
    });

    it("mapea PENDIENTE a 'En proceso' con mensaje de SLA", async () => {
        await crearReporteBase("RPT-PEND01", "+57300PEND", "PENDIENTE");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-PEND01"),
            { params: Promise.resolve({ numero: "RPT-PEND01" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.estadoVisual).toBe("En proceso");
        expect(body.estadoInterno).toBe("PENDIENTE");
        expect(body.enProceso).toBe(true);
        expect(body.badge).toBe("warning");
        expect(body.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 24 horas");
        expect(body.slaHoras).toBe(24);
        expect(body.clasificacion).toBeNull();
    });

    it("mapea CLASIFICADO a 'Procesado' sin SLA", async () => {
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.report_threshold" }, data: { valor: "1" } });
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.min_authenticated_ratio" }, data: { valor: "0" } });

        await crearReporteClasificadoVisible("RPT-CLASIF", "+57300CLASIF");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-CLASIF"),
            { params: Promise.resolve({ numero: "RPT-CLASIF" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.estadoVisual).toBe("Procesado");
        expect(body.estadoInterno).toBe("CLASIFICADO");
        expect(body.enProceso).toBe(false);
        expect(body.badge).toBe("success");
        expect(body.mensaje).toBe("Tu reporte ha sido procesado y clasificado.");
        expect(body.slaHoras).toBe(24);
        expect(body.clasificacion).not.toBeNull();
        expect(body.clasificacion.confianza).toBeUndefined();
        expect(body.clasificacion.categoriasSecundarias).toEqual(["CONTACTO_INSISTENTE"]);
        expect(body.ranking).not.toBeNull();
    });

    it("no expone piiDetectada en la respuesta y sí contienePii (I-28)", async () => {
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.report_threshold" }, data: { valor: "1" } });
        await prisma.parametroSistema.updateMany({ where: { clave: "visibility.min_authenticated_ratio" }, data: { valor: "0" } });

        await crearReporteClasificadoVisible("RPT-NOPII1", "+57300NOPII");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-NOPII1"),
            { params: Promise.resolve({ numero: "RPT-NOPII1" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.clasificacion).not.toBeNull();
        expect(body.clasificacion.contienePii).toBe(true);
        // La PII cruda del menor nunca debe salir por el endpoint público,
        // ni como campo de clasificacion ni en ningún otro nivel de la respuesta.
        const serializado = JSON.stringify(body);
        expect(serializado).not.toContain("piiDetectada");
        expect(serializado).not.toContain("María");
    });

    it("mapea DUPLICADO a 'Procesado' con badge muted", async () => {
        await crearReporteBase("RPT-DUPLIC", "+57300DUP", "DUPLICADO");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-DUPLIC"),
            { params: Promise.resolve({ numero: "RPT-DUPLIC" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();

        expect(body.estadoVisual).toBe("En proceso");
        expect(body.estadoInterno).toBe("DUPLICADO");
        expect(body.badge).toBe("warning");
        expect(body.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 24 horas");
        expect(body.clasificacion).toBeNull();
    });

    it("devuelve 404 para reporte eliminado", async () => {
        await crearReporteBase("RPT-BAJA12", "+57300BAJA", "PENDIENTE", true);

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-BAJA12"),
            { params: Promise.resolve({ numero: "RPT-BAJA12" }) }
        );
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error.message).toBe("Número de seguimiento no encontrado");
    });

    it("muestra el nombre personalizado cuando la plataforma es 'otro'", async () => {
        const plataformaOtro = await prisma.plataforma.upsert({
            where: { clave: "otro" },
            update: {},
            create: { clave: "otro", nombre: "Otra plataforma", categoria: "otro" },
        });
        const usuario = await crearUsuario("PARENT");
        await prisma.reporte.create({
            data: {
                identificador: "+57300OTRO",
                plataformaId: plataformaOtro.id,
                otraPlataforma: "Discord",
                texto: "Texto de prueba.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                usuarioId: usuario.id,
                numeroSeguimiento: "RPT-OTRO01",
                estado: "PENDIENTE",
            },
        });

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-OTRO01"),
            { params: Promise.resolve({ numero: "RPT-OTRO01" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.plataforma).toBe("Discord");
        expect(body.plataforma).not.toContain("undefined");
    });

    it("refleja cambios en ui.sla_horas_procesamiento", async () => {
        await prisma.parametroSistema.updateMany({
            where: { clave: "ui.sla_horas_procesamiento" },
            data: { valor: "48" },
        });
        await crearReporteBase("RPT-SLA480", "+57300SLA48", "PENDIENTE");

        const res = await GET(
            new Request("http://localhost:5005/api/reportes/seguimiento/RPT-SLA480"),
            { params: Promise.resolve({ numero: "RPT-SLA480" }) }
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.slaHoras).toBe(48);
        expect(body.mensaje).toBe("Tu reporte está en proceso — puede tardar hasta 48 horas");
    });

    describe("otros reportes del mismo identificador (SPEC-324)", () => {
        /** Segundo reporte APROBADO del mismo par (identificador, plataforma), de OTRO padre. */
        async function crearReporteAjenoAprobado(identificador: string, texto: string) {
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const otroPadre = await crearUsuario("PARENT");
            const ajeno = await prisma.reporte.create({
                data: {
                    identificador,
                    plataformaId: plataforma!.id,
                    texto,
                    fechaIncidente: new Date("2026-07-12T10:00:00Z"),
                    ciudad: "Medellín",
                    pais: "Colombia",
                    esAnonimo: false,
                    usuarioId: otroPadre.id,
                    numeroSeguimiento: "RPT-AJENO1",
                    estado: "CLASIFICADO",
                },
            });
            await prisma.clasificacionIA.create({
                data: {
                    reporteId: ajeno.id,
                    categoria: "SOLICITUD_ENCUENTRO",
                    confianza: 0.9,
                    contienePii: false,
                    piiDetectada: [],
                    categoriasSecundarias: [],
                    modeloUsado: "ornith:9b",
                    latenciaMs: 900,
                },
            });
            return { ajeno, otroPadre };
        }

        beforeEach(async () => {
            await prisma.parametroSistema.updateMany({ where: { clave: "visibility.report_threshold" }, data: { valor: "1" } });
            await prisma.parametroSistema.updateMany({ where: { clave: "visibility.min_authenticated_ratio" }, data: { valor: "0" } });
        });

        it("el visitante ANÓNIMO no ve la lista: su pantalla es la de siempre", async () => {
            await crearReporteClasificadoVisible("RPT-ANON01", "+57300OTROS");
            await crearReporteAjenoAprobado("+57300OTROS", "El otro padre escribió esto.");

            const res = await GET(
                new Request("http://localhost:5005/api/reportes/seguimiento/RPT-ANON01"),
                { params: Promise.resolve({ numero: "RPT-ANON01" }) }
            );
            expect(res.status).toBe(200);
            const body = await res.json();
            // null, no []: el anónimo ni siquiera sabe que el bloque existe.
            expect(body.otrosReportes).toBeNull();
            expect(body.ranking).not.toBeNull(); // lo de antes sigue igual
        });

        it("el autenticado ve fecha, país, ciudad y clasificación — y NADA del otro padre", async () => {
            const propio = await crearReporteClasificadoVisible("RPT-AUTEN1", "+57300OTROS");
            const { ajeno, otroPadre } = await crearReporteAjenoAprobado("+57300OTROS", "Texto secreto del otro padre.");

            const consultante = await crearUsuario("PARENT");
            const token = await crearTokenUsuario(consultante.id, "PARENT");
            const res = await GET(
                crearRequestAutenticado("GET", "http://localhost:5005/api/reportes/seguimiento/RPT-AUTEN1", null, token),
                { params: Promise.resolve({ numero: "RPT-AUTEN1" }) }
            );
            expect(res.status).toBe(200);
            const body = await res.json();

            expect(body.otrosReportes).toHaveLength(1);
            const otro = body.otrosReportes[0];
            expect(otro.id).toBe(ajeno.id);
            expect(otro.pais).toBe("Colombia");
            expect(otro.ciudad).toBe("Medellín");
            expect(otro.categoriaLabel).toBeTruthy();
            expect(new Date(otro.creadoEn).toString()).not.toBe("Invalid Date");
            // El límite duro: SOLO esos 5 campos salen del backend.
            expect(Object.keys(otro).sort()).toEqual(["categoriaLabel", "ciudad", "creadoEn", "id", "pais"]);

            // Ley 1581: ni el texto ni el autor pueden aparecer en NINGÚN nivel del payload.
            const serializado = JSON.stringify(body);
            expect(serializado).not.toContain("Texto secreto del otro padre.");
            expect(serializado).not.toContain(otroPadre.id);
            expect(serializado).not.toContain(otroPadre.email);
            // Y el reporte que se está consultando no se cuenta a sí mismo.
            expect(otro.id).not.toBe(propio.id);
        });

        it("sin otros reportes aprobados la lista queda vacía, no ausente", async () => {
            await crearReporteClasificadoVisible("RPT-SOLO01", "+57300SOLO");

            const consultante = await crearUsuario("PARENT");
            const token = await crearTokenUsuario(consultante.id, "PARENT");
            const res = await GET(
                crearRequestAutenticado("GET", "http://localhost:5005/api/reportes/seguimiento/RPT-SOLO01", null, token),
                { params: Promise.resolve({ numero: "RPT-SOLO01" }) }
            );
            const body = await res.json();
            expect(body.otrosReportes).toEqual([]);
        });

        it("un identificador que aún NO es visible públicamente no abre la lista ni con sesión", async () => {
            const propio = await crearReporteClasificadoVisible("RPT-OCULT1", "+57300OCULT");
            await crearReporteAjenoAprobado("+57300OCULT", "Otro texto.");
            // El mismo portón que ya gobierna el ranking: si el identificador no
            // alcanzó el umbral de visibilidad, no hay nada que mostrar.
            await prisma.identificadorReportado.updateMany({
                where: { identificador: "+57300OCULT", plataformaId: propio.plataformaId },
                data: { esVisiblePublicamente: false },
            });

            const consultante = await crearUsuario("PARENT");
            const token = await crearTokenUsuario(consultante.id, "PARENT");
            const res = await GET(
                crearRequestAutenticado("GET", "http://localhost:5005/api/reportes/seguimiento/RPT-OCULT1", null, token),
                { params: Promise.resolve({ numero: "RPT-OCULT1" }) }
            );
            const body = await res.json();
            expect(body.otrosReportes).toBeNull();
            expect(body.ranking).toBeNull();
        });

        it("un reporte ajeno SIN clasificar todavía no aparece (mismo criterio de 'aprobado')", async () => {
            await crearReporteClasificadoVisible("RPT-PEND99", "+57300PENDI");
            const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
            const otroPadre = await crearUsuario("PARENT");
            await prisma.reporte.create({
                data: {
                    identificador: "+57300PENDI",
                    plataformaId: plataforma!.id,
                    texto: "Aún sin clasificar.",
                    fechaIncidente: new Date("2026-07-12T10:00:00Z"),
                    ciudad: "Cali",
                    pais: "Colombia",
                    esAnonimo: true,
                    usuarioId: otroPadre.id,
                    numeroSeguimiento: "RPT-PEND98",
                    estado: "PENDIENTE",
                },
            });

            const consultante = await crearUsuario("PARENT");
            const token = await crearTokenUsuario(consultante.id, "PARENT");
            const res = await GET(
                crearRequestAutenticado("GET", "http://localhost:5005/api/reportes/seguimiento/RPT-PEND99", null, token),
                { params: Promise.resolve({ numero: "RPT-PEND99" }) }
            );
            const body = await res.json();
            expect(body.otrosReportes).toEqual([]);
        });
    });
});

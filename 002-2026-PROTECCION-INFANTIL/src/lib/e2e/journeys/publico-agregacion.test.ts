/**
 * SPEC-114 · Journey público y agregación — la cara pública del producto:
 * consulta sin sesión y desde cada rol con el MISMO conteo; protocolo I-11 (un
 * identificador de pocos reportes y otro de varios reciben el mismo render); los
 * contadores cuadran con el umbral; SPAM y OTRO no suman (D-08); y la API pública
 * no expone score ni nivel de riesgo en ningún nivel (D-10/§1.3/§1.5).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo, sembrarBancoCiclo } from "../seed-ciclo";
import { entrarComo } from "../helpers";
import { actualizarVisibilidadPublica } from "@/lib/visibility";
import type { RolUsuario } from "@prisma/client";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

interface RespuestaConsulta {
    identificador: string;
    tieneReportes: boolean;
    visibleEnDashboard?: boolean;
    totalReportes?: number;
    autenticado?: boolean;
    resumen?: string;
    timeline?: unknown;
}

async function consultar(identificador: string, token?: string): Promise<RespuestaConsulta> {
    const { POST: consultaPOST } = await import("@/app/api/consulta/route");
    const res = await consultaPOST(
        new Request("http://localhost:5005/api/consulta", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { cookie: `token=${token}` } : {}),
            },
            body: JSON.stringify({ identificador }),
        })
    );
    expect(res.status, "la consulta pública debe responder 200").toBe(200);
    return (await res.json()) as RespuestaConsulta;
}

/** Recorre el JSON y falla si aparece una clave de score/riesgo en cualquier nivel. */
function exigirSinScoreNiRiesgo(valor: unknown, ruta = "raíz") {
    if (Array.isArray(valor)) {
        for (const [i, item] of valor.entries()) exigirSinScoreNiRiesgo(item, `${ruta}[${i}]`);
        return;
    }
    if (valor && typeof valor === "object") {
        for (const [clave, v] of Object.entries(valor)) {
            expect(clave.toLowerCase(), `clave prohibida en ${ruta}: ${clave}`).not.toMatch(/score|riesgo/);
            exigirSinScoreNiRiesgo(v, `${ruta}.${clave}`);
        }
    }
}

describe(`SPEC-114 · público y agregación (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    it("I-11: el identificador de pocos reportes y el de varios reciben el mismo render", async () => {
        const datos = datosCiclo(CICLO);
        await sembrarBancoCiclo(datos);

        const pocos = await consultar(datos.identificadorPocos);
        const varios = await consultar(datos.identificadorVarios);

        // Mismo render: misma forma de respuesta, lenguaje descriptivo, sin excepciones
        for (const [nombre, r] of [["pocos", pocos], ["varios", varios]] as const) {
            expect(r.tieneReportes, `${nombre}: tiene reportes`).toBe(true);
            expect(r.autenticado, `${nombre}: anónimo`).toBe(false);
            expect(r.resumen, `${nombre}: el detalle es solo para autenticados`).toBeUndefined();
        }
        expect(pocos.totalReportes).toBe(1);
        expect(varios.totalReportes).toBe(4);
        // El umbral gobierna el LISTADO del dashboard, nunca la consulta directa (US5)
        expect(pocos.visibleEnDashboard, "pocos reportes: no listado en dashboard").toBe(false);
        expect(varios.visibleEnDashboard, "varios reportes con ratio suficiente: listado").toBe(true);
        exigirSinScoreNiRiesgo(pocos, "consulta-pocos");
        exigirSinScoreNiRiesgo(varios, "consulta-varios");
    });

    it("la consulta da el mismo conteo sin sesión y desde cada rol", async () => {
        const datos = datosCiclo(CICLO);
        await sembrarBancoCiclo(datos);
        const anonima = await consultar(datos.identificadorVarios);

        const roles: [RolUsuario, string][] = [
            ["PARENT", `e2e-c${CICLO}-pub-padre@test.local`],
            ["ADMIN", `e2e-c${CICLO}-pub-admin@test.local`],
            ["OPERADOR", `e2e-c${CICLO}-pub-op@test.local`],
            ["COMITE_VALIDACION", `e2e-c${CICLO}-pub-comite@test.local`],
        ];
        for (const [rol, email] of roles) {
            const sesion = await entrarComo(rol, email, "ClaveE2E-2026");
            const r = await consultar(datos.identificadorVarios, sesion.token);
            expect(r.totalReportes, `${rol}: el conteo público es el mismo que el anónimo`).toBe(anonima.totalReportes);
            expect(r.autenticado, `${rol}: con sesión se marca autenticado`).toBe(true);
            exigirSinScoreNiRiesgo(r, `consulta-${rol}`);
        }
    });

    it("SPAM y OTRO no suman en la consulta pública (D-08) y los contadores cuadran", async () => {
        const datos = datosCiclo(CICLO);
        await sembrarBancoCiclo(datos);
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });

        // Agregar un SPAM y un OTRO al mismo identificador común
        for (const categoria of ["SPAM", "OTRO"] as const) {
            const r = await prisma.reporte.create({
                data: {
                    identificador: datos.identificadorComun,
                    plataformaId: plataforma!.id,
                    texto: `${datos.textoBase} (${categoria})`,
                    fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: `RPT-C${CICLO}-${categoria}`,
                    estado: "CLASIFICADO",
                },
            });
            await prisma.clasificacionIA.create({
                data: {
                    reporteId: r.id,
                    categoria,
                    confianza: 0.9,
                    contienePii: false,
                    piiDetectada: [],
                    modeloUsado: "rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b",
                    latenciaMs: 1000,
                    categoriasSecundarias: [],
                },
            });
        }

        const r = await consultar(datos.identificadorComun);
        expect(r.totalReportes, "SPAM y OTRO no cuentan en el total público").toBe(datos.cantidadComunes);

        // §9 contadores: el agregado cuadra y el umbral se aplica igual que en la consulta
        const aprobados = await prisma.reporte.count({
            where: { identificador: datos.identificadorComun, estado: "CLASIFICADO", clasificacion: { is: { categoria: { notIn: ["SPAM", "OTRO"] } } } },
        });
        expect(aprobados).toBe(datos.cantidadComunes);

        const autenticados = Math.ceil(datos.cantidadComunes / 2); // seed: anónimo en i par
        const agregado = await prisma.identificadorReportado.create({
            data: {
                identificador: datos.identificadorComun,
                plataformaId: plataforma!.id,
                totalReportes: datos.cantidadComunes,
                reportesAutenticados: autenticados,
                reportesAnonimos: datos.cantidadComunes - autenticados,
                // SPEC-131 (BL-5): la visibilidad se decide con los contadores APROBADOS.
                reportesAprobados: datos.cantidadComunes,
                autenticadosAprobados: autenticados,
            },
        });
        await actualizarVisibilidadPublica(datos.identificadorComun, plataforma!.id);
        const actualizado = await prisma.identificadorReportado.findUnique({ where: { id: agregado.id } });
        expect(actualizado!.esVisiblePublicamente, "sobre umbral y con ratio suficiente: visible").toBe(true);

        // Bajo umbral: no visible aunque el ratio sea perfecto
        const pocos = await prisma.identificadorReportado.create({
            data: {
                identificador: datos.identificadorPocos,
                plataformaId: plataforma!.id,
                totalReportes: 1,
                reportesAutenticados: 1,
                reportesAnonimos: 0,
                // SPEC-131 (BL-5): 1 aprobado < umbral → no visible.
                reportesAprobados: 1,
                autenticadosAprobados: 1,
            },
        });
        await actualizarVisibilidadPublica(datos.identificadorPocos, plataforma!.id);
        const pocosActualizado = await prisma.identificadorReportado.findUnique({ where: { id: pocos.id } });
        expect(pocosActualizado!.esVisiblePublicamente, "bajo umbral: nunca visible").toBe(false);
    });

    it("las estadísticas públicas no traen score ni riesgo en ningún nivel (D-10)", async () => {
        const datos = datosCiclo(CICLO);
        await sembrarBancoCiclo(datos);
        const { GET: estadisticasGET } = await import("@/app/api/estadisticas-publicas/route");
        const res = await estadisticasGET();
        expect(res.status).toBe(200);
        const cuerpo = await res.json();
        exigirSinScoreNiRiesgo(cuerpo, "estadisticas-publicas");
        const { totales } = cuerpo as { totales: { reportes: number } };
        expect(totales.reportes, "cuadran con los reportes aprobados del banco").toBe(1 + 4 + datos.cantidadComunes);
    });
});

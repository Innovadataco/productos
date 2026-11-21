/**
 * SPEC-970 (Calidad) · JOURNEY — lo que el comité OCULTA no aparece en las superficies PÚBLICAS.
 * Pedido de Jelkin vía CEO (20-11, deploy d30b9735). Hermano e2e del candado de integración
 * `src/lib/consulta-oculto-por-comite.candado.test.ts` (SPEC-937, I-451), ejercido por HTTP real.
 *
 * QUÉ PROTEGE. Cuando el comité oculta un par (identificador, plataforma) —marca
 * `IdentificadorReportado.ocultoPorComiteEn` (SPEC-110)—, NINGUNA superficie pública puede seguir
 * mostrándolo. El defecto de origen (I-451): las lecturas públicas contaban los REPORTES por
 * identificador y nunca la marca, así que la consulta y el tablero seguían mostrando lo oculto.
 *
 * SUPERFICIES PÚBLICAS que camina, por sus endpoints reales (anónimo, HTTP):
 *   (1) `POST /api/consulta` → `tieneReportes` por identificador (determinista para MI par).
 *   (2) `GET /api/estadisticas-publicas` → `totales.reportes` y `totales.identificadoresUnicos`.
 *
 * CONTROL POSITIVO (para que el «oculto» no pase vacío). ANTES de ocultar, el par sembrado SÍ
 * aparece: la consulta da `tieneReportes=true` y las estadísticas suben +1 reporte y +1 identificador
 * único. DESPUÉS de poner la marca del comité, la consulta da `tieneReportes=false` y las estadísticas
 * vuelven EXACTAMENTE a la base. Es decir: «sin la marca SÍ aparece; con la marca NO».
 *
 * POR QUÉ EL DELTA DE ESTADÍSTICAS ES DETERMINISTA. El tablero público es un agregado GLOBAL; pero el
 * gate `journeys-e2e` corre con `workers: 1` (igual que el arnés local), así que NINGÚN otro test
 * escribe mientras este corre. El delta se mide alrededor de MI única transición (base → visible →
 * oculto), de modo que cualquier dato preexistente es CONSTANTE entre lecturas y se cancela.
 *
 * SEMBRADO (estado, no acción). El par se siembra con su agregado + un reporte APROBADO real
 * (`crearReporteFixture` + `ClasificacionIA`), y el OCULTAMIENTO se aplica poniendo `ocultoPorComiteEn`
 * (el estado que deja el comité). La ACCIÓN del comité que pone esa marca la cubre el candado de
 * SPEC-937; acá se certifica que las superficies PÚBLICAS honran la marca.
 *
 * AISLAMIENTO. Identificador ÚNICO por corrida (nunca pisa datos reales/seed). Limpieza FK-safe en
 * `afterAll`. Corre en el arnés (guardia SPEC-770: BD `*_test`); NUNCA contra prod.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { normalizarIdentificador } from "@/lib/dal/identificadores/normalizar";

const CORRIDA = randomUUID().slice(0, 8);
// Identificador único de la corrida: celular colombiano E.164 (+57 + 10 dígitos nacionales
// 3009XXXXXX), improbable de chocar con seed/real.
const IDENT = normalizarIdentificador(`+573009${(parseInt(CORRIDA, 16) % 1_000_000).toString().padStart(6, "0")}`);
const FECHA_INCIDENTE = new Date("2026-07-10T10:00:00Z");

type Limpieza = { reporteId: string; contenidoId: string | null; plataformaId: string };
const sembrados: Limpieza[] = [];

function baseURL(): string {
    return test.info().project.use.baseURL ?? "http://localhost:5005";
}

async function consultaTieneReportes(ctx: APIRequestContext, identificador: string): Promise<boolean> {
    const res = await ctx.post("/api/consulta", { data: { identificador } });
    expect(res.status(), `POST /api/consulta → 200 · body=${await res.text().catch(() => "")}`).toBe(200);
    return (await res.json()).tieneReportes === true;
}

async function estadisticas(ctx: APIRequestContext): Promise<{ reportes: number; identificadoresUnicos: number }> {
    const res = await ctx.get("/api/estadisticas-publicas");
    expect(res.status(), "GET /api/estadisticas-publicas → 200").toBe(200);
    const body = (await res.json()) as { totales: { reportes: number; identificadoresUnicos: number } };
    return { reportes: body.totales.reportes, identificadoresUnicos: body.totales.identificadoresUnicos };
}

test.describe.serial("SPEC-970 · journey: lo que el comité oculta no aparece en consulta ni estadísticas públicas", () => {
    test.afterAll(async () => {
        for (const s of sembrados) {
            await prisma.clasificacionIA.deleteMany({ where: { reporteId: s.reporteId } }).catch(() => undefined);
            await prisma.reporte.deleteMany({ where: { id: s.reporteId } }).catch(() => undefined);
            if (s.contenidoId) await prisma.contenidoReporte.deleteMany({ where: { id: s.contenidoId } }).catch(() => undefined);
        }
        await prisma.identificadorReportado
            .deleteMany({ where: { identificador: IDENT } })
            .catch(() => undefined);
        sembrados.length = 0;
    });

    test("sin la marca SÍ aparece (consulta + estadísticas); con la marca del comité, NO", async () => {
        test.setTimeout(120_000);
        const anonimo = await playwrightRequest.newContext({ baseURL: baseURL() });
        try {
            const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { clave: "whatsapp" }, select: { id: true } });

            // BASE: estadísticas antes de sembrar nada (ancla del delta).
            const base = await estadisticas(anonimo);
            expect(await consultaTieneReportes(anonimo, IDENT), "el par aún no existe → sin reportes").toBe(false);

            await test.step("1 · sembrar el par con un reporte APROBADO (visible) → control positivo: SÍ aparece", async () => {
                await prisma.identificadorReportado.create({
                    data: {
                        identificador: IDENT,
                        plataformaId: plataforma.id,
                        totalReportes: 1,
                        reportesAutenticados: 1,
                        reportesAprobados: 1,
                        autenticadosAprobados: 1,
                        esVisiblePublicamente: false,
                    },
                });
                const reporte = await crearReporteFixture(prisma, {
                    data: {
                        identificador: IDENT,
                        plataformaId: plataforma.id,
                        texto: `Texto anonimizado de prueba · corrida ${CORRIDA}.`,
                        fechaIncidente: FECHA_INCIDENTE,
                        ciudad: "Bogotá",
                        pais: "Colombia",
                        esAnonimo: false,
                        estado: "CLASIFICADO",
                        numeroSeguimiento: `RPT-970-${CORRIDA}`,
                    },
                });
                sembrados.push({ reporteId: reporte.id, contenidoId: reporte.contenidoId, plataformaId: plataforma.id });
                await prisma.clasificacionIA.create({
                    data: {
                        reporteId: reporte.id,
                        categoria: "CONTACTO_INSISTENTE",
                        confianza: 0.8,
                        contienePii: false,
                        piiDetectada: [],
                        modeloUsado: "ornith:9b",
                        latenciaMs: 1000,
                    },
                });

                expect(await consultaTieneReportes(anonimo, IDENT), "consulta: el par visible SÍ tiene reportes").toBe(true);
                const vis = await estadisticas(anonimo);
                expect(vis.reportes, "estadísticas: +1 reporte sobre la base").toBe(base.reportes + 1);
                expect(vis.identificadoresUnicos, "estadísticas: +1 identificador único sobre la base").toBe(
                    base.identificadoresUnicos + 1,
                );
            });

            await test.step("2 · el comité OCULTA el par (ocultoPorComiteEn) → NO aparece en ninguna superficie pública", async () => {
                await prisma.identificadorReportado.update({
                    where: { identificador_plataformaId: { identificador: IDENT, plataformaId: plataforma.id } },
                    data: { ocultoPorComiteEn: new Date() },
                });

                expect(await consultaTieneReportes(anonimo, IDENT), "consulta: el par oculto NO tiene reportes").toBe(false);
                const occ = await estadisticas(anonimo);
                expect(occ.reportes, "estadísticas: el reporte oculto deja de contar → vuelve a la base").toBe(base.reportes);
                expect(occ.identificadoresUnicos, "estadísticas: el identificador oculto deja de contar → vuelve a la base").toBe(
                    base.identificadoresUnicos,
                );
            });
        } finally {
            await anonimo.dispose();
        }
    });
});

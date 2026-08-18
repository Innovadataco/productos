import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { resetDatabase } from "@/lib/test-utils";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearColegioConAdmin, crearComiteCuenta, crearAlertaEstudiante } from "@/lib/comite-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const URL_ESTADISTICAS = "http://localhost:5005/api/colegio/comite/estadisticas";

function getEstadisticas() {
    return GET(new Request(URL_ESTADISTICAS, { headers: { cookie: `token=${mockToken}` } }));
}

async function crearSolicitudConCategoria(
    colegioId: string,
    creadoPorId: string,
    numero: string,
    estado: "PENDIENTE" | "RESUELTA",
    categoria: CategoriaConducta,
    fechas?: { creadoEn: Date; resueltoEn?: Date },
    opciones?: { vencimientoSla?: Date; sinAlerta?: boolean }
) {
    const { alerta, reporte } = await crearAlertaEstudiante(colegioId);
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria, confianza: 0.9, modeloUsado: "test", latenciaMs: 10 },
    });
    if (opciones?.vencimientoSla) {
        await prisma.alertaColegio.update({
            where: { id: alerta.id },
            data: { vencimientoSla: opciones.vencimientoSla },
        });
    }
    return prisma.solicitudComite.create({
        data: {
            reporteId: reporte.id,
            numero,
            estado,
            colegioId,
            ...(opciones?.sinAlerta ? {} : { alertaColegioId: alerta.id }),
            creadoPorId,
            motivo: "Escalamiento de prueba",
            ...(estado === "RESUELTA" ? { resolucion: "Caso cerrado en prueba" } : {}),
            ...(fechas
                ? { creadoEn: fechas.creadoEn, ...(fechas.resueltoEn ? { resueltoEn: fechas.resueltoEn } : {}) }
                : {}),
        },
    });
}

describe("/api/colegio/comite/estadisticas", () => {
    beforeAll(() => {
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    async function setupDosColegios() {
        const ahora = new Date();
        const haceDosDias = new Date(ahora.getTime() - 2 * 24 * 60 * 60 * 1000);

        const { admin: adminA, colegio: colegioA } = await crearColegioConAdmin();
        const comiteA = await crearComiteCuenta(colegioA.id);
        await crearSolicitudConCategoria(colegioA.id, adminA.id, "SOL-CC-A1", "PENDIENTE", "CONTACTO_INSISTENTE");
        await crearSolicitudConCategoria(colegioA.id, adminA.id, "SOL-CC-A2", "RESUELTA", "EXTORSION", {
            creadoEn: haceDosDias,
            resueltoEn: ahora,
        });

        const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();
        const comiteB = await crearComiteCuenta(colegioB.id);
        await crearSolicitudConCategoria(colegioB.id, adminB.id, "SOL-CC-B1", "PENDIENTE", "DOXING");

        return { adminA, colegioA, comiteA, adminB, colegioB, comiteB };
    }

    it("devuelve los agregados correctos del colegio del comité", async () => {
        const { comiteA } = await setupDosColegios();
        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

        const res = await getEstadisticas();

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.casosPorEstado).toEqual({ PENDIENTE: 1, RESUELTA: 1 });
        expect(data.tiempoMedioResolucionDias).toBeGreaterThan(1.9);
        expect(data.tiempoMedioResolucionDias).toBeLessThan(2.1);
        expect(data.topCategorias).toHaveLength(2);
        expect(data.topCategorias).toEqual(
            expect.arrayContaining([
                { categoria: "CONTACTO_INSISTENTE", total: 1 },
                { categoria: "EXTORSION", total: 1 },
            ])
        );
    });

    it("aísla los agregados por colegioId", async () => {
        const { comiteA, comiteB } = await setupDosColegios();

        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");
        const resA = await getEstadisticas();
        const dataA = await resA.json();
        expect(resA.status).toBe(200);
        expect(dataA.topCategorias.map((c: { categoria: string }) => c.categoria)).not.toContain("DOXING");
        const totalesA = Object.values(dataA.casosPorEstado as Record<string, number>);
        expect(totalesA.reduce((acc, n) => acc + n, 0)).toBe(2);

        mockToken = await crearTokenUsuario(comiteB.id, "COMITE_CONVIVENCIA");
        const resB = await getEstadisticas();
        const dataB = await resB.json();
        expect(resB.status).toBe(200);
        expect(dataB.casosPorEstado).toEqual({ PENDIENTE: 1 });
        expect(dataB.tiempoMedioResolucionDias).toBeNull();
        expect(dataB.topCategorias).toEqual([{ categoria: "DOXING", total: 1 }]);
    });

    it("no expone texto de reporte ni datos del denunciante", async () => {
        const { comiteA } = await setupDosColegios();
        mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

        const res = await getEstadisticas();

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(Object.keys(data).sort()).toEqual([
            "casosPorEstado",
            "distribucionEstado",
            "sla",
            "tendenciaSemanal",
            "tiempoMedioPorCategoria",
            "tiempoMedioResolucionDias",
            "topCategorias",
        ]);
        const crudo = JSON.stringify(data);
        expect(crudo).not.toContain("Escalamiento de prueba");
        expect(crudo).not.toContain("Reporte de prueba");
        expect(crudo).not.toContain("motivo");
        expect(crudo).not.toContain("resolucion");
        expect(crudo).not.toContain("texto");
    });

    it("rechaza sin autenticación (401)", async () => {
        const res = await GET(new Request(URL_ESTADISTICAS));
        expect(res.status).toBe(401);
    });

    it("rechaza rol PARENT (403)", async () => {
        await setupDosColegios();
        const parent = await prisma.usuario.create({
            data: {
                email: `parent-${Date.now()}@example.com`,
                nombre: "Padre de prueba",
                passwordHash: await hashPassword("TestPass123"),
                rol: "PARENT",
                estado: "activo",
            },
        });
        mockToken = await crearTokenUsuario(parent.id, "PARENT");

        const res = await getEstadisticas();
        expect(res.status).toBe(403);
    });

    it("rechaza rol SCHOOL_ADMIN (403)", async () => {
        const { adminA } = await setupDosColegios();
        mockToken = await crearTokenUsuario(adminA.id, "SCHOOL_ADMIN");

        const res = await getEstadisticas();
        expect(res.status).toBe(403);
    });

    // SPEC-177: bloques nuevos — tendencia semanal, SLA, tiempo medio por
    // categoría y distribución por estado. Todo agregado, cero PII.
    describe("bloques SPEC-177", () => {
        const DIA_MS = 24 * 60 * 60 * 1000;

        /** Misma convención del repositorio: lunes 00:00 America/Bogota (UTC-5 fijo) como instante UTC. */
        function lunesSemanaBogota(fecha: Date): Date {
            const relojBogota = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
            const desplazamiento = (relojBogota.getUTCDay() + 6) % 7; // lunes = 0
            return new Date(
                Date.UTC(relojBogota.getUTCFullYear(), relojBogota.getUTCMonth(), relojBogota.getUTCDate() - desplazamiento) +
                    5 * 60 * 60 * 1000
            );
        }

        function claveSemana(fecha: Date): string {
            return fecha.toISOString().slice(0, 10);
        }

        async function setupDosColegiosRicos() {
            const lunes = lunesSemanaBogota(new Date());
            const en = (dias: number) => new Date(lunes.getTime() + dias * DIA_MS);

            const { admin: adminA, colegio: colegioA } = await crearColegioConAdmin();
            const comiteA = await crearComiteCuenta(colegioA.id);

            // A1: pendiente con SLA ya vencido → vencido.
            await crearSolicitudConCategoria(
                colegioA.id, adminA.id, "SOL-177-A1", "PENDIENTE", "CONTACTO_INSISTENTE",
                { creadoEn: en(1) }, { vencimientoSla: en(-1) }
            );
            // A2: creado la semana pasada, resuelto esta semana a tiempo (7 días).
            await crearSolicitudConCategoria(
                colegioA.id, adminA.id, "SOL-177-A2", "RESUELTA", "EXTORSION",
                { creadoEn: en(-5), resueltoEn: en(2) }, { vencimientoSla: en(3) }
            );
            // A3: creado hace 3 semanas, resuelto hace 2, tarde (8 días).
            await crearSolicitudConCategoria(
                colegioA.id, adminA.id, "SOL-177-A3", "RESUELTA", "SOLICITUD_ENCUENTRO",
                { creadoEn: en(-21), resueltoEn: en(-13) }, { vencimientoSla: en(-14) }
            );
            // A4: resuelto sin alerta vinculada → sinSla (10 días), mismas semanas que A3.
            await crearSolicitudConCategoria(
                colegioA.id, adminA.id, "SOL-177-A4", "RESUELTA", "EXTORSION",
                { creadoEn: en(-21), resueltoEn: en(-11) }, { sinAlerta: true }
            );

            const { admin: adminB, colegio: colegioB } = await crearColegioConAdmin();
            const comiteB = await crearComiteCuenta(colegioB.id);
            // B1: resuelto a tiempo (1 día), esta semana.
            await crearSolicitudConCategoria(
                colegioB.id, adminB.id, "SOL-177-B1", "RESUELTA", "DOXING",
                { creadoEn: en(1), resueltoEn: en(2) }, { vencimientoSla: en(3) }
            );

            return { comiteA, comiteB, lunes };
        }

        it("tendenciaSemanal: 8 semanas ordenadas con huecos en cero", async () => {
            const { comiteA, lunes } = await setupDosColegiosRicos();
            mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

            const res = await getEstadisticas();

            expect(res.status).toBe(200);
            const data = await res.json();
            type SemanaJson = { semanaInicio: string; creados: number; resueltos: number };
            const tendencia = data.tendenciaSemanal as SemanaJson[];
            expect(tendencia).toHaveLength(8);
            const inicios = tendencia.map((s) => s.semanaInicio);
            expect([...inicios].sort()).toEqual(inicios);

            const porSemana = new Map(tendencia.map((s) => [s.semanaInicio, s]));
            const semana = (semanasAtras: number) => claveSemana(new Date(lunes.getTime() - semanasAtras * 7 * DIA_MS));
            expect(porSemana.get(semana(0))).toMatchObject({ creados: 1, resueltos: 1 });
            expect(porSemana.get(semana(1))).toMatchObject({ creados: 1, resueltos: 0 });
            expect(porSemana.get(semana(2))).toMatchObject({ creados: 0, resueltos: 2 });
            expect(porSemana.get(semana(3))).toMatchObject({ creados: 2, resueltos: 0 });
            // Continuidad del eje: las 4 semanas más viejas van en cero.
            for (const atras of [4, 5, 6, 7]) {
                expect(porSemana.get(semana(atras))).toEqual({ semanaInicio: semana(atras), creados: 0, resueltos: 0 });
            }
        });

        it("sla: a tiempo, vencidos, sin SLA y porcentaje", async () => {
            const { comiteA } = await setupDosColegiosRicos();
            mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

            const res = await getEstadisticas();

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.sla).toEqual({ aTiempo: 1, vencidos: 2, sinSla: 1, pctATiempo: 33 });
        });

        it("tiempoMedioPorCategoria: días promedio y conteo por categoría", async () => {
            const { comiteA } = await setupDosColegiosRicos();
            mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

            const res = await getEstadisticas();

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.tiempoMedioPorCategoria).toEqual([
                { categoria: "EXTORSION", dias: 8.5, resueltos: 2 },
                { categoria: "SOLICITUD_ENCUENTRO", dias: 8, resueltos: 1 },
            ]);
        });

        it("distribucionEstado: porcentajes sobre el total de casos", async () => {
            const { comiteA } = await setupDosColegiosRicos();
            mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");

            const res = await getEstadisticas();

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.distribucionEstado).toEqual([
                { estado: "RESUELTA", total: 3, pct: 75 },
                { estado: "PENDIENTE", total: 1, pct: 25 },
            ]);
            // Las claves viejas siguen intactas (contrato aditivo).
            expect(data.casosPorEstado).toEqual({ PENDIENTE: 1, RESUELTA: 3 });
        });

        it("aisla los bloques nuevos por colegio", async () => {
            const { comiteA, comiteB, lunes } = await setupDosColegiosRicos();

            mockToken = await crearTokenUsuario(comiteA.id, "COMITE_CONVIVENCIA");
            const dataA = await (await getEstadisticas()).json();
            expect(dataA.sla).toEqual({ aTiempo: 1, vencidos: 2, sinSla: 1, pctATiempo: 33 });
            expect(
                (dataA.tiempoMedioPorCategoria as { categoria: string }[]).map((f) => f.categoria)
            ).not.toContain("DOXING");

            mockToken = await crearTokenUsuario(comiteB.id, "COMITE_CONVIVENCIA");
            const dataB = await (await getEstadisticas()).json();
            expect(dataB.sla).toEqual({ aTiempo: 1, vencidos: 0, sinSla: 0, pctATiempo: 100 });
            expect(dataB.tiempoMedioPorCategoria).toEqual([{ categoria: "DOXING", dias: 1, resueltos: 1 }]);
            expect(dataB.distribucionEstado).toEqual([{ estado: "RESUELTA", total: 1, pct: 100 }]);
            type SemanaJson = { semanaInicio: string; creados: number; resueltos: number };
            const tendenciaB = dataB.tendenciaSemanal as SemanaJson[];
            expect(tendenciaB).toHaveLength(8);
            expect(tendenciaB.reduce((acc, s) => acc + s.creados, 0)).toBe(1);
            const actualB = tendenciaB.find((s) => s.semanaInicio === claveSemana(lunes));
            expect(actualB).toMatchObject({ creados: 1, resueltos: 1 });
        });

        it("colegio sin casos: bloques en cero / null sin romperse", async () => {
            const { colegio } = await crearColegioConAdmin();
            const comite = await crearComiteCuenta(colegio.id);
            mockToken = await crearTokenUsuario(comite.id, "COMITE_CONVIVENCIA");

            const res = await getEstadisticas();

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.sla).toEqual({ aTiempo: 0, vencidos: 0, sinSla: 0, pctATiempo: null });
            expect(data.tiempoMedioPorCategoria).toEqual([]);
            expect(data.distribucionEstado).toEqual([]);
            expect(data.tendenciaSemanal).toHaveLength(8);
            expect(
                (data.tendenciaSemanal as { creados: number; resueltos: number }[]).every(
                    (s) => s.creados === 0 && s.resueltos === 0
                )
            ).toBe(true);
        });
    });
});

/**
 * SPEC-142 (F6): agregación y lectura de patrones institucionales.
 * Cubre SC-001 (aprobado agrega, no aprobado no, idempotencia), SC-002 (reversa
 * exacta directa y vía baja del lifecycle), cross-tenant, k=3 en TODOS los
 * desgloses (ZEUS D-2) y tendencia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearColegioConAdmin,
    crearCurso,
    crearAlumno,
    crearIdentificadorAlumno,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
    crearUsuario,
} from "@/lib/reporte-test-utils";
import { darDeBajaReporte } from "@/lib/dal/services/reporte-lifecycle";
import { PatronInstitucionalRepository } from "@/lib/dal/repositories/patron-institucional";
import {
    agregarPatronPorReporte,
    revertirPatronPorReporte,
    obtenerPatronesColegio,
    periodoTrimestre,
    periodoAnteriorTrimestre,
    SIN_GRADO_REGISTRADO,
} from "./patrones";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

const TAG = Math.random().toString(36).slice(2, 8);
let correlativo = 0;
const PERIODO_ACTUAL = periodoTrimestre(new Date());

async function sembrarColegioConVinculo(grado: string | null, valorIdentificador: string) {
    const { colegio, admin } = await crearColegioConAdmin();
    const curso = await crearCurso(colegio.id, { nombre: `Curso-${TAG}-${correlativo}`, ...(grado !== null ? { grado } : {}) });
    const alumno = await crearAlumno(curso.id, colegio.id);
    const vinculo = await crearIdentificadorAlumno(alumno.id, { valor: valorIdentificador });
    return { colegio, admin, curso, alumno, vinculo };
}

async function crearReportePara(
    identificador: string,
    plataformaId: string,
    opciones: { categoria?: CategoriaConducta; estado?: EstadoReporte } = {}
) {
    correlativo += 1;
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba de patrones institucionales con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-${TAG}-${correlativo}`,
            estado: opciones.estado ?? "CLASIFICADO",
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: opciones.categoria ?? "EXTORSION",
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 100,
        },
    });
    return reporte;
}

async function patronesDe(colegioId: string) {
    return new PatronInstitucionalRepository().findPorPeriodo(colegioId, PERIODO_ACTUAL);
}

describe("agregarPatronPorReporte (SPEC-142, F6)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
        await crearParametrosReportes();
    });

    it("SC-001: reporte aprobado con alerta → fila agregada conteo 1 y marcador (sin PII)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio, vinculo } = await sembrarColegioConVinculo("7", `+57331${TAG}`);
        const reporte = await crearReportePara(`+57331${TAG}`, plataforma.id);
        const alerta = await prisma.alertaColegio.create({
            data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: vinculo.id },
        });

        await agregarPatronPorReporte(reporte.id);

        const filas = await patronesDe(colegio.id);
        expect(filas).toHaveLength(1);
        expect(filas[0]).toMatchObject({
            colegioId: colegio.id,
            periodo: PERIODO_ACTUAL,
            grado: "7",
            conducta: "EXTORSION",
            plataformaId: plataforma.id,
            conteo: 1,
        });
        // FR-002: la entidad NO tiene campos de PII por construcción.
        expect(Object.keys(filas[0])).not.toContain("identificador");
        expect(Object.keys(filas[0])).not.toContain("reporteId");
        const alertaMarcada = await prisma.alertaColegio.findUnique({ where: { id: alerta.id } });
        expect(alertaMarcada!.patronInstitucionalId).toBe(filas[0].id);
    });

    it("SC-001: SPAM, OTRO o REVISION_MANUAL NO agregan (puerta D-08, FR-005)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio, vinculo } = await sembrarColegioConVinculo("7", `+57332${TAG}`);
        for (const [idx, caso] of [
            { categoria: "SPAM" as CategoriaConducta },
            { categoria: "OTRO" as CategoriaConducta },
            { estado: "REVISION_MANUAL" as EstadoReporte },
        ].entries()) {
            const reporte = await crearReportePara(`+57332${TAG}`, plataforma.id, caso);
            await prisma.alertaColegio.create({
                data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: vinculo.id },
            });
            await agregarPatronPorReporte(reporte.id);
            expect(await patronesDe(colegio.id), `caso ${idx} no debe agregar`).toHaveLength(0);
        }
    });

    it("SC-001: reproceso del mismo reporte NO cuenta dos veces (idempotencia por marcador)", async () => {
        const plataforma = await crearPlataforma();
        const { colegio, vinculo } = await sembrarColegioConVinculo("7", `+57333${TAG}`);
        const reporte = await crearReportePara(`+57333${TAG}`, plataforma.id);
        await prisma.alertaColegio.create({
            data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: vinculo.id },
        });

        await agregarPatronPorReporte(reporte.id);
        await agregarPatronPorReporte(reporte.id);

        const filas = await patronesDe(colegio.id);
        expect(filas).toHaveLength(1);
        expect(filas[0].conteo).toBe(1);
    });

    it("cross-tenant: dos colegios con el mismo identificador acumulan cada uno en su agregado", async () => {
        const plataforma = await crearPlataforma();
        const valor = `+57334${TAG}`;
        const a = await sembrarColegioConVinculo("7", valor);
        const b = await sembrarColegioConVinculo("9", valor);
        const reporte = await crearReportePara(valor, plataforma.id);
        await prisma.alertaColegio.create({ data: { colegioId: a.colegio.id, reporteId: reporte.id, identificadorAlumnoId: a.vinculo.id } });
        await prisma.alertaColegio.create({ data: { colegioId: b.colegio.id, reporteId: reporte.id, identificadorAlumnoId: b.vinculo.id } });

        await agregarPatronPorReporte(reporte.id);

        expect((await patronesDe(a.colegio.id))[0]).toMatchObject({ grado: "7", conteo: 1 });
        expect((await patronesDe(b.colegio.id))[0]).toMatchObject({ grado: "9", conteo: 1 });
    });

    it("varios vínculos del mismo identificador en el MISMO colegio cuentan una vez (grado del más antiguo)", async () => {
        const plataforma = await crearPlataforma();
        const valor = `+57335${TAG}`;
        const { colegio } = await crearColegioConAdmin();
        const curso7 = await crearCurso(colegio.id, { grado: "7", nombre: `C7-${TAG}` });
        const curso9 = await crearCurso(colegio.id, { grado: "9", nombre: `C9-${TAG}` });
        const alumno1 = await crearAlumno(curso7.id, colegio.id);
        const alumno2 = await crearAlumno(curso9.id, colegio.id);
        const v1 = await crearIdentificadorAlumno(alumno1.id, { valor });
        const v2 = await crearIdentificadorAlumno(alumno2.id, { valor });
        const reporte = await crearReportePara(valor, plataforma.id);
        // v1 es el vínculo más antiguo (su alerta se crea primero).
        await prisma.alertaColegio.create({ data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: v1.id } });
        await prisma.alertaColegio.create({ data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: v2.id } });

        await agregarPatronPorReporte(reporte.id);

        const filas = await patronesDe(colegio.id);
        expect(filas).toHaveLength(1);
        expect(filas[0].grado).toBe("7");
        expect(filas[0].conteo).toBe(1);
    });

    it("curso sin grado agrega bajo el sentinel no nulo", async () => {
        const plataforma = await crearPlataforma();
        const { colegio, vinculo } = await sembrarColegioConVinculo(null, `+57336${TAG}`);
        const reporte = await crearReportePara(`+57336${TAG}`, plataforma.id);
        await prisma.alertaColegio.create({ data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: vinculo.id } });

        await agregarPatronPorReporte(reporte.id);

        expect((await patronesDe(colegio.id))[0].grado).toBe(SIN_GRADO_REGISTRADO);
    });

    it("SC-002: reversa exacta — decrementa (piso 0) y limpia el marcador", async () => {
        const plataforma = await crearPlataforma();
        const { colegio, vinculo } = await sembrarColegioConVinculo("7", `+57337${TAG}`);
        const reporte = await crearReportePara(`+57337${TAG}`, plataforma.id);
        const alerta = await prisma.alertaColegio.create({
            data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: vinculo.id },
        });
        await agregarPatronPorReporte(reporte.id);
        expect((await patronesDe(colegio.id))[0].conteo).toBe(1);

        await revertirPatronPorReporte(reporte.id);
        expect((await patronesDe(colegio.id))[0].conteo).toBe(0);
        expect((await prisma.alertaColegio.findUnique({ where: { id: alerta.id } }))!.patronInstitucionalId).toBeNull();

        // Segunda reversa: no baja de 0.
        await revertirPatronPorReporte(reporte.id);
        expect((await patronesDe(colegio.id))[0].conteo).toBe(0);
    });

    it("SC-002 (wiring): la baja vía darDeBajaReporte revierte el aporte", async () => {
        const plataforma = await crearPlataforma();
        const admin = await crearUsuario("ADMIN");
        const { colegio, vinculo } = await sembrarColegioConVinculo("7", `+57338${TAG}`);
        const reporte = await crearReportePara(`+57338${TAG}`, plataforma.id);
        await prisma.alertaColegio.create({ data: { colegioId: colegio.id, reporteId: reporte.id, identificadorAlumnoId: vinculo.id } });
        await agregarPatronPorReporte(reporte.id);
        expect((await patronesDe(colegio.id))[0].conteo).toBe(1);

        await darDeBajaReporte({ reporteId: reporte.id, motivo: "RETIRO_LIMPIEZA", nota: "baja de prueba F6", adminId: admin.id });

        expect((await patronesDe(colegio.id))[0].conteo).toBe(0);
    });
});

describe("obtenerPatronesColegio (k-anonimato ZEUS D-2: TODOS los desgloses)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("k=3: grado/conducta/plataforma con conteo <3 se suprimen; el total incluye todo", async () => {
        const { colegio } = await crearColegioConAdmin();
        const whatsapp = await crearPlataforma();
        const roblox = await prisma.plataforma.upsert({
            where: { clave: "roblox" },
            update: {},
            create: { clave: "roblox", nombre: "Roblox", categoria: "juegos" },
        });
        const repo = new PatronInstitucionalRepository();
        const up = (grado: string, conducta: CategoriaConducta, plataformaId: string, veces: number, periodo = PERIODO_ACTUAL) =>
            Promise.all(Array.from({ length: veces }, () => repo.upsertIncrementar(colegio.id, { periodo, grado, conducta, plataformaId })));

        await up("7", "EXTORSION", whatsapp.id, 3);
        await up("8", "EXTORSION", whatsapp.id, 2); // grado 8: <3 → suprimido
        await up("7", "DOXING", whatsapp.id, 2); // conducta DOXING: <3 → suprimida
        await up("7", "EXTORSION", roblox.id, 1); // plataforma Roblox: <3 → suprimida
        // Período anterior para la tendencia.
        const anterior = periodoAnteriorTrimestre(PERIODO_ACTUAL);
        await up("7", "EXTORSION", whatsapp.id, 4, anterior);

        const dto = await obtenerPatronesColegio(colegio.id, PERIODO_ACTUAL);

        expect(dto.total).toBe(8);
        expect(dto.k).toBe(3);
        expect(dto.porGrado).toEqual([{ clave: "7", conteo: 6 }]);
        expect(dto.gradosSuprimidos).toBe(true);
        expect(dto.porConducta).toEqual([{ clave: "EXTORSION", conteo: 6 }]);
        expect(dto.conductasSuprimidas).toBe(true);
        expect(dto.porPlataforma).toEqual([{ plataforma: "WhatsApp", conteo: 7 }]);
        expect(dto.plataformasSuprimidas).toBe(true);
        expect(dto.tendencia).toEqual({ periodoAnterior: anterior, totalAnterior: 4, variacion: 4 });
    });

    it("sin datos: estado vacío honesto (total 0, sin supresiones) y solo el colegio propio", async () => {
        const { colegio } = await crearColegioConAdmin();
        const { colegio: otro } = await crearColegioConAdmin();
        const plataforma = await crearPlataforma();
        await new PatronInstitucionalRepository().upsertIncrementar(otro.id, {
            periodo: PERIODO_ACTUAL,
            grado: "7",
            conducta: "EXTORSION",
            plataformaId: plataforma.id,
        });

        const dto = await obtenerPatronesColegio(colegio.id, PERIODO_ACTUAL);
        expect(dto.total).toBe(0);
        expect(dto.porGrado).toEqual([]);
        expect(dto.gradosSuprimidos).toBe(false);
    });
});

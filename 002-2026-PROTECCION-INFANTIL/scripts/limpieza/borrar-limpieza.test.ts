/**
 * 002-PI-232 (A-65 · I-225): borrado FK-safe de Expediente/EventoExpediente.
 *
 * Tests unitarios sin BD — pasan un fake PrismaClient como opts.client.
 * NO usan vi.mock("@/lib/prisma") ni vi.spyOn(prisma, ...) — permitidos por
 * no-prisma-mocks porque no interceptan el singleton real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

// ── helpers ──────────────────────────────────────────────────────────────────

type AnyFn = ReturnType<typeof vi.fn>;

interface FakeModels {
    reporte: { findUnique: AnyFn; delete: AnyFn; findMany: AnyFn };
    eventoExpediente: { count: AnyFn; updateMany: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    solicitudComite: { count: AnyFn; deleteMany: AnyFn };
    correccionAdmin: { count: AnyFn; deleteMany: AnyFn };
    eventoMatch: { count: AnyFn; deleteMany: AnyFn };
    identificadorReportado: { findMany: AnyFn; delete: AnyFn };
    expediente: { findMany: AnyFn; updateMany: AnyFn; deleteMany: AnyFn };
    aclaracionExpediente: { deleteMany: AnyFn };
    informeConsolidado: { deleteMany: AnyFn };
    patronExpediente: { deleteMany: AnyFn };
    usuario: { findUnique: AnyFn; delete: AnyFn };
    contactoConfianza: { count: AnyFn; deleteMany: AnyFn };
    codigoVerificacion: { count: AnyFn; deleteMany: AnyFn };
    tokenRecuperacion: { count: AnyFn; deleteMany: AnyFn };
    suscripcion: { count: AnyFn; deleteMany: AnyFn };
    auditLog: { create: AnyFn };
    colegio: { findUnique: AnyFn; delete: AnyFn };
    tenant: { delete: AnyFn };
    alertaColegio: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    seguimientoCaso: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    notaSeguimiento: { count: AnyFn; deleteMany: AnyFn };
    // SPEC-351: InformeCaso sin Cascade — la limpieza lo borra explícito.
    informeCaso: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    integranteComite: { count: AnyFn; deleteMany: AnyFn };
    cursoMateria: { count: AnyFn; deleteMany: AnyFn };
    materia: { count: AnyFn; deleteMany: AnyFn };
    estudiante: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    profesor: { count: AnyFn; deleteMany: AnyFn };
    curso: { count: AnyFn; deleteMany: AnyFn };
    patronInstitucional: { count: AnyFn; deleteMany: AnyFn };
    cargaRosterSesion: { count: AnyFn; deleteMany: AnyFn };
    notificacionInApp: { count: AnyFn; deleteMany: AnyFn };
    preferenciaAlertaColegio: { count: AnyFn; deleteMany: AnyFn };
    registroAvisoColegio: { count: AnyFn; deleteMany: AnyFn };
    onboardingColegio: { count: AnyFn; deleteMany: AnyFn };
    // A-66: 6 modelos del subárbol de A-58
    identificadorProfesor: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    identificadorEstudiante: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    identificadorAcudiente: { count: AnyFn; deleteMany: AnyFn; findMany: AnyFn };
    estudianteObservacion: { count: AnyFn; deleteMany: AnyFn };
    acudienteEstudiante: { count: AnyFn; deleteMany: AnyFn };
}

function makeModel(extra: Record<string, AnyFn> = {}) {
    return {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        delete: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockResolvedValue({}),
        ...extra,
    };
}

function makeFakeClient(): { client: PrismaClient; tx: FakeModels } {
    const tx: FakeModels = {
        reporte: makeModel(),
        eventoExpediente: makeModel(),
        solicitudComite: makeModel(),
        correccionAdmin: makeModel(),
        eventoMatch: makeModel(),
        identificadorReportado: makeModel(),
        expediente: makeModel(),
        aclaracionExpediente: makeModel(),
        informeConsolidado: makeModel(),
        patronExpediente: makeModel(),
        usuario: makeModel(),
        contactoConfianza: makeModel(),
        codigoVerificacion: makeModel(),
        tokenRecuperacion: makeModel(),
        suscripcion: makeModel(),
        auditLog: makeModel(),
        colegio: makeModel(),
        tenant: makeModel(),
        alertaColegio: makeModel(),
        seguimientoCaso: makeModel(),
        notaSeguimiento: makeModel(),
        informeCaso: makeModel(),
        integranteComite: makeModel(),
        cursoMateria: makeModel(),
        materia: makeModel(),
        estudiante: makeModel(),
        profesor: makeModel(),
        curso: makeModel(),
        patronInstitucional: makeModel(),
        cargaRosterSesion: makeModel(),
        notificacionInApp: makeModel(),
        preferenciaAlertaColegio: makeModel(),
        registroAvisoColegio: makeModel(),
        onboardingColegio: makeModel(),
        // A-66: 6 modelos del subárbol de A-58
        identificadorProfesor: makeModel(),
        identificadorEstudiante: makeModel(),
        identificadorAcudiente: makeModel(),
        estudianteObservacion: makeModel(),
        acudienteEstudiante: makeModel(),
    };
    const client = {
        ...tx,
        $transaction: vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx)),
    } as unknown as PrismaClient;
    return { client, tx };
}

// ── borrarReporte ─────────────────────────────────────────────────────────────

describe("borrarReporte — A-65 · EventoExpediente.reporteId", () => {
    let client: PrismaClient;
    let tx: FakeModels;

    beforeEach(async () => {
        const f = makeFakeClient();
        client = f.client;
        tx = f.tx;

        tx.reporte.findUnique.mockResolvedValue({ id: "r1", numeroSeguimiento: "NS-001" });
        tx.identificadorReportado.findMany.mockResolvedValue([]);
        tx.eventoExpediente.count.mockResolvedValue(1);
        tx.eventoExpediente.updateMany.mockResolvedValue({ count: 1 });
        tx.reporte.delete.mockResolvedValue({ id: "r1" });
    });

    it("dry-run: reporta eventosExpedienteDesvinculados sin borrar", async () => {
        const { borrarReporte } = await import("./borrar-reporte");
        const resultado = await borrarReporte("r1", "test", { confirm: false, client });
        expect(resultado.dryRun).toBe(true);
        expect(resultado.filasBorradas).toBe(0);
        expect(resultado.detalle.eventosExpedienteDesvinculados).toBe(1);
        expect(tx.eventoExpediente.updateMany).not.toHaveBeenCalled();
    });

    it("confirm: llama eventoExpediente.updateMany(reporteId=null) ANTES de reporte.delete", async () => {
        const { borrarReporte } = await import("./borrar-reporte");
        await borrarReporte("r1", "test", { confirm: true, client });

        const updateOrder = tx.eventoExpediente.updateMany.mock.invocationCallOrder[0];
        const deleteOrder = tx.reporte.delete.mock.invocationCallOrder[0];
        expect(updateOrder).toBeLessThan(deleteOrder);

        expect(tx.eventoExpediente.updateMany).toHaveBeenCalledWith({
            where: { reporteId: "r1" },
            data: { reporteId: null },
        });
    });

    it("confirm: eventoExpedienteDesvinculados no se suma a filasBorradas", async () => {
        const { borrarReporte } = await import("./borrar-reporte");
        tx.solicitudComite.deleteMany.mockResolvedValue({ count: 0 });
        tx.correccionAdmin.deleteMany.mockResolvedValue({ count: 0 });
        tx.eventoMatch.deleteMany.mockResolvedValue({ count: 0 });

        const resultado = await borrarReporte("r1", "test", { confirm: true, client });

        // 1 reporte borrado; el evento desvinculado no suma.
        expect(resultado.filasBorradas).toBe(1);
        expect(resultado.detalle.eventosExpedienteDesvinculados).toBe(1);
    });
});

// ── borrarPadre ───────────────────────────────────────────────────────────────

describe("borrarPadre — A-65 · borrado de Expediente antes del Usuario", () => {
    let client: PrismaClient;
    let tx: FakeModels;

    beforeEach(() => {
        const f = makeFakeClient();
        client = f.client;
        tx = f.tx;

        // Usuario PARENT encontrado
        tx.usuario.findUnique.mockResolvedValue({ id: "u1", email: "padre@test.com", rol: "PARENT" });
        // Sin reportes (simplifica el test; borrarReporte se llama por cada uno)
        tx.reporte.findMany.mockResolvedValue([]);
        // Un expediente del padre
        tx.expediente.findMany.mockResolvedValue([{ id: "exp1" }]);
        tx.expediente.updateMany.mockResolvedValue({ count: 1 });
        tx.expediente.deleteMany.mockResolvedValue({ count: 1 });
        tx.aclaracionExpediente.deleteMany.mockResolvedValue({ count: 0 });
        tx.informeConsolidado.deleteMany.mockResolvedValue({ count: 0 });
        tx.patronExpediente.deleteMany.mockResolvedValue({ count: 0 });
        tx.eventoExpediente.deleteMany.mockResolvedValue({ count: 0 });
        tx.usuario.delete.mockResolvedValue({ id: "u1" });
    });

    it("dry-run: cuenta expedientes sin borrar nada", async () => {
        const { borrarPadre } = await import("./borrar-padre");
        const resultado = await borrarPadre("padre@test.com", "test", { confirm: false, client });
        expect(resultado.dryRun).toBe(true);
        expect(resultado.detalle.expedientes).toBe(1);
        expect(tx.expediente.deleteMany).not.toHaveBeenCalled();
        expect(tx.usuario.delete).not.toHaveBeenCalled();
    });

    it("confirm: nullea self-relation ANTES de borrar expediente", async () => {
        const { borrarPadre } = await import("./borrar-padre");
        await borrarPadre("padre@test.com", "test", { confirm: true, client });

        const updateOrder = tx.expediente.updateMany.mock.invocationCallOrder[0];
        const deleteOrder = tx.expediente.deleteMany.mock.invocationCallOrder[0];
        expect(updateOrder).toBeLessThan(deleteOrder);

        expect(tx.expediente.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ["exp1"] } },
            data: { expedienteRelacionadoAnteriorId: null },
        });
    });

    it("confirm: borra expediente ANTES de borrar usuario", async () => {
        const { borrarPadre } = await import("./borrar-padre");
        await borrarPadre("padre@test.com", "test", { confirm: true, client });

        const expDeleteOrder = tx.expediente.deleteMany.mock.invocationCallOrder[0];
        const userDeleteOrder = tx.usuario.delete.mock.invocationCallOrder[0];
        expect(expDeleteOrder).toBeLessThan(userDeleteOrder);
    });

    it("confirm: borra AclaracionExpediente, InformeConsolidado, PatronExpediente, EventoExpediente en orden", async () => {
        const { borrarPadre } = await import("./borrar-padre");
        await borrarPadre("padre@test.com", "test", { confirm: true, client });

        const aclOrder = tx.aclaracionExpediente.deleteMany.mock.invocationCallOrder[0];
        const infOrder = tx.informeConsolidado.deleteMany.mock.invocationCallOrder[0];
        const patOrder = tx.patronExpediente.deleteMany.mock.invocationCallOrder[0];
        const evOrder = tx.eventoExpediente.deleteMany.mock.invocationCallOrder[0];
        const expOrder = tx.expediente.deleteMany.mock.invocationCallOrder[0];

        expect(aclOrder).toBeLessThan(infOrder);
        expect(infOrder).toBeLessThan(patOrder);
        expect(patOrder).toBeLessThan(evOrder);
        expect(evOrder).toBeLessThan(expOrder);
    });

    it("confirm: sin expedientes, omite la cadena de borrado", async () => {
        tx.expediente.findMany.mockResolvedValue([]);
        const { borrarPadre } = await import("./borrar-padre");
        await borrarPadre("padre@test.com", "test", { confirm: true, client });

        expect(tx.expediente.deleteMany).not.toHaveBeenCalled();
        expect(tx.aclaracionExpediente.deleteMany).not.toHaveBeenCalled();
        // Usuario sí se borra
        expect(tx.usuario.delete).toHaveBeenCalled();
    });
});

// ── borrarColegio ─────────────────────────────────────────────────────────────

describe("borrarColegio — A-66 · subárbol A-58 + trampa cross-tenant AlertaColegio", () => {
    let client: PrismaClient;
    let tx: FakeModels;

    beforeEach(async () => {
        const f = makeFakeClient();
        client = f.client;
        tx = f.tx;

        // Colegio encontrado con admin y sin comiteConvivencia para simplificar
        tx.colegio.findUnique.mockResolvedValue({
            id: "col1",
            nombre: "Colegio Prueba",
            tenantId: "tenant1",
            admin: { id: "adm1", email: "admin@col.com" },
            comiteConvivencia: null,
        });
        tx.reporte.findMany.mockResolvedValue([]); // sin reportes de tenant (simplifica)

        // Identificadores del colegio
        tx.identificadorProfesor.findMany.mockResolvedValue([{ id: "ip1" }]);
        tx.identificadorEstudiante.findMany.mockResolvedValue([{ id: "ie1" }]);
        tx.identificadorAcudiente.findMany.mockResolvedValue([]);

        // AlertaColegio — incluye una alerta cross-tenant que referencia ip1
        tx.alertaColegio.findMany.mockResolvedValue([{ id: "a1" }, { id: "a2" }]); // a2 = cross-tenant
        // SeguimientoCaso para esas alertas
        tx.seguimientoCaso.findMany.mockResolvedValue([{ id: "seg1" }]);
        // Estudiantes para EstudianteObservacion y AcudienteEstudiante
        tx.estudiante.findMany.mockResolvedValue([{ id: "est1" }]);
        // Expediente del admin
        tx.expediente.findMany.mockResolvedValue([]);
        // Audit
        tx.auditLog.create.mockResolvedValue({});
    });

    it("confirm: InformeCaso se borra ANTES de SeguimientoCaso (SPEC-351 · FK RESTRICT, sin Cascade)", async () => {
        const { borrarColegio } = await import("./borrar-colegio");
        await borrarColegio("col1", "test", { confirm: true, client });

        // Assert FUERTE del orden nuevo: nota → informe → caso.
        const notaOrder = tx.notaSeguimiento.deleteMany.mock.invocationCallOrder[0];
        const informeOrder = tx.informeCaso.deleteMany.mock.invocationCallOrder[0];
        const casoOrder = tx.seguimientoCaso.deleteMany.mock.invocationCallOrder[0];
        expect(informeOrder, "InformeCaso debe borrarse (la tabla existe y la FK es RESTRICT)").toBeDefined();
        expect(notaOrder).toBeLessThan(informeOrder);
        expect(informeOrder).toBeLessThan(casoOrder);

        // Y con el filtro correcto: por los casos hallados, no un deleteMany({}) ciego.
        expect(tx.informeCaso.deleteMany).toHaveBeenCalledWith({
            where: { casoId: { in: ["seg1"] } },
        });
    });

    it("confirm: SolicitudComite se borra ANTES de AlertaColegio (FK-safe)", async () => {
        const { borrarColegio } = await import("./borrar-colegio");
        await borrarColegio("col1", "test", { confirm: true, client });

        const scOrder = tx.solicitudComite.deleteMany.mock.invocationCallOrder[0];
        const acOrder = tx.alertaColegio.deleteMany.mock.invocationCallOrder[0];
        expect(scOrder).toBeLessThan(acOrder);

        expect(tx.solicitudComite.deleteMany).toHaveBeenCalledWith({
            where: { alertaColegioId: { in: ["a1", "a2"] } },
        });
    });

    it("confirm: AlertaColegio se borra con IDs (cross-tenant), no solo por colegioId", async () => {
        const { borrarColegio } = await import("./borrar-colegio");
        await borrarColegio("col1", "test", { confirm: true, client });

        expect(tx.alertaColegio.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ["a1", "a2"] } },
        });
        // No debe llamarse con { where: { colegioId } } — ese patrón no cubre cross-tenant
        const callArgs = tx.alertaColegio.deleteMany.mock.calls.map((c: unknown[]) => JSON.stringify(c));
        expect(callArgs.every((a: string) => !a.includes('"colegioId"'))).toBe(true);
    });

    it("confirm: identificadores se borran DESPUÉS de AlertaColegio (FK-safe)", async () => {
        const { borrarColegio } = await import("./borrar-colegio");
        await borrarColegio("col1", "test", { confirm: true, client });

        const acOrder = tx.alertaColegio.deleteMany.mock.invocationCallOrder[0];
        const ipOrder = tx.identificadorProfesor.deleteMany.mock.invocationCallOrder[0];
        const ieOrder = tx.identificadorEstudiante.deleteMany.mock.invocationCallOrder[0];

        expect(acOrder).toBeLessThan(ipOrder);
        expect(acOrder).toBeLessThan(ieOrder);
    });

    it("confirm: EstudianteObservacion y AcudienteEstudiante se borran ANTES de Estudiante", async () => {
        const { borrarColegio } = await import("./borrar-colegio");
        await borrarColegio("col1", "test", { confirm: true, client });

        const eoOrder = tx.estudianteObservacion.deleteMany.mock.invocationCallOrder[0];
        const aeOrder = tx.acudienteEstudiante.deleteMany.mock.invocationCallOrder[0];
        const estOrder = tx.estudiante.deleteMany.mock.invocationCallOrder[0];

        expect(eoOrder).toBeLessThan(estOrder);
        expect(aeOrder).toBeLessThan(estOrder);

        expect(tx.estudianteObservacion.deleteMany).toHaveBeenCalledWith({
            where: { estudianteId: { in: ["est1"] } },
        });
        expect(tx.acudienteEstudiante.deleteMany).toHaveBeenCalledWith({
            where: { estudianteId: { in: ["est1"] } },
        });
    });

    it("confirm: sin identificadores, omite los findMany de alertas por identifier", async () => {
        tx.identificadorProfesor.findMany.mockResolvedValue([]);
        tx.identificadorEstudiante.findMany.mockResolvedValue([]);
        tx.identificadorAcudiente.findMany.mockResolvedValue([]);
        // Sin identificadores, la cláusula OR solo incluye colegioId
        tx.alertaColegio.findMany.mockResolvedValue([{ id: "a1" }]);

        const { borrarColegio } = await import("./borrar-colegio");
        await borrarColegio("col1", "test", { confirm: true, client });

        // deleteMany de identificadores no hace nada (count=0 pero se llama igual)
        expect(tx.identificadorProfesor.deleteMany).toHaveBeenCalled();
        expect(tx.identificadorEstudiante.deleteMany).toHaveBeenCalled();
    });
});

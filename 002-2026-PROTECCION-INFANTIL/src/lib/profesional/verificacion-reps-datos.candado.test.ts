/**
 * CANDADO · SPEC-790 (D-121 de Datos) — la BD garantiza el contrato de `VerificacionReps`. Prisma es
 * ciego al CHECK y al TRIGGER: esto prueba la CONDUCTA contra Postgres (inserción/actualización/borrado).
 *
 *   (1) CHECK resultado='VIGENTE' => vigenteHasta IS NOT NULL (23514): un VIGENTE sin fecha dejaría la
 *       compuerta abierta para siempre — inconstruible. Los otros tres resultados NO exigen fecha.
 *   (2) verificadoEn INMUTABLE (trigger): append-only, la prueba de CUÁNDO verificamos no se reescribe.
 *   (3) profesionalId RESTRICT: no se puede borrar un profesional con verificación — la prueba no desaparece.
 *   (4) verificadoPorId SetNull + snapshot durable: borrar al admin vacía el FK pero el snapshot (el
 *       registro de responsabilidad) y la fila SOBREVIVEN.
 *   (5) modalidades es LISTA (el motor evalúa «¿incluye TELEMEDICINA?»); y el ESTADO se DERIVA de la
 *       ÚLTIMA fila (no de una columna mutable cacheada).
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";

let contador = 0;
const uniq = (p: string) => `${p}-790-${Date.now()}-${contador++}`;

const VERIF = new Date("2026-09-15T12:00:00Z");
const VIGENCIA = new Date("2027-09-15T12:00:00Z");

interface VerifOpts {
    verificadoEn?: Date;
    fuente?: "API" | "ARCHIVO" | "MANUAL_ADMIN";
    resultado?: "VIGENTE" | "VENCIDA" | "NO_ENCONTRADA" | "SIN_VERIFICAR";
    vigenteHasta?: Date | null;
    modalidades?: ("PRESENCIAL" | "TELEMEDICINA")[];
    verificadoPorId?: string | null;
    verificadoPorSnapshot?: string | null;
}

async function seedProfesional() {
    const { ciudad } = await crearPaisCiudad();
    const u = await crearUsuario("PROFESIONAL", `${uniq("prof")}@test.local`);
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: "Prof. REPS",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Trabaja con niños.",
            tarifaConsultaCOP: 120_000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
}

function crearVerificacion(profesionalId: string, o: VerifOpts = {}) {
    return prisma.verificacionReps.create({
        data: {
            profesionalId,
            verificadoEn: o.verificadoEn ?? VERIF,
            fuente: o.fuente ?? "API",
            resultado: o.resultado ?? "VIGENTE",
            vigenteHasta: o.vigenteHasta !== undefined ? o.vigenteHasta : VIGENCIA,
            modalidades: o.modalidades ?? ["PRESENCIAL", "TELEMEDICINA"],
            verificadoPorId: o.verificadoPorId ?? null,
            verificadoPorSnapshot: o.verificadoPorSnapshot ?? null,
        },
    });
}

function detalleError(err: unknown): string {
    return `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
}

async function esperarRechazo(promesa: Promise<unknown>): Promise<string> {
    let err: unknown;
    try {
        await promesa;
    } catch (e) {
        err = e;
    }
    expect(err, "la BD DEBE rechazar esto: si pasa, la restricción ya no está").toBeDefined();
    return detalleError(err);
}

describe("SPEC-790 · CHECK VIGENTE exige vigenteHasta (23514)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("VIGENTE sin vigenteHasta → rechazo (la compuerta no puede quedar abierta para siempre)", async () => {
        const p = await seedProfesional();
        const detalle = await esperarRechazo(crearVerificacion(p.id, { resultado: "VIGENTE", vigenteHasta: null }));
        expect(detalle).toMatch(/23514|VerificacionReps_vigente_exige_vigencia_check/);
    });

    it("VIGENTE con vigenteHasta → pasa", async () => {
        const p = await seedProfesional();
        const v = await crearVerificacion(p.id, { resultado: "VIGENTE", vigenteHasta: VIGENCIA });
        expect(v.id).toBeTruthy();
    });

    it.each(["VENCIDA", "NO_ENCONTRADA", "SIN_VERIFICAR"] as const)(
        "%s sin vigenteHasta → pasa (el CHECK solo ata VIGENTE)",
        async (resultado) => {
            const p = await seedProfesional();
            const v = await crearVerificacion(p.id, { resultado, vigenteHasta: null });
            expect(v.resultado).toBe(resultado);
        },
    );
});

describe("SPEC-790 · verificadoEn inmutable · profesionalId Restrict · actor SetNull+snapshot", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("verificadoEn es INMUTABLE (append-only): moverlo lanza; otra columna sí se puede tocar", async () => {
        const p = await seedProfesional();
        const v = await crearVerificacion(p.id);
        await prisma.verificacionReps.update({ where: { id: v.id }, data: { verificadoPorSnapshot: "nota" } }); // control: otra col
        const detalle = await esperarRechazo(
            prisma.verificacionReps.update({ where: { id: v.id }, data: { verificadoEn: new Date("2027-01-01T00:00:00Z") } }),
        );
        expect(detalle).toMatch(/inmutable/i);
    });

    it("NO se puede borrar un profesional con verificación: la prueba no desaparece (Restrict, 23503)", async () => {
        const p = await seedProfesional();
        await crearVerificacion(p.id);
        const detalle = await esperarRechazo(prisma.perfilProfesional.delete({ where: { id: p.id } }));
        expect(detalle).toMatch(/23503|Restrict|[Ff]oreign key/);
    });

    it("borrar al admin vacía verificadoPorId, pero la verificación y el snapshot SOBREVIVEN", async () => {
        const p = await seedProfesional();
        const admin = await crearUsuario("ADMIN", `${uniq("admin")}@test.local`);
        const v = await crearVerificacion(p.id, { fuente: "MANUAL_ADMIN", verificadoPorId: admin.id, verificadoPorSnapshot: admin.email });
        await prisma.usuario.delete({ where: { id: admin.id } });
        const row = await prisma.verificacionReps.findUnique({ where: { id: v.id } });
        expect(row, "la verificación DEBE sobrevivir").not.toBeNull();
        expect(row?.verificadoPorId, "el FK del actor se vacía (SetNull)").toBeNull();
        expect(row?.verificadoPorSnapshot, "el snapshot durable sobrevive — es el registro de responsabilidad").toBe(admin.email);
    });
});

describe("SPEC-790 · modalidades es lista · estado DERIVADO de la última fila", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("modalidades es una LISTA — el motor evalúa «incluye TELEMEDICINA»", async () => {
        const p = await seedProfesional();
        const v = await crearVerificacion(p.id, { modalidades: ["PRESENCIAL", "TELEMEDICINA"] });
        const row = await prisma.verificacionReps.findUnique({ where: { id: v.id } });
        expect(row?.modalidades).toContain("TELEMEDICINA");
        const soloPresencial = await crearVerificacion(p.id, { verificadoEn: new Date("2026-10-01T12:00:00Z"), modalidades: ["PRESENCIAL"] });
        const row2 = await prisma.verificacionReps.findUnique({ where: { id: soloPresencial.id } });
        expect(row2?.modalidades).not.toContain("TELEMEDICINA");
    });

    it("el estado vigente se DERIVA de la ÚLTIMA verificación (orden por verificadoEn desc), no de una columna cacheada", async () => {
        const p = await seedProfesional();
        await crearVerificacion(p.id, { verificadoEn: new Date("2026-09-01T12:00:00Z"), resultado: "VIGENTE", vigenteHasta: VIGENCIA });
        await crearVerificacion(p.id, { verificadoEn: new Date("2026-09-20T12:00:00Z"), resultado: "VENCIDA", vigenteHasta: null });
        const ultima = await prisma.verificacionReps.findFirst({ where: { profesionalId: p.id }, orderBy: { verificadoEn: "desc" } });
        expect(ultima?.resultado, "gana la última: hoy VENCIDA aunque antes estuvo VIGENTE").toBe("VENCIDA");
    });
});

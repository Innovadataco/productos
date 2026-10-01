/**
 * CANDADO · SPEC-790 (T6) · el registro manual REPS: (1) la compuerta de CÓDIGO cierra ANTES del CHECK de
 * la base (un VIGENTE inválido lanza AppError, NO el error crudo de Postgres, y NO inserta fila); (2) el
 * actor queda en el SNAPSHOT durable, no solo en el FK; (3) append-only (una corrección es fila nueva).
 * Integración (BD de test, truncada).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { AppError } from "@/lib/errors";
import { registrarVerificacionManualReps } from "./verificacion-reps";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date();
const FUT = new Date(AHORA.getTime() + 90 * DIA);
const SNAPSHOT = "admin.reps@idc.local";

describe("SPEC-790 (T6) · registro manual REPS (compuerta antes del CHECK · snapshot durable · append-only)", () => {
    let profesionalId: string;
    let adminId: string;
    const actor = () => ({ usuarioId: adminId, snapshot: SNAPSHOT });

    beforeEach(async () => {
        await resetDatabase();
        const { ciudad } = await crearPaisCiudad();
        const u = await crearUsuario("PROFESIONAL");
        const p = await prisma.perfilProfesional.create({
            data: {
                usuarioId: u.id,
                nombreVisible: "Pro REPS",
                tituloProfesional: "Psicología",
                especialidades: ["infantil"],
                ciudadId: ciudad.id,
                atiendeVirtual: true,
                aniosExperiencia: 5,
                presentacion: "Perfil de prueba.",
                tarifaConsultaCOP: 120000,
                duracionMinutos: 45,
                estado: "ACTIVO",
            },
        });
        profesionalId = p.id;
        adminId = (await crearUsuario("ADMIN")).id;
    });
    afterAll(async () => prisma.$disconnect());

    it("VIGENTE sin vigenteHasta → la PUERTA (AppError) cierra antes de la RED (CHECK): cero filas", async () => {
        await expect(
            registrarVerificacionManualReps(
                { profesionalId, resultado: "VIGENTE", vigenteHasta: null, modalidades: ["PRESENCIAL"] },
                actor(),
                AHORA,
            ),
        ).rejects.toBeInstanceOf(AppError);
        expect(
            await prisma.verificacionReps.count({ where: { profesionalId } }),
            "no se insertó nada: el código rechazó antes de que la base viera el VIGENTE sin fecha",
        ).toBe(0);
    });

    it("VIGENTE sin modalidades → AppError, cero filas", async () => {
        await expect(
            registrarVerificacionManualReps({ profesionalId, resultado: "VIGENTE", vigenteHasta: FUT, modalidades: [] }, actor(), AHORA),
        ).rejects.toBeInstanceOf(AppError);
        expect(await prisma.verificacionReps.count({ where: { profesionalId } })).toBe(0);
    });

    it("VIGENTE válido → fila MANUAL_ADMIN con el actor en el SNAPSHOT durable (no solo el FK)", async () => {
        const fila = await registrarVerificacionManualReps(
            { profesionalId, resultado: "VIGENTE", vigenteHasta: FUT, modalidades: ["PRESENCIAL", "TELEMEDICINA"] },
            actor(),
            AHORA,
        );
        expect(fila.fuente).toBe("MANUAL_ADMIN");
        expect(fila.resultado).toBe("VIGENTE");
        expect(fila.verificadoPorId).toBe(adminId);
        expect(fila.verificadoPorSnapshot, "el rastro de responsabilidad es durable, no solo el FK").toBe(SNAPSHOT);
    });

    it("VENCIDA: no exige fecha ni modalidades; vigenteHasta se normaliza a null", async () => {
        const fila = await registrarVerificacionManualReps(
            { profesionalId, resultado: "VENCIDA", vigenteHasta: FUT, modalidades: [] },
            actor(),
            AHORA,
        );
        expect(fila.resultado).toBe("VENCIDA");
        expect(fila.vigenteHasta, "la vigencia de la autoridad solo aplica a VIGENTE").toBeNull();
    });

    it("append-only: una corrección es una fila NUEVA (las dos quedan)", async () => {
        await registrarVerificacionManualReps(
            { profesionalId, resultado: "VENCIDA", vigenteHasta: null, modalidades: [] },
            actor(),
            new Date(AHORA.getTime() - DIA),
        );
        await registrarVerificacionManualReps(
            { profesionalId, resultado: "VIGENTE", vigenteHasta: FUT, modalidades: ["PRESENCIAL"] },
            actor(),
            AHORA,
        );
        expect(await prisma.verificacionReps.count({ where: { profesionalId } }), "corrección = fila nueva, no update").toBe(2);
    });
});

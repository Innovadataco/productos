/**
 * SPEC-132 (S-4): el roster vive server-side; el token firma SOLO ids (sin PII);
 * la confirmación consume la sesión (single-use, O-2) con guardas de TTL y tenant.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import {
    crearSesionRoster,
    obtenerSesionRosterValida,
    consumirSesionRoster,
    purgarSesionesRosterVencidas,
} from "./sesion-roster";
import { generarTokenCarga, verificarTokenCarga } from "./token";
import type { FilaCargaEstudiante } from "./parser";

let COLEGIO_A: string;
let COLEGIO_B: string;

function filasDePrueba(): FilaCargaEstudiante[] {
    return [
        {
            fila: 2,
            curso: { nombre: "6A", grado: "Sexto", anioLectivo: "2026" },
            alumno: { nombre: "María", apellidos: "Gómez" },
            identificador: { tipo: "telefono", valor: "+573001234567", etiquetaRelacion: "ESTUDIANTE", plataformaId: "WhatsApp" },
        },
    ];
}

async function payloadDelToken(token: string): Promise<Record<string, unknown>> {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, unknown>;
}

beforeEach(async () => {
    await resetDatabase();
    // La FK exige colegios reales (SPEC-132: sesión ligada al tenant).
    const { colegio: a } = await crearColegioConAdmin();
    const { colegio: b } = await crearColegioConAdmin();
    COLEGIO_A = a.id;
    COLEGIO_B = b.id;
});

describe("token de carga sin PII (SPEC-132 S-4)", () => {
    it("el payload del JWT contiene SOLO ids (guarda: nunca roster en el token)", async () => {
        const token = await generarTokenCarga({ sesionId: "sesion-x", colegioId: COLEGIO_A });
        const payload = await payloadDelToken(token);

        expect(payload.sesionId).toBe("sesion-x");
        expect(payload.colegioId).toBe(COLEGIO_A);
        expect(payload).not.toHaveProperty("filas");
        const plano = JSON.stringify(payload);
        expect(plano).not.toContain("María");
        expect(plano).not.toContain("identificador");
        expect(plano).not.toContain("+573001234567");
    });

    it("verificarTokenCarga rechaza un token viejo del formato con roster", async () => {
        expect(await verificarTokenCarga("no-es-jwt")).toBeNull();
    });
});

describe("sesión de roster server-side (SPEC-132 S-4)", () => {
    it("crea y lee la sesión con guardas de tenant", async () => {
        const sesionId = await crearSesionRoster(COLEGIO_A, filasDePrueba());

        const valida = await obtenerSesionRosterValida(sesionId, COLEGIO_A);
        expect(valida).not.toBeNull();
        expect(valida!.filas).toHaveLength(1);
        expect(valida!.filas[0].alumno.nombre).toBe("María");
        expect(valida!.filas[0].alumno.apellidos).toBe("Gómez");

        // Otro colegio: la sesión no existe para él (aislamiento).
        expect(await obtenerSesionRosterValida(sesionId, COLEGIO_B)).toBeNull();
    });

    it("una sesión vencida no pasa la guarda (TTL)", async () => {
        const sesionId = await crearSesionRoster(COLEGIO_A, filasDePrueba());
        await prisma.cargaRosterSesion.update({
            where: { id: sesionId },
            data: { expiraEn: new Date(Date.now() - 1000) },
        });

        expect(await obtenerSesionRosterValida(sesionId, COLEGIO_A)).toBeNull();
    });

    it("single-use (O-2): tras consumir la sesión, ya no existe", async () => {
        const sesionId = await crearSesionRoster(COLEGIO_A, filasDePrueba());
        await prisma.$transaction(async (tx) => {
            await consumirSesionRoster(sesionId, tx);
        });

        expect(await obtenerSesionRosterValida(sesionId, COLEGIO_A)).toBeNull();
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: sesionId } })).toBeNull();
    });

    it("la limpieza backstop borra solo las vencidas", async () => {
        const vigente = await crearSesionRoster(COLEGIO_A, filasDePrueba());
        const vencida = await crearSesionRoster(COLEGIO_B, filasDePrueba());
        await prisma.cargaRosterSesion.update({
            where: { id: vencida },
            data: { expiraEn: new Date(Date.now() - 1000) },
        });

        const purgadas = await purgarSesionesRosterVencidas();
        expect(purgadas).toBe(1);
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: vigente } })).not.toBeNull();
        expect(await prisma.cargaRosterSesion.findUnique({ where: { id: vencida } })).toBeNull();
    });
});

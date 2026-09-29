/**
 * SPEC-779 · CANDADO de integración del cupo de SESIONES del asignador de citas (BD de test).
 *
 * Reproduce el defecto con DATO REAL (orden del CEO): un operador con más sesiones CONFIRMADA
 * que su cupo de SESIONES no puede recibir otra — antes del arreglo entraba (peso negativo →
 * weightedRandom degradaba) y se le asignaba igual. Prueba por MUTACIÓN en ambos sentidos
 * (bajo cupo entra / sobre cupo queda fuera y el motivo lo dice) y el corte por FECHA (una
 * sesión pasada no ocupa capacidad).
 *
 * El cupo de sesiones se baja a 1 (parámetro) para plantar pocas filas; el defecto es el mismo
 * a 10 + 11. Las sesiones NO se solapan entre sí ni con la cita objetivo: así el que descarta es
 * el CUPO, no la simultaneidad.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { asignarOperadorACita } from "@/lib/operadores/asignador-citas";

const MIN = 60 * 1000;
const DIA = 24 * 60 * MIN;

async function bajarCupoSesiones(valor: number) {
    await prisma.parametroSistema.upsert({
        where: { clave: "operadores.cupo_sesiones_default" },
        create: { clave: "operadores.cupo_sesiones_default", valor: String(valor), tipo: "INTEGER", categoria: "SECURITY", esPublico: false },
        update: { valor: String(valor) },
    });
}

async function crearAdmin() {
    return crearUsuario("ADMIN");
}

async function crearOperador(creadoPorId: string, suffix: string) {
    const u = await crearUsuario("OPERADOR", `op-${suffix}-${Date.now()}@test.local`);
    await prisma.perfilOperador.create({ data: { usuarioId: u.id, cupoMaximo: 10, creadoPorId } });
    return u;
}

async function crearProfesionalYPadre() {
    const { ciudad } = await crearPaisCiudad();
    const padre = await crearUsuario("PARENT");
    const profU = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: profU.id,
            nombreVisible: "Prof. Cupo 779",
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
    return { perfilId: perfil.id, padreId: padre.id };
}

async function crearCita(
    perfilId: string,
    padreId: string,
    inicioMs: number,
    opts: { operadorId?: string; estado?: "CONFIRMADA" } = {},
) {
    const inicio = new Date(inicioMs);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: perfilId, inicio, fin: new Date(inicioMs + 50 * MIN), modalidad: "VIRTUAL", tomada: true },
    });
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padreId,
            profesionalId: perfilId,
            franjaId: franja.id,
            presentacion: "Cita SPEC-779 cupo.",
            urgencia: "SIN_APURO",
            estado: opts.estado ?? "CONFIRMADA",
            venceEn: new Date(inicioMs),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
            ...(opts.operadorId ? { enlaceOperadorId: opts.operadorId } : {}),
        },
    });
}

describe("SPEC-779 · asignarOperadorACita respeta el cupo de SESIONES", { timeout: 40_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await bajarCupoSesiones(1); // cupo de sesiones = 1 → 2 sesiones ya es sobre-cupo
    });

    it("operador SOBRE su cupo de sesiones (2 vigentes, cupo 1) → NO se le asigna; sube al admin como capacidad", async () => {
        const admin = await crearAdmin();
        const { perfilId, padreId } = await crearProfesionalYPadre();
        const op = await crearOperador(admin.id, "over");
        const ahora = Date.now();
        // 2 sesiones CONFIRMADA FUTURAS, sin solape entre sí ni con la objetivo.
        await crearCita(perfilId, padreId, ahora + 10 * DIA, { operadorId: op.id });
        await crearCita(perfilId, padreId, ahora + 11 * DIA, { operadorId: op.id });
        const objetivo = await crearCita(perfilId, padreId, ahora + 30 * DIA);

        const res = await asignarOperadorACita(objetivo.id);
        expect(res.asignado).toBe(false);
        if (!res.asignado) expect(res.razon).toMatch(/cupo de sesiones/i);
        // NO quedó asignada a nadie (el defecto le habría puesto el over-cupo).
        const recargada = await prisma.solicitudCita.findUnique({ where: { id: objetivo.id }, select: { enlaceOperadorId: true } });
        expect(recargada?.enlaceOperadorId).toBeNull();
    });

    it("con un over-cupo y uno LIBRE, se asigna al libre — NUNCA al over (mutación: el libre entra)", async () => {
        const admin = await crearAdmin();
        const { perfilId, padreId } = await crearProfesionalYPadre();
        const over = await crearOperador(admin.id, "over");
        const libre = await crearOperador(admin.id, "libre");
        const ahora = Date.now();
        await crearCita(perfilId, padreId, ahora + 10 * DIA, { operadorId: over.id });
        await crearCita(perfilId, padreId, ahora + 11 * DIA, { operadorId: over.id });
        const objetivo = await crearCita(perfilId, padreId, ahora + 30 * DIA);

        const res = await asignarOperadorACita(objetivo.id);
        expect(res.asignado).toBe(true);
        if (res.asignado) expect(res.operadorId).toBe(libre.id);
    });

    it("corte por FECHA: 2 sesiones PASADAS no cuentan → el operador está bajo cupo y SÍ se le asigna", async () => {
        const admin = await crearAdmin();
        const { perfilId, padreId } = await crearProfesionalYPadre();
        const op = await crearOperador(admin.id, "pasadas");
        const ahora = Date.now();
        // 2 sesiones YA TERMINADAS (fin < ahora): no ocupan capacidad futura.
        await crearCita(perfilId, padreId, ahora - 10 * DIA, { operadorId: op.id });
        await crearCita(perfilId, padreId, ahora - 11 * DIA, { operadorId: op.id });
        const objetivo = await crearCita(perfilId, padreId, ahora + 30 * DIA);

        const res = await asignarOperadorACita(objetivo.id);
        expect(res.asignado).toBe(true);
        if (res.asignado) expect(res.operadorId).toBe(op.id);
    });
});

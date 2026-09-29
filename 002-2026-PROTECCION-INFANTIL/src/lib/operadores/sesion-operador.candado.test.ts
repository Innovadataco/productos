/**
 * CANDADO · SPEC-750 — los tres criterios de auditoría del radicado, con dato REAL:
 *
 *  (C-a) El DTO del operador NUNCA lleva PII del padre — plantados nombre/relato/correo
 *        del padre, ninguno aparece en la respuesta del operador (estructural).
 *  (C-b) La asignación respeta SIMULTANEIDAD — asignar a un operador ya ocupado en la
 *        ventana → rechazo; control positivo: ventana libre → asigna.
 *  (C-c) El enlace REAL plantado NO aparece en el registro del hecho ni en nada que
 *        viaje a `bi_replica` (`AuditLog.metadatos`). Control positivo: el enlace SÍ
 *        quedó en la cita (el scan no es vacío) y el HECHO se registró.
 *
 * Integración (BD de test, truncada por resetDatabase).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPaisCiudad } from "@/lib/reporte-test-utils";
import { hashPassword } from "@/lib/auth";
import { calendarioDelOperador } from "./calendario-operador.service";
import { asignarOperadorACita } from "./asignador-citas";
import { publicarEnlaceSesion } from "./enlace-sesion";

const PADRE_NOMBRE = "NombreSecretoDelPadre";
const PADRE_EMAIL = "padre-secreto@correo.local";
const PADRE_RELATO = "RelatoSecretoDelPadreEnLaPresentacion";

async function crearAdmin() {
    return prisma.usuario.create({
        data: { email: `admin-${Date.now()}@test.local`, passwordHash: await hashPassword("Admin123!"), rol: "ADMIN", estado: "activo" },
    });
}

async function crearOperador(adminId: string, suffix: string) {
    const user = await prisma.usuario.create({
        data: { email: `op-${suffix}-${Date.now()}@test.local`, passwordHash: await hashPassword("Operador123!"), rol: "OPERADOR", estado: "activo" },
    });
    await prisma.perfilOperador.create({ data: { usuarioId: user.id, cupoMaximo: 10, creadoPorId: adminId } });
    return user;
}

async function crearProfesional() {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await prisma.usuario.create({
        data: { email: `pro-${Date.now()}-${Math.random()}@test.local`, passwordHash: await hashPassword("Pro123!"), rol: "PROFESIONAL", estado: "activo" },
    });
    return prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id, nombreVisible: "Dra. Pública", tituloProfesional: "Psicóloga",
            especialidades: ["TRAUMA_INFANTIL"], ciudadId: ciudad.id, atiendeVirtual: true, atiendePresencial: false,
            aniosExperiencia: 5, presentacion: "Trabaja con niños.", tarifaConsultaCOP: 100_000, duracionMinutos: 50, estado: "ACTIVO",
        },
    });
}

let contador = 0;
async function crearCitaConfirmada(opts: {
    profesionalId: string;
    inicio: Date;
    fin: Date;
    enlaceOperadorId?: string | null;
}) {
    const padre = await prisma.usuario.create({
        data: {
            email: `${PADRE_EMAIL}.${contador++}`,
            passwordHash: await hashPassword("Padre123!"),
            rol: "PARENT",
            estado: "activo",
            nombre: PADRE_NOMBRE,
        },
    });
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: opts.profesionalId, inicio: opts.inicio, fin: opts.fin, modalidad: "VIRTUAL", tomada: true },
    });
    return prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id,
            profesionalId: opts.profesionalId,
            franjaId: franja.id,
            presentacion: PADRE_RELATO,
            urgencia: "SIN_APURO",
            estado: "CONFIRMADA",
            venceEn: new Date(Date.now() + 72 * 3600_000),
            pagoAprobadoEn: new Date(),
            montoConsulta: 100_000,
            montoServicio: 10_000,
            montoTotal: 110_000,
            porcentajeServicio: 10,
            enlaceOperadorId: opts.enlaceOperadorId ?? null,
        },
    });
}

const V = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 20, h, m, 0)); // 2026-09-20 UTC

describe("SPEC-750 · C-a · el DTO del operador no lleva PII del padre", () => {
    beforeEach(async () => await resetDatabase());

    it("con nombre/relato/correo del padre poblados, la vista del operador no los expone", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "a");
        const prof = await crearProfesional();
        const cita = await crearCitaConfirmada({ profesionalId: prof.id, inicio: V(10), fin: V(10, 50), enlaceOperadorId: operador.id });

        // Control positivo: la fuente SÍ tiene la PII (si no, el «no aparece» sería trivial).
        const bruto = await prisma.solicitudCita.findUnique({ where: { id: cita.id }, include: { padreUsuario: true } });
        expect(bruto?.padreUsuario.nombre).toBe(PADRE_NOMBRE);
        expect(bruto?.presentacion).toBe(PADRE_RELATO);

        const cal = await calendarioDelOperador(operador.id, V(9)); // `ahora` justo antes de la cita
        const json = JSON.stringify(cal);
        expect(json).not.toContain(PADRE_NOMBRE);
        expect(json).not.toContain(PADRE_EMAIL);
        expect(json).not.toContain(PADRE_RELATO);

        const bloque = cal.bloques.find((b) => b.citaId === cita.id);
        expect(bloque, "la sesión asignada debe aparecer en el calendario del operador").toBeDefined();
        for (const prohibido of ["familia", "relato", "contactoEmail"]) {
            expect(bloque as unknown as Record<string, unknown>).not.toHaveProperty(prohibido);
        }
    });
});

describe("SPEC-750 · C-b · asignación con simultaneidad", () => {
    beforeEach(async () => await resetDatabase());

    it("rechaza asignar a un operador ya ocupado en la ventana", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "b");
        const prof = await crearProfesional();
        // El operador ya tiene una cita 10:00–10:50.
        await crearCitaConfirmada({ profesionalId: prof.id, inicio: V(10), fin: V(10, 50), enlaceOperadorId: operador.id });
        // Nueva cita solapada 10:30–11:20, sin asignar.
        const nueva = await crearCitaConfirmada({ profesionalId: prof.id, inicio: V(10, 30), fin: V(11, 20), enlaceOperadorId: null });

        const r = await asignarOperadorACita(nueva.id);
        expect(r.asignado, "no hay operador libre en esa ventana").toBe(false);
        const recargada = await prisma.solicitudCita.findUnique({ where: { id: nueva.id }, select: { enlaceOperadorId: true } });
        expect(recargada?.enlaceOperadorId).toBeNull();
    });

    it("control positivo: con la ventana libre, SÍ asigna", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "c");
        const prof = await crearProfesional();
        await crearCitaConfirmada({ profesionalId: prof.id, inicio: V(10), fin: V(10, 50), enlaceOperadorId: operador.id });
        // Nueva cita en ventana LIBRE 12:00–12:50.
        const nueva = await crearCitaConfirmada({ profesionalId: prof.id, inicio: V(12), fin: V(12, 50), enlaceOperadorId: null });

        const r = await asignarOperadorACita(nueva.id);
        expect(r.asignado).toBe(true);
        const recargada = await prisma.solicitudCita.findUnique({ where: { id: nueva.id }, select: { enlaceOperadorId: true } });
        expect(recargada?.enlaceOperadorId).toBe(operador.id);
    });
});

describe("SPEC-750 · C-c · la URL del enlace nunca entra al registro del hecho", () => {
    beforeEach(async () => await resetDatabase());

    it("publicar el enlace deja la URL en la cita pero NO en AuditLog.metadatos", async () => {
        const admin = await crearAdmin();
        const operador = await crearOperador(admin.id, "d");
        const prof = await crearProfesional();
        const cita = await crearCitaConfirmada({ profesionalId: prof.id, inicio: V(10), fin: V(10, 50), enlaceOperadorId: operador.id });

        const URL_SECRETA = "https://video.example/sala-SECRETA-xyz-123";
        await publicarEnlaceSesion({ citaId: cita.id, operadorId: operador.id, enlaceRaw: URL_SECRETA });

        // Control positivo: la URL SÍ quedó en la cita → prueba que el enlace EXISTE en el
        // sistema (el scan de abajo no es vacío). Las columnas `enlace*` NO se replican a
        // bi_replica (allowlist explícita, default-deny · lo midió Datos), así que la cita no
        // es el camino a vigilar.
        const recargada = await prisma.solicitudCita.findUnique({ where: { id: cita.id }, select: { enlaceReunion: true, enlacePublicadoEn: true } });
        expect(recargada?.enlaceReunion).toBe(URL_SECRETA);
        expect(recargada?.enlacePublicadoEn).not.toBeNull();

        // El camino VIVO: `AuditLog.metadatos` es JSON y se replica ENTERO. `JSON.stringify` de
        // metadatos ES la proyección que bi_replica ve (no la fila fuente). La URL no aparece
        // en NINGUNA fila — cubre el HECHO y cualquier otro escritor de AuditLog (derivados).
        const logs = await prisma.auditLog.findMany({ select: { accion: true, metadatos: true } });
        for (const log of logs) {
            expect(JSON.stringify(log.metadatos ?? {}), `la URL se coló en AuditLog.metadatos (accion ${log.accion})`).not.toContain("sala-SECRETA-xyz");
        }
        // Y el HECHO se registró (control positivo del registro).
        const hecho = logs.find((l) => JSON.stringify(l.metadatos ?? {}).includes("sesion_convocada"));
        expect(hecho, "el HECHO de la convocatoria debe quedar registrado").toBeDefined();
    });
});

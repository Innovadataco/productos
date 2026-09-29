/**
 * CANDADO · SPEC-793 — la validación de la allowlist es de SERVIDOR (probada por el camino del endpoint,
 * `publicarEnlaceSesion`, no por el formulario).
 *
 *  - FAIL-CLOSED por default: con la lista REAL (todos pendientes hoy), publicar CUALQUIER enlace se
 *    rechaza 400 en el servidor y NO persiste — la precondición correcta para el primer enlace real.
 *  - Control positivo: con un proveedor de PRUEBA aprobado inyectado, el mismo servidor SÍ publica.
 *  - El parecido no alcanza tampoco en el servidor: un look-alike se rechaza.
 *
 * Integración (BD de test). El endpoint `POST /api/operador/citas/[id]/enlace` es un delegador delgado
 * a `publicarEnlaceSesion`; probar el servicio prueba la validación de servidor que el endpoint usa.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearPaisCiudad } from "@/lib/reporte-test-utils";
import { hashPassword } from "@/lib/auth";
import { publicarEnlaceSesion } from "./enlace-sesion";
import { AppError } from "@/lib/errors";
import type { ProveedorEnlace } from "./enlace-validacion";

async function seedOperadorYCita() {
    const admin = await prisma.usuario.create({
        data: { email: `admin-${Date.now()}@test.local`, passwordHash: await hashPassword("Admin123!"), rol: "ADMIN", estado: "activo" },
    });
    const operador = await prisma.usuario.create({
        data: { email: `op-${Date.now()}@test.local`, passwordHash: await hashPassword("Op123!"), rol: "OPERADOR", estado: "activo" },
    });
    await prisma.perfilOperador.create({ data: { usuarioId: operador.id, cupoMaximo: 10, creadoPorId: admin.id } });
    const { ciudad } = await crearPaisCiudad();
    const proUser = await prisma.usuario.create({
        data: { email: `pro-${Date.now()}@test.local`, passwordHash: await hashPassword("Pro123!"), rol: "PROFESIONAL", estado: "activo" },
    });
    const prof = await prisma.perfilProfesional.create({
        data: {
            usuarioId: proUser.id, nombreVisible: "Dra.", tituloProfesional: "Psicóloga", especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id, atiendeVirtual: true, aniosExperiencia: 5, presentacion: "x", tarifaConsultaCOP: 100_000,
            duracionMinutos: 50, estado: "ACTIVO",
        },
    });
    const padre = await prisma.usuario.create({
        data: { email: `padre-${Date.now()}@test.local`, passwordHash: await hashPassword("Padre123!"), rol: "PARENT", estado: "activo", nombre: "Padre" },
    });
    const inicio = new Date(Date.now() + 2 * 3600_000);
    const franja = await prisma.franjaDisponible.create({
        data: { profesionalId: prof.id, inicio, fin: new Date(inicio.getTime() + 3000_000), modalidad: "VIRTUAL", tomada: true },
    });
    const cita = await prisma.solicitudCita.create({
        data: {
            padreUsuarioId: padre.id, profesionalId: prof.id, franjaId: franja.id, presentacion: "x", urgencia: "SIN_APURO",
            estado: "CONFIRMADA", venceEn: new Date(Date.now() + 72 * 3600_000), pagoAprobadoEn: new Date(),
            montoConsulta: 100_000, montoServicio: 10_000, montoTotal: 110_000, porcentajeServicio: 10,
            enlaceOperadorId: operador.id,
        },
    });
    return { operadorId: operador.id, citaId: cita.id };
}

const enlaceDe = (citaId: string) =>
    prisma.solicitudCita.findUnique({ where: { id: citaId }, select: { enlaceReunion: true, enlacePublicadoEn: true } });

describe("SPEC-793 · la allowlist se aplica en el SERVIDOR (publicarEnlaceSesion)", () => {
    beforeEach(async () => await resetDatabase());

    it("FAIL-CLOSED: con la lista real (todos pendientes) publicar cualquier enlace → 400 y NO persiste", async () => {
        const { operadorId, citaId } = await seedOperadorYCita();
        await expect(
            publicarEnlaceSesion({ citaId, operadorId, enlaceRaw: "https://cualquier-proveedor.example/sala-abc" }),
        ).rejects.toBeInstanceOf(AppError);
        const c = await enlaceDe(citaId);
        expect(c?.enlaceReunion, "no debe haber persistido un enlace de proveedor no aprobado").toBeNull();
        expect(c?.enlacePublicadoEn).toBeNull();
    });

    it("control positivo: con un proveedor de PRUEBA aprobado, el servidor SÍ publica y persiste", async () => {
        const { operadorId, citaId } = await seedOperadorYCita();
        const proveedores: readonly ProveedorEnlace[] = [
            { nombre: "Test", dominios: ["sala-aprobada.test"], porque: "fixture", aprobado: true },
        ];
        const r = await publicarEnlaceSesion(
            { citaId, operadorId, enlaceRaw: "https://sala-aprobada.test/xyz" },
            proveedores,
        );
        expect(r.ok).toBe(true);
        const c = await enlaceDe(citaId);
        expect(c?.enlaceReunion).toBe("https://sala-aprobada.test/xyz");
        expect(c?.enlacePublicadoEn).not.toBeNull();
    });

    it("el parecido no alcanza en el servidor: `sala-aprobada.test.atacante.co` → 400, no persiste", async () => {
        const { operadorId, citaId } = await seedOperadorYCita();
        const proveedores: readonly ProveedorEnlace[] = [
            { nombre: "Test", dominios: ["sala-aprobada.test"], porque: "fixture", aprobado: true },
        ];
        await expect(
            publicarEnlaceSesion({ citaId, operadorId, enlaceRaw: "https://sala-aprobada.test.atacante.co/x" }, proveedores),
        ).rejects.toBeInstanceOf(AppError);
        expect((await enlaceDe(citaId))?.enlaceReunion).toBeNull();
    });
});

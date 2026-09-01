/**
 * SPEC-344 (A-69 · C1) — la derivación del paso pendiente del COLEGIO.
 *
 * Misma regla que el padre (estado.test.ts): el progreso NO se guarda, se
 * deriva de los hechos. Estos tests recorren los seis resultados posibles y
 * el comportamiento que hace que el camino se sostenga solo: inactivar el
 * único estudiante devuelve al Paso 5, inactivar todos los cursos devuelve
 * al Paso 4 — sin banderas que revertir.
 *
 * El guardián de consentimiento se mockea (tiene su propio test).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
    requiereConsentimientoActual: vi.fn(),
}));

vi.mock("@/lib/consentimiento/guard", () => ({
    requiereConsentimientoActual: mocks.requiereConsentimientoActual,
}));

import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { derivarPasoPendienteColegio } from "./estado-colegio";

async function crearColegioConRector() {
    const tenant = await prisma.tenant.create({ data: { nombre: "Tenant 344" } });
    // El catálogo geográfico puede no estar sembrado en la BD de test.
    const paisId =
        (await prisma.pais.findFirst({ select: { id: true } }))?.id ??
        (await prisma.pais.create({ data: { nombre: "Colombia", codigo: "CO" } })).id;
    const ciudadId =
        (await prisma.ciudad.findFirst({ select: { id: true } }))?.id ??
        (await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId } })).id;
    const colegio = await prisma.colegio.create({
        data: {
            nombre: "Colegio Estado 344",
            nit: `344-${Date.now()}`,
            paisId,
            ciudadId,
            representanteLegalNombre: "Rector Prueba",
            representanteLegalIdentificacion: "PENDIENTE",
            representanteLegalEmail: "rector344@test.local",
            inicioServicio: new Date(),
            finServicio: null,
            tipoPeriodo: "MENSUAL",
            estado: "activo",
            tenantId: tenant.id,
        },
    });
    const usuario = await prisma.usuario.create({
        data: {
            email: `rector-${Date.now()}@test.local`,
            passwordHash: "x".repeat(60),
            rol: "SCHOOL_ADMIN",
            estado: "activo",
            colegioId: colegio.id,
            tenantId: tenant.id,
        },
    });
    return { colegio, usuario };
}

async function completarRector(usuarioId: string) {
    await prisma.usuario.update({
        where: { id: usuarioId },
        data: {
            nombre: "Marta",
            apellidos: "Restrepo",
            documentoTipo: "CC",
            documentoNumero: "79482115",
            telefono: "+573104428890",
        },
    });
}

async function agregarSuscripcion(colegioId: string, adminId: string) {
    const plan = await prisma.plan.create({
        data: {
            nombre: "Plan Test 344",
            tipoTitular: "COLEGIO",
            duracion: "MES_1",
            anio: new Date().getFullYear(),
            precioBaseUSD: 0,
            // La columna legacy `precio` sigue NOT NULL en la BD física.
            precio: 0,
            esFreemium: true,
            creadoPorAdminId: adminId,
        },
    });
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "COLEGIO",
            colegioId,
            planActualId: plan.id,
            estado: "PENDIENTE_AUTORIZACION",
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 86400000),
            monedaLocal: "COP",
            paisCliente: "CO",
            codigoReferidoPropio: `REF344-${Date.now()}`,
        },
    });
}

describe("derivarPasoPendienteColegio (SPEC-344)", () => {
    beforeEach(async () => {
        await resetDatabase(["Usuario", "Colegio", "Tenant", "Curso", "Profesor", "Alumno", "Suscripcion", "Plan"]);
        mocks.requiereConsentimientoActual.mockResolvedValue(false);
    });

    it("sin consentimiento → 'rector' (aunque tenga los 5 campos)", async () => {
        const { usuario } = await crearColegioConRector();
        await completarRector(usuario.id);
        mocks.requiereConsentimientoActual.mockResolvedValue(true);
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("rector");
    });

    it("con consentimiento pero campos del rector incompletos → 'rector'", async () => {
        const { usuario } = await crearColegioConRector();
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("rector");
    });

    it("rector completo sin suscripción → 'plan'", async () => {
        const { usuario } = await crearColegioConRector();
        await completarRector(usuario.id);
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("plan");
    });

    it("con suscripción (incluso PENDIENTE_AUTORIZACION) sin profesores → 'profesores' (regla A-67)", async () => {
        const { colegio, usuario } = await crearColegioConRector();
        await completarRector(usuario.id);
        await agregarSuscripcion(colegio.id, usuario.id);
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("profesores");
    });

    it("con profesor activo sin cursos → 'cursos'", async () => {
        const { colegio, usuario } = await crearColegioConRector();
        await completarRector(usuario.id);
        await agregarSuscripcion(colegio.id, usuario.id);
        await prisma.profesor.create({
            data: {
                colegioId: colegio.id,
                nombre: "Andrés",
                apellidos: "Mora",
                tipoDocumento: "CC",
                numeroDocumento: "80114552",
                anioNacimiento: 1985,
                sexo: "M",
                email: "am@test.local",
                telefono: "+573000000000",
                estado: "activo",
            },
        });
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("cursos");
    });

    it("con curso activo sin estudiantes → 'estudiantes'; y con estudiante → null (camino completo)", async () => {
        const { colegio, usuario } = await crearColegioConRector();
        await completarRector(usuario.id);
        await agregarSuscripcion(colegio.id, usuario.id);
        await prisma.profesor.create({
            data: {
                colegioId: colegio.id, nombre: "A", apellidos: "M", tipoDocumento: "CC",
                numeroDocumento: "80114552", anioNacimiento: 1985, sexo: "M",
                email: "am@test.local", telefono: "+573000000000", estado: "activo",
            },
        });
        const curso = await prisma.curso.create({
            data: { colegioId: colegio.id, nombre: "Grado 7º", grado: "7", anioLectivo: "2026", estado: "activo" },
        });
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("estudiantes");

        const estudiante = await prisma.estudiante.create({
            data: {
                colegioId: colegio.id, cursoId: curso.id, nombre: "Valeria", apellidos: "R",
                documentoTipo: "TI", documentoNumero: "1098552331", estado: "activo",
            },
        });
        expect(await derivarPasoPendienteColegio(usuario.id)).toBeNull();

        // El camino se SOSTIENE: inactivar el único estudiante devuelve al Paso 5.
        await prisma.estudiante.update({ where: { id: estudiante.id }, data: { estado: "inactivo" } });
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("estudiantes");

        // Y también: inactivar todos los cursos devuelve al Paso 4.
        await prisma.curso.update({ where: { id: curso.id }, data: { estado: "inactivo" } });
        expect(await derivarPasoPendienteColegio(usuario.id)).toBe("cursos");
    });

    it("usuario sin colegio asociado → 'rector' (tolerante, sin crash)", async () => {
        const tenant = await prisma.tenant.create({ data: { nombre: "T" } });
        const suelto = await prisma.usuario.create({
            data: {
                email: `suelto-${Date.now()}@test.local`,
                passwordHash: "x".repeat(60),
                rol: "SCHOOL_ADMIN",
                estado: "activo",
                tenantId: tenant.id,
            },
        });
        expect(await derivarPasoPendienteColegio(suelto.id)).toBe("rector");
    });
});

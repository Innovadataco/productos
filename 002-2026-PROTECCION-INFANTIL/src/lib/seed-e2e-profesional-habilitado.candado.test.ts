/**
 * SPEC-741 · CANDADO del fixture de profesional HABILITADO (con aceptación de autorización).
 *
 * Prueba, contra la BD, lo que corre el CEO en prod: la cuenta PASA EL MURO real
 * (`necesitaAceptar` === false, la consulta que usa `exigirProfesionalHabilitado`) y queda
 * HABILITADA; la aceptación es de la versión vigente, respalda la verificación y es PREVIA;
 * idempotente; y la cuenta va en la corrida PERSISTENTE (no la purgable), con la aceptación
 * SIN marcar (conservación, cuelga del Usuario por Cascade).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AutorizacionProfesionalService } from "@/lib/dal/services/autorizacion-profesional";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";
import { sembrarProfesionalHabilitado, CORRIDA_CUENTAS_CALIDAD } from "../../scripts/seed-e2e-profesional-habilitado";
import type { CredencialCuenta } from "../../scripts/lib/credenciales-e2e-calidad";

const CRED: CredencialCuenta = {
    clave: "PROFESIONAL",
    rol: "PROFESIONAL",
    nombre: "Profesional Calidad (E2E)",
    esProfesional: true,
    email: "calidad+e2eprofesional@innovadataco.com",
    secreto: "PruebaCalidad2026!",
};

async function sembrarBase(): Promise<string> {
    const pais = await prisma.pais.upsert({ where: { codigo: "CO" }, update: {}, create: { codigo: "CO", nombre: "Colombia" } });
    let bogota = await prisma.ciudad.findFirst({ where: { nombre: "Bogotá", paisId: pais.id }, select: { id: true } });
    bogota ??= await prisma.ciudad.create({ data: { nombre: "Bogotá", nombreNormalizado: "bogota", paisId: pais.id }, select: { id: true } });
    await crearUsuario("ADMIN", `admin.${Date.now()}@ejemplo.local`);
    // Autorización vigente (SPEC-686): resetDatabase no siembra estos parámetros. Misma ruta real
    // que prod (`public/legal/AUTORIZACION-PROFESIONAL-v0.1.md`, archivo del repo → legible acá).
    const params: ReadonlyArray<readonly [string, string]> = [
        ["autorizacion_profesional.version_actual", "v0.1"],
        ["autorizacion_profesional.documento_ruta", "public/legal/AUTORIZACION-PROFESIONAL-v0.1.md"],
        ["autorizacion_profesional.version_tipo", "FONDO"],
    ];
    for (const [clave, valor] of params) {
        await prisma.parametroSistema.upsert({
            where: { clave },
            update: { valor },
            create: { clave, valor, tipo: "STRING", categoria: "LEGAL" },
        });
    }
    return bogota.id;
}

function correr(ciudadId: string, ahora = new Date()) {
    return prisma.$transaction((tx) => sembrarProfesionalHabilitado(tx, CRED, ciudadId, ahora));
}

describe("SPEC-741 · fixture profesional HABILITADO con aceptación", () => {
    let ciudadId: string;
    beforeEach(async () => {
        await resetDatabase();
        ciudadId = await sembrarBase();
    });

    it("pasa el MURO real: necesitaAceptar=false y queda HABILITADO", async () => {
        const { resultado } = await correr(ciudadId);
        // El gate del muro (`exigirProfesionalHabilitado` → necesitaAceptar): debe dejar pasar.
        expect(await new AutorizacionProfesionalService().necesitaAceptar(resultado.usuarioId)).toBe(false);
        // Habilitado = ACTIVO + verificación aprobada vigente.
        const hab = await obtenerHabilitacionProfesional(resultado.usuarioId);
        expect(hab?.habilitado, "sin habilitación, «Mi perfil» ni siquiera se alcanza").toBe(true);
    });

    it("la aceptación es de la versión VIGENTE, respalda la verificación y es PREVIA", async () => {
        const { resultado } = await correr(ciudadId);
        expect(resultado.version).toBe(await new AutorizacionProfesionalService().versionVigente());
        const acep = await prisma.aceptacionAutorizacionProfesional.findUniqueOrThrow({
            where: { id: resultado.aceptacionId },
            select: { version: true, aceptadoEn: true },
        });
        expect(acep.version).toBe("v0.1");
        const verif = await prisma.verificacionProfesional.findUniqueOrThrow({
            where: { id: resultado.verificacionId },
            select: { aceptacionAutorizacionId: true, revisadoEn: true },
        });
        expect(verif.aceptacionAutorizacionId, "la verificación se respalda en la aceptación").toBe(resultado.aceptacionId);
        expect(acep.aceptadoEn.getTime(), "anterioridad: aceptadoEn <= revisadoEn").toBeLessThanOrEqual(verif.revisadoEn.getTime());
    });

    it("IDEMPOTENTE: la 2ª corrida no duplica cuenta, perfil, verificación ni aceptación", async () => {
        const r1 = await correr(ciudadId);
        const r2 = await correr(ciudadId);
        expect(r2.resultado.usuarioId).toBe(r1.resultado.usuarioId);
        expect(r2.resultado.perfilId).toBe(r1.resultado.perfilId);
        expect(await prisma.perfilProfesional.count({ where: { usuarioId: r1.resultado.usuarioId } })).toBe(1);
        expect(await prisma.verificacionProfesional.count({ where: { perfilProfesionalId: r1.resultado.perfilId } })).toBe(1);
        expect(await prisma.aceptacionAutorizacionProfesional.count({ where: { usuarioId: r1.resultado.usuarioId } })).toBe(1);
    });

    it("cuenta en la corrida PERSISTENTE; la aceptación NO se marca (conservación)", async () => {
        const { resultado } = await correr(ciudadId);
        const marcaUsuario = await prisma.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: resultado.usuarioId } });
        expect(
            (marcaUsuario?.metadata as { corrida?: string } | null)?.corrida,
            "la cuenta fija se marca en la corrida PERSISTENTE, no en la purgable",
        ).toBe(CORRIDA_CUENTAS_CALIDAD);
        expect(
            await prisma.demoMarcado.findFirst({ where: { entidad: "AceptacionAutorizacionProfesional", entidadId: resultado.aceptacionId } }),
            "la aceptación NO se marca demo (conservación; cuelga del Usuario por Cascade)",
        ).toBeNull();
    });
});

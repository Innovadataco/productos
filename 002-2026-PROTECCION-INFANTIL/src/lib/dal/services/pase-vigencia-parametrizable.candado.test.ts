/**
 * CANDADO · SPEC-882 (I-373) · las ventanas de seguridad del pase son PARAMETRIZABLES (sin deploy).
 *
 * `VIGENCIA_CODIGO_MS`/`VIGENCIA_SESION_MS` estaban HARDCODED en `codigo-acceso.ts`: ajustarlas exigía
 * desplegar y Calidad no podía acortarlas para probar la caducidad. Ahora se leen de `ParametroSistema`
 * (`pase.vigencia_codigo_minutos` / `pase.vigencia_sesion_minutos`) en runtime, con fallback al default.
 *
 * Control positivo: bajar el parámetro a 1 min hace que el pase/sesión caduquen a ~1 min, SIN tocar código.
 * Con el defecto (ventana hardcoded) la vigencia seguiría en 30/15 min y `delta < 5 min` fallaría. El tercer
 * caso fija el fallback: sin el parámetro sembrado, cae al default (30 min).
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { TipoParametro, CategoriaParametro } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { asegurarExpedienteParaReporte } from "@/lib/dal/services/expediente-automatico";
import { solicitarCodigoAcceso, canjearCodigoAcceso } from "@/lib/dal/services/codigo-acceso";

const MIN = 60 * 1000;

async function setVentana(clave: string, valorMin: string) {
    await prisma.parametroSistema.upsert({
        where: { clave },
        update: { valor: valorMin },
        create: { clave, valor: valorMin, tipo: TipoParametro.INTEGER, categoria: CategoriaParametro.SYSTEM },
    });
}

/** Alta real: padre + reporte + expediente. Devuelve el padre dueño y el expedienteId. */
async function nuevoExpediente() {
    const padre = await crearUsuario("PARENT");
    const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { clave: "whatsapp" } });
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `+57300V882${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            plataformaId: plataforma.id,
            texto: "relato 882",
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: padre.id,
            estado: "REVISION_MANUAL",
        },
    });
    const res = await prisma.$transaction((tx) => asegurarExpedienteParaReporte(tx, reporte.id));
    return { padre, expedienteId: res!.expedienteId };
}

describe("SPEC-882 (I-373) · ventanas del pase parametrizables (sin deploy)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
    });
    afterAll(async () => prisma.$disconnect());

    it("código: parámetro a 1 min ⇒ el pase vigente ~1 min (con el bug serían 30)", async () => {
        await setVentana("pase.vigencia_codigo_minutos", "1");
        const { padre, expedienteId } = await nuevoExpediente();
        const t0 = Date.now();
        const { vigenteHasta } = await solicitarCodigoAcceso({ expedienteId, solicitadoPorId: padre.id });
        const delta = vigenteHasta.getTime() - t0;
        expect(delta, "la ventana es la del parámetro (1 min), no la hardcoded (30)").toBeLessThan(5 * MIN);
        expect(delta, "ventana > 0 (no caduca al instante)").toBeGreaterThan(30 * 1000);
    });

    it("sesión: parámetro a 1 min ⇒ la sesión expira ~1 min tras canjear (con el bug serían 15)", async () => {
        await setVentana("pase.vigencia_sesion_minutos", "1");
        const { padre, expedienteId } = await nuevoExpediente();
        const { codigo } = await solicitarCodigoAcceso({ expedienteId, solicitadoPorId: padre.id });
        const prof = await crearUsuario("PROFESIONAL");
        const t0 = Date.now();
        const { expiraEn } = await canjearCodigoAcceso({
            codigoCrudo: codigo,
            canjeadoPor: { id: prof.id, nombre: prof.nombre, rol: "PROFESIONAL" },
        });
        const delta = expiraEn.getTime() - t0;
        expect(delta, "la sesión usa el parámetro (1 min), no la hardcoded (15)").toBeLessThan(5 * MIN);
        expect(delta, "ventana > 0 (no caduca al instante)").toBeGreaterThan(30 * 1000);
    });

    it("fallback: sin el parámetro sembrado ⇒ default 30 min (código)", async () => {
        // resetDatabase re-siembra permisos+plataformas, NO los parámetros padre → la clave no existe aquí:
        // control positivo del fallback (si alguien quitara el default, esto no daría 30).
        const faltante = await prisma.parametroSistema.findUnique({ where: { clave: "pase.vigencia_codigo_minutos" } });
        expect(faltante, "la clave NO está sembrada en la BD de test").toBeNull();
        const { padre, expedienteId } = await nuevoExpediente();
        const t0 = Date.now();
        const { vigenteHasta } = await solicitarCodigoAcceso({ expedienteId, solicitadoPorId: padre.id });
        const delta = vigenteHasta.getTime() - t0;
        expect(delta, "cae al default de 30 min").toBeGreaterThan(25 * MIN);
        expect(delta, "cae al default de 30 min").toBeLessThan(35 * MIN);
    });
});

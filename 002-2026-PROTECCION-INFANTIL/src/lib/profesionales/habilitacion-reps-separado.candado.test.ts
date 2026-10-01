/**
 * CANDADO · SPEC-790 (§7) · REPS y `habilitado` son EJES SEPARADOS. Un profesional con la habilitación
 * INTERNA en verde (ACTIVO + verificación aprobada vigente) pero el REPS VENCIDO:
 *   · `habilitado = true`  → SIGUE entrando al área profesional (la compuerta operativa NO lo bloquea);
 *   · `repsAlDia = false`  → está FUERA DE LA OFERTA (el aviso «seguís entrando pero…» = `habilitado ∧ ¬repsAlDia`).
 *
 * Plegar REPS en `habilitado` encerraría al profesional fuera de la página que le explica por qué (huevo y
 * gallina); este candado prueba que NO se plegó, que es la decisión del CEO (30-09). Integración.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { obtenerHabilitacionProfesional, exigirProfesionalHabilitadoApi } from "./habilitacion";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date();
const FUT = new Date(AHORA.getTime() + 90 * DIA);

/** Profesional ACTIVO + verificación interna vigente (habilitado interno) pero con el REPS VENCIDO. */
async function profConRepsVencido(): Promise<string> {
    const { ciudad } = await crearPaisCiudad();
    const u = await crearUsuario("PROFESIONAL");
    const p = await prisma.perfilProfesional.create({
        data: {
            usuarioId: u.id,
            nombreVisible: "Pro",
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
    const rev = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: p.id,
            revisadoPorId: rev.id,
            revisadoEn: new Date(AHORA.getTime() - 10 * DIA),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: `a-${p.id}`,
            venceEn: FUT,
        },
    });
    await prisma.verificacionReps.create({
        data: {
            profesionalId: p.id,
            verificadoEn: new Date(AHORA.getTime() - 5 * DIA),
            fuente: "MANUAL_ADMIN",
            resultado: "VENCIDA",
            vigenteHasta: null,
            modalidades: [],
        },
    });
    return u.id;
}

describe("SPEC-790 (§7) · REPS ≠ habilitado — el VENCIDO en REPS sigue entrando pero sale de la oferta", () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => prisma.$disconnect());

    it("habilitado=true (sigue operando) + repsAlDia=false (fuera de la oferta)", async () => {
        const usuarioId = await profConRepsVencido();
        const hab = await obtenerHabilitacionProfesional(usuarioId, AHORA);
        expect(hab?.habilitado, "REPS NO se pliega en habilitado — el profesional no queda encerrado").toBe(true);
        expect(hab?.repsAlDia, "pero NO está al día → el aviso «fuera de la oferta» (habilitado ∧ ¬repsAlDia)").toBe(false);
    });

    it("la compuerta operativa de API NO bloquea al REPS-vencido (habilitado=true)", async () => {
        const usuarioId = await profConRepsVencido();
        await expect(
            exigirProfesionalHabilitadoApi(usuarioId, AHORA),
            "un REPS vencido no cierra el acceso operativo del profesional",
        ).resolves.toBeDefined();
    });
});

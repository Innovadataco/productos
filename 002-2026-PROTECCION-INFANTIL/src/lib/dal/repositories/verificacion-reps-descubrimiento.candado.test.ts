/**
 * CANDADO · SPEC-801 (D-121 de Datos) — la modalidad del REPS que no sabemos traducir es CONSULTABLE.
 *
 * El entregable NO es la columna, es la CONSULTA: «¿qué modalidades sin mapear llegaron y a cuántos
 * profesionales afectaron?». Prueba los TRES criterios del radicado sobre BD corriendo:
 *   (a) la consulta contesta la pregunta con el conteo de profesionales DISTINTOS (no filas);
 *   (b) CONTROL POSITIVO: se planta una modalidad desconocida y se afirma que APARECE — sin el dato
 *       plantado el candado no probaría nada;
 *   (c) CONTROL NEGATIVO: sin modalidades sin mapear, la consulta devuelve [] (vacío, NO error).
 *
 * Integración (BD de test, reset por test). NO toca prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { modalidadesRepsNoMapeadas } from "./verificacion-reps-descubrimiento";

let contador = 0;
const uniq = (p: string) => `${p}-801-${Date.now()}-${contador++}`;
const VERIF = new Date("2026-09-15T12:00:00Z");
const VIGENCIA = new Date("2027-09-15T12:00:00Z");

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

function crearVerif(profesionalId: string, opts: { verificadoEn?: Date; noMapeadas?: string[] } = {}) {
    return prisma.verificacionReps.create({
        data: {
            profesionalId,
            verificadoEn: opts.verificadoEn ?? VERIF,
            fuente: "API",
            resultado: "VIGENTE",
            vigenteHasta: VIGENCIA,
            modalidades: ["PRESENCIAL"],
            modalidadesNoMapeadas: opts.noMapeadas ?? [],
        },
    });
}

describe("SPEC-801 · consulta de descubrimiento de modalidades REPS sin mapear", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("(c) control NEGATIVO · sin verificaciones → [] (vacío, no error)", async () => {
        await expect(modalidadesRepsNoMapeadas()).resolves.toEqual([]);
    });

    it("(c) control NEGATIVO · verificación con TODO mapeado (lista vacía) → [] (vacío, no error)", async () => {
        const p = await seedProfesional();
        await crearVerif(p.id, { noMapeadas: [] });
        await expect(modalidadesRepsNoMapeadas()).resolves.toEqual([]);
    });

    it("(a)(b) control POSITIVO · una modalidad desconocida plantada APARECE con su conteo", async () => {
        const p = await seedProfesional();
        await crearVerif(p.id, { noMapeadas: ["TELECONSULTA_HIBRIDA"] });
        const res = await modalidadesRepsNoMapeadas();
        const fila = res.find((r) => r.modalidad === "TELECONSULTA_HIBRIDA");
        expect(fila, "la modalidad plantada DEBE aparecer — si no, la consulta no descubre nada").toBeDefined();
        expect(fila?.profesionalesAfectados).toBe(1);
    });

    it("(a) cuenta profesionales DISTINTOS, no filas: mismo profesional, dos chequeos de la misma modalidad → 1", async () => {
        const p = await seedProfesional();
        await crearVerif(p.id, { verificadoEn: new Date("2026-09-01T12:00:00Z"), noMapeadas: ["VISITA_DOMICILIARIA"] });
        await crearVerif(p.id, { verificadoEn: new Date("2026-10-01T12:00:00Z"), noMapeadas: ["VISITA_DOMICILIARIA"] });
        const res = await modalidadesRepsNoMapeadas();
        const fila = res.find((r) => r.modalidad === "VISITA_DOMICILIARIA");
        expect(fila?.profesionalesAfectados, "dos chequeos del MISMO profesional cuentan una vez").toBe(1);
    });

    it("(a) agrupa por valor crudo, cuenta por profesional y ordena por impacto: X(2) antes que Y(1)", async () => {
        const p1 = await seedProfesional();
        const p2 = await seedProfesional();
        await crearVerif(p1.id, { noMapeadas: ["MODALIDAD_X"] });
        await crearVerif(p2.id, { noMapeadas: ["MODALIDAD_X"] });
        await crearVerif(p1.id, { verificadoEn: new Date("2026-10-02T12:00:00Z"), noMapeadas: ["MODALIDAD_Y"] });
        const res = await modalidadesRepsNoMapeadas();
        expect(res.find((r) => r.modalidad === "MODALIDAD_X")?.profesionalesAfectados).toBe(2);
        expect(res.find((r) => r.modalidad === "MODALIDAD_Y")?.profesionalesAfectados).toBe(1);
        const soloXY = res.filter((r) => r.modalidad === "MODALIDAD_X" || r.modalidad === "MODALIDAD_Y");
        expect(soloXY.map((r) => r.modalidad), "orden por impacto desc").toEqual(["MODALIDAD_X", "MODALIDAD_Y"]);
    });
});

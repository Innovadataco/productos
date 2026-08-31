/**
 * SPEC-320 (§2.1): tests del servicio de unicidad cross-sujeto y de la clasificación
 * duros/warns (opción A · diseño asimétrico), más la regresión de la raíz de I-213
 * (dos personas del colegio con el mismo identificador → base de la alerta duplicada).
 */
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { IdentificadorUnicidadService } from "@/lib/dal/services/identificador-unicidad";
import {
    crearColegioConAdmin,
    crearCurso,
    crearEstudiante,
    crearProfesor,
    crearAcudienteEstudiante,
    crearIdentificadorEstudiante,
    crearIdentificadorProfesor,
    crearIdentificadorAcudiente,
} from "@/lib/reporte-test-utils";

let seq = 0;
const nick = (t: string) => `nick_320_${t}_${seq++}`;

describe("IdentificadorUnicidadService (SPEC-320 §2.1)", () => {
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("buscarOtrosDuenos: encuentra otra persona del mismo colegio, no de otro colegio, y excluye al propio", async () => {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        const est1 = await crearEstudiante(curso.id, colegio.id);
        const est2 = await crearEstudiante(curso.id, colegio.id);
        const valor = nick("busca");
        await crearIdentificadorEstudiante(est1.id, { tipo: "nick", valor });

        // Mismo valor en OTRO colegio (no debe aparecer).
        const { colegio: otro } = await crearColegioConAdmin();
        const cursoOtro = await crearCurso(otro.id);
        const estOtro = await crearEstudiante(cursoOtro.id, otro.id);
        await crearIdentificadorEstudiante(estOtro.id, { tipo: "nick", valor });

        const svc = new IdentificadorUnicidadService();
        const duenos = await svc.buscarOtrosDuenos(colegio.id, valor, { sujeto: "ESTUDIANTE", sujetoId: est2.id });
        expect(duenos).toHaveLength(1);
        expect(duenos[0]?.sujeto).toBe("ESTUDIANTE");
        expect(duenos[0]?.sujetoId).toBe(est1.id);

        // Excluyendo al dueño real → vacío (no se auto-reporta al editar).
        const propios = await svc.buscarOtrosDuenos(colegio.id, valor, { sujeto: "ESTUDIANTE", sujetoId: est1.id });
        expect(propios).toHaveLength(0);
    });

    it("clasificarColision: estudiante↔estudiante = DURO (bloqueo, sin override) — I-213", async () => {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        const est1 = await crearEstudiante(curso.id, colegio.id);
        const est2 = await crearEstudiante(curso.id, colegio.id);
        const valor = nick("est_est");
        await crearIdentificadorEstudiante(est1.id, { tipo: "nick", valor });

        const { duros, warns } = await new IdentificadorUnicidadService().clasificarColision(
            colegio.id, valor, "ESTUDIANTE", { sujeto: "ESTUDIANTE", sujetoId: est2.id }
        );
        expect(duros).toHaveLength(1);
        expect(warns).toHaveLength(0);
    });

    it("clasificarColision: profesor↔profesor = DURO", async () => {
        const { colegio } = await crearColegioConAdmin();
        const prof1 = await crearProfesor(colegio.id);
        const prof2 = await crearProfesor(colegio.id);
        const valor = nick("prof_prof");
        await crearIdentificadorProfesor(prof1.id, colegio.id, { tipo: "nick", valor });

        const { duros, warns } = await new IdentificadorUnicidadService().clasificarColision(
            colegio.id, valor, "PROFESOR", { sujeto: "PROFESOR", sujetoId: prof2.id }
        );
        expect(duros).toHaveLength(1);
        expect(warns).toHaveLength(0);
    });

    it("clasificarColision: cross-sujeto profesor↔estudiante = WARN (override, misma persona en dos roles)", async () => {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        const est = await crearEstudiante(curso.id, colegio.id);
        const prof = await crearProfesor(colegio.id);
        const valor = nick("cross");
        await crearIdentificadorEstudiante(est.id, { tipo: "nick", valor });

        const { duros, warns } = await new IdentificadorUnicidadService().clasificarColision(
            colegio.id, valor, "PROFESOR", { sujeto: "PROFESOR", sujetoId: prof.id }
        );
        expect(duros).toHaveLength(0);
        expect(warns).toHaveLength(1);
        expect(warns[0]?.sujeto).toBe("ESTUDIANTE");
    });

    it("clasificarColision: acudiente↔acudiente = WARN (padre-de-dos-hijos, legítimo)", async () => {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        const est1 = await crearEstudiante(curso.id, colegio.id);
        const est2 = await crearEstudiante(curso.id, colegio.id);
        const ac1 = await crearAcudienteEstudiante(est1.id, { orden: 1 });
        const ac2 = await crearAcudienteEstudiante(est2.id, { orden: 1 });
        const valor = nick("ac_ac");
        await crearIdentificadorAcudiente(ac1.id, colegio.id, { tipo: "nick", valor });

        const { duros, warns } = await new IdentificadorUnicidadService().clasificarColision(
            colegio.id, valor, "ACUDIENTE", { sujeto: "ACUDIENTE", sujetoId: ac2.id }
        );
        expect(duros).toHaveLength(0);
        expect(warns).toHaveLength(1);
        expect(warns[0]?.sujeto).toBe("ACUDIENTE");
    });

    it("G1 regresión: la BD rechaza dos estudiantes del colegio con el mismo identificador (raíz de la alerta duplicada I-213)", async () => {
        const { colegio } = await crearColegioConAdmin();
        const curso = await crearCurso(colegio.id);
        const est1 = await crearEstudiante(curso.id, colegio.id);
        const est2 = await crearEstudiante(curso.id, colegio.id);
        const valor = nick("g1");
        await crearIdentificadorEstudiante(est1.id, { tipo: "nick", valor, plataformaId: null });
        // Segundo estudiante, mismo (colegio,tipo,valor,plataforma NULL) → índice único
        // parcial NULLS NOT DISTINCT lo rechaza. Sin esta red, alertas.ts generaba una
        // alerta por cada persona que compartía el identificador.
        await expect(
            crearIdentificadorEstudiante(est2.id, { tipo: "nick", valor, plataformaId: null })
        ).rejects.toThrow();
    });
});

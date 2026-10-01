/**
 * CANDADO · SPEC-790 (T4) · el mirror puro ↔ el enum de Prisma. El motor de elegibilidad vive en la lane
 * UNIT (sin base), por eso `reps-elegibilidad.ts` define su propio `ESTADOS_REPS`/`MODALIDADES_REPS` en vez
 * de importar el enum. Este candado los ATA a los enums que firmó Datos (`EstadoReps`/`ModalidadReps`): si
 * alguno gana o pierde un valor, el mirror y el enum divergen y esto cae. Sin este candado, el mirror
 * podría quedarse viejo y el motor decidir sobre un conjunto de estados que ya no es el de la base.
 */
import { describe, it, expect } from "vitest";
import { EstadoReps, ModalidadReps } from "@prisma/client";
import { ESTADOS_REPS, MODALIDADES_REPS } from "./reps-elegibilidad";

describe("SPEC-790 · paridad mirror↔Prisma de los enums REPS", () => {
    it("ESTADOS_REPS === Object.values(EstadoReps) (mismo conjunto)", () => {
        expect([...ESTADOS_REPS].sort()).toEqual([...Object.values(EstadoReps)].sort());
    });

    it("MODALIDADES_REPS === Object.values(ModalidadReps)", () => {
        expect([...MODALIDADES_REPS].sort()).toEqual([...Object.values(ModalidadReps)].sort());
    });
});

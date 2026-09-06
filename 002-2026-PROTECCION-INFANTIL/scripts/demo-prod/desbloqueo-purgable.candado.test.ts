/**
 * SPEC-516 · candado: la siembra de desbloqueo es PURGABLE.
 *
 * El requisito duro del CEO es que todo lo sembrado se pueda levantar con la
 * purga. Las dos entidades que la purga NO cubría antes de esta SPEC:
 *  1. `IdentificadorReportado` de PA-16 (se crea sin Reporte propio → ni la fase
 *     reporte-derivada ni la fase 4 lo levantan): debe estar en `ORDEN_BORRADO`.
 *  2. La cadena de `Expediente` (padre-derivada): `purgar-demo` debe borrar
 *     AclaracionExpediente/InformeConsolidado/Expediente por `expedienteId`.
 *
 * Muere por mutación: quitar `IdentificadorReportado` de `ORDEN_BORRADO`, o
 * quitar la cadena de expediente de `purgar-demo`, deja este test rojo.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ORDEN_BORRADO } from "./lib/orden-borrado";

describe("SPEC-516 · la siembra de desbloqueo es purgable", () => {
    it("ORDEN_BORRADO incluye IdentificadorReportado (PA-16 sin Reporte propio)", () => {
        expect(ORDEN_BORRADO).toContain("IdentificadorReportado");
    });

    it("purgar-demo borra la cadena de expediente por expedienteId, antes de Usuario", () => {
        const fuente = fs.readFileSync(path.join(import.meta.dirname ?? ".", "purgar-demo.ts"), "utf-8");
        for (const modelo of ["aclaracionExpediente", "informeConsolidado", "expediente"]) {
            expect(fuente).toContain(`prisma.${modelo}.deleteMany`);
        }
        // La cadena usa `expedienteIds` y va ANTES del loop de ORDEN_BORRADO
        // (que borra Usuario): Expediente.padreUsuarioId es NOT NULL.
        const idxCadena = fuente.indexOf("expedienteIds.length > 0");
        const idxLoop = fuente.indexOf("for (const entidad of ORDEN_BORRADO)");
        expect(idxCadena).toBeGreaterThan(0);
        expect(idxCadena).toBeLessThan(idxLoop);
    });
});

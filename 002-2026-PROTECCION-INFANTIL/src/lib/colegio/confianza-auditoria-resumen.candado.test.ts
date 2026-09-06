/**
 * SPEC-576 (I-358) · CANDADO — el «Resumen» del historial es una LISTA DECLARADA, no un pretty-print:
 * cada acción muestra SOLO sus campos de allowlist en español, los ids internos NUNCA, y una acción no
 * mapeada da «—» (null), JAMÁS el payload. Es el candado que cierra el canal, no el que tapa el síntoma
 * — si el origen volviera a reenviar el JSON, estas aserciones mueren.
 */
import { describe, it, expect } from "vitest";
import {
    resumenAuditoriaColegio,
    accionLabelColegio,
    ACCIONES_CON_RESUMEN,
} from "./confianza-auditoria-resumen";

describe("SPEC-576 · resumen declarado, nunca el payload (I-358)", () => {
    it("integrante de comité → nombres/apellidos/cargo, y NO el comiteId", () => {
        const r = resumenAuditoriaColegio(
            "COLEGIO_COMITE_INTEGRANTE_CREADO",
            JSON.stringify({ comiteId: "cmt_SECRETO_INTERNO", nombres: "Ana", apellidos: "Gómez", cargo: "Coordinadora" }),
        );
        expect(r).toBe("Se agregó a Ana Gómez como Coordinadora del comité.");
        expect(r).not.toContain("cmt_SECRETO_INTERNO");
    });

    it("informe mensual → usa mes, oculta bytes", () => {
        const r = resumenAuditoriaColegio(
            "COLEGIO_INFORME_MENSUAL_PDF_DESCARGADO",
            JSON.stringify({ mes: "2026-07", bytes: 123456 }),
        );
        expect(r).toBe("Se descargó el informe mensual de 2026-07.");
        expect(r).not.toContain("123456");
    });

    it("usuario invitado → email + rol humanizado, oculta estadoActivacion y el enum crudo del rol", () => {
        const r = resumenAuditoriaColegio(
            "COLEGIO_COMITE_CREADO",
            JSON.stringify({ email: "ana@colegio.edu.co", rol: "COMITE_CONVIVENCIA", estadoActivacion: "INVITADO" }),
        );
        expect(r).toBe("Se invitó a ana@colegio.edu.co como Comité de convivencia.");
        expect(r).not.toContain("INVITADO");
        expect(r).not.toContain("COMITE_CONVIVENCIA");
    });

    it("alerta → tipoSujeto humanizado, oculta reporteId/identificador*Id/colegioId", () => {
        const r = resumenAuditoriaColegio(
            "COLEGIO_ALERTA_CREADA",
            JSON.stringify({ tipoSujeto: "ESTUDIANTE", reporteId: "rpt_X", identificadorEstudianteId: "ide_Y", colegioId: "col_Z" }),
        );
        expect(r).toBe("Se creó una alerta sobre un estudiante.");
        for (const secreto of ["rpt_X", "ide_Y", "col_Z"]) expect(r).not.toContain(secreto);
    });

    it("aviso → tipoEvento humanizado, oculta entidadId y dia", () => {
        const r = resumenAuditoriaColegio(
            "COLEGIO_AVISO_ENVIADO",
            JSON.stringify({ tipoEvento: "UMBRAL_CURSO", entidadId: "ent_X", dia: "2026-07-10" }),
        );
        expect(r).toBe("Se envió un aviso: umbral de curso.");
        expect(r).not.toContain("ent_X");
    });

    it("estadísticas y USER_CREATE → frase fija, sin filtrar ningún campo del payload", () => {
        expect(
            resumenAuditoriaColegio("COLEGIO_ESTADISTICAS_PDF_DESCARGADO", JSON.stringify({ colegioId: "col_X", timestamp: "t" })),
        ).toBe("Se descargó el PDF de estadísticas.");
        const user = resumenAuditoriaColegio("USER_CREATE", JSON.stringify({ email: "demo@x.co" }));
        expect(user).toBe("Se creó un usuario de demostración.");
        expect(user).not.toContain("demo@x.co");
    });

    it("ACCIÓN NO MAPEADA → null (→ «—»), NUNCA el payload — aunque traiga algo sensible", () => {
        const payload = JSON.stringify({ textoReporte: "contenido sensible de un menor", secreto: "xyz-123" });
        const r = resumenAuditoriaColegio("ALGUNA_ACCION_FUTURA_CON_PAYLOAD", payload);
        expect(r, "una acción sin renderer declarado no puede volcar el JSON").toBeNull();
    });

    it("campo requerido ausente → null, no una frase a medias", () => {
        expect(resumenAuditoriaColegio("COLEGIO_COMITE_INTEGRANTE_CREADO", JSON.stringify({ comiteId: "x" }))).toBeNull();
    });

    it("payload ilegible o no-objeto → null, jamás el crudo (seguro por defecto)", () => {
        expect(resumenAuditoriaColegio("COLEGIO_COMITE_INTEGRANTE_CREADO", "{no es json")).toBeNull();
        expect(resumenAuditoriaColegio("USER_CREATE", "[1,2,3]")).toBeNull();
    });

    it("toda acción con renderer declarado tiene también rótulo humano (columna «Acción»)", () => {
        for (const accion of ACCIONES_CON_RESUMEN) {
            expect(accionLabelColegio(accion), `${accion} debería tener rótulo humano`).not.toBe(accion);
        }
    });
});

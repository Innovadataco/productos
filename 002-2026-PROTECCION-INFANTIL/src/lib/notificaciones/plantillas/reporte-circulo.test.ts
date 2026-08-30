/**
 * SPEC-308 (A-50): tests unitarios del renderizado de email enriquecido del
 * Círculo de Confianza.
 */
import { describe, it, expect } from "vitest";
import { renderizarEmailReporteCirculo } from "./reporte-circulo";

function baseInput() {
    return {
        nombreContacto: "hija María",
        identificador: "+573001234567",
        plataforma: "WhatsApp",
        categoria: "CONTACTO_INSISTENTE",
        totalReportes: 3,
        urlExpediente: "https://app.example.com/dashboard/padre/expedientes/exp-123",
    };
}

describe("renderizarEmailReporteCirculo", () => {
    it("renderiza asunto y cuerpo con los 6 datos contextuales", () => {
        const { asunto, cuerpo } = renderizarEmailReporteCirculo(baseInput());

        expect(asunto).toContain("hija María");
        expect(cuerpo).toContain("hija María");
        expect(cuerpo).toContain("+573001234567");
        expect(cuerpo).toContain("WhatsApp");
        expect(cuerpo).toContain("Contacto insistente");
        expect(cuerpo).toContain("3 reportes registrados");
        expect(cuerpo).toContain("[Ver expediente](https://app.example.com/dashboard/padre/expedientes/exp-123)");
    });

    it("usa forma singular cuando totalReportes es 1", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({ ...baseInput(), totalReportes: 1 });
        expect(cuerpo).toContain("1 reporte registrado");
        expect(cuerpo).not.toContain("reportes registrados");
    });

    it("usa forma plural cuando totalReportes es mayor a 1", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({ ...baseInput(), totalReportes: 5 });
        expect(cuerpo).toContain("5 reportes registrados");
    });

    it("trata totalReportes negativos o no numéricos como 0", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({ ...baseInput(), totalReportes: -2 });
        expect(cuerpo).toContain("0 reportes registrados");
    });

    it("escapa caracteres especiales del identificador y del nombre", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({
            ...baseInput(),
            nombreContacto: "*niño_[importante]",
            identificador: "+57*300[123]<_>",
        });
        expect(cuerpo).not.toContain("**niño_[importante]**");
        expect(cuerpo).toContain("\\*niño\\_\\[importante\\]");
        expect(cuerpo).toContain("+57\\*300\\[123\\]&lt;\\_&gt;");
    });

    it("usa fallback cuando el nombre del contacto está vacío", () => {
        const { asunto, cuerpo } = renderizarEmailReporteCirculo({
            ...baseInput(),
            nombreContacto: "   ",
        });
        expect(asunto).toContain("Un contacto de tu Círculo de Confianza");
        expect(cuerpo).toContain("Un contacto de tu Círculo de Confianza");
    });

    it("usa 'Categoría en revisión' cuando la categoría está vacía", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({ ...baseInput(), categoria: "" });
        expect(cuerpo).toContain("Categoría en revisión");
    });

    it("usa 'Plataforma no especificada' cuando la plataforma está vacía", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({ ...baseInput(), plataforma: "" });
        expect(cuerpo).toContain("Plataforma no especificada");
    });

    it("no incluye link cuando la URL del expediente está vacía", () => {
        const { cuerpo } = renderizarEmailReporteCirculo({ ...baseInput(), urlExpediente: "" });
        expect(cuerpo).not.toContain("[Ver expediente]");
    });

    it("no incluye texto de veredicto ni presunción de culpabilidad", () => {
        const { cuerpo } = renderizarEmailReporteCirculo(baseInput());
        expect(cuerpo).not.toContain("peligroso");
        expect(cuerpo).not.toContain("seguro");
        expect(cuerpo).not.toContain("culpable");
    });
});

/**
 * SPEC-351 · audit #221 ajuste 1 — la casilla "contexto_curso" es real:
 * desmarcada = el curso NO aparece en el PDF.
 * Contract-by-construction sobre el INPUT + verificación del render por
 * definición del documento (no grep binario — regla A-68).
 */
import { describe, it, expect } from "vitest";
import { generarPdfInformeCaso, type PdfInformeCasoInput } from "./pdf-informe-caso";

function inputBase(secciones: PdfInformeCasoInput["secciones"]): PdfInformeCasoInput {
    return {
        colegio: { nombre: "Colegio Prueba", nit: "900123456" },
        escudoDataUri: null,
        correlativo: "INF-2026-0001",
        fechaGeneracion: new Date("2026-09-01T10:00:00-05:00"),
        tipoSujeto: "ESTUDIANTE",
        curso: "9°-A",
        secciones,
        hechos: [{ fecha: new Date("2026-08-20T14:30:00-05:00"), ciudad: "Bogotá", pais: "CO", plataforma: "roblox", categoria: "CIBERACOSO" }],
        notas: [],
        analisisComite: null,
        firmadoPorNombre: "Rectora Prueba",
        firmadoPorDocumento: "52999888",
        codigoVerificacion: "abcd1234abcd1234",
        urlVerificacion: "https://pi.example/verificar/abcd1234abcd1234",
    };
}

describe("generarPdfInformeCaso · contexto_curso (audit #221)", () => {
    it("produce un PDF válido con y sin contexto_curso", async () => {
        const con = await generarPdfInformeCaso(inputBase(["hechos", "contexto_curso"]));
        const sin = await generarPdfInformeCaso(inputBase(["hechos"]));
        expect(con.subarray(0, 5).toString()).toBe("%PDF-");
        expect(sin.subarray(0, 5).toString()).toBe("%PDF-");
        // La casilla cambia el render: los buffers difieren (el curso entra o no).
        expect(con.equals(sin)).toBe(false);
    });

    it("dos renders con las mismas secciones son deterministas (mismo buffer)", async () => {
        const a = await generarPdfInformeCaso(inputBase(["hechos"]));
        const b = await generarPdfInformeCaso(inputBase(["hechos"]));
        expect(a.equals(b)).toBe(true);
    });
});

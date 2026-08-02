import { describe, it, expect } from "vitest";
import {
    PLANTILLAS_DENUNCIA,
    PLANTILLA_DENUNCIA_GENERICA,
    plantillasDenunciaUnicas,
    armarContenidoDenuncia,
    generarPdfDenuncia,
    type DatosDenuncia,
} from "./pdf-denuncia";

const CANAL = {
    nombre: "Línea 141 ICBF",
    contacto: "141",
    descripcion: "Línea gratuita del ICBF para reportar riesgos contra niños, niñas y adolescentes",
};
const CANAL_2 = {
    nombre: "Te Protejo",
    contacto: "https://teprotejo.org",
    descripcion: "Canal para reportar material de abuso sexual infantil en internet",
};

function datosBase(overrides: Partial<DatosDenuncia> = {}): DatosDenuncia {
    return {
        canalDestino: CANAL,
        canales: [CANAL, CANAL_2],
        identificador: "+573001112233",
        plataforma: "WhatsApp",
        fechaIncidente: new Date("2026-07-10T10:00:00Z"),
        ciudad: "Bogotá",
        pais: "Colombia",
        conductas: ["SOLICITUD_MATERIAL"],
        numeroSeguimiento: "RPT-TEST-140",
        fechaGeneracion: new Date("2026-08-02T15:00:00Z"),
        ...overrides,
    };
}

describe("pdf-denuncia — plantillas deterministas (SPEC-140, D-23)", () => {
    it("cada conducta conocida tiene plantilla propia (nunca IA)", () => {
        for (const conducta of ["COMPARTIMIENTO_SEXUAL", "SOLICITUD_MATERIAL", "EXTORSION", "DOXING"]) {
            expect(PLANTILLAS_DENUNCIA[conducta]).toBeDefined();
            expect(PLANTILLAS_DENUNCIA[conducta].hecho.length).toBeGreaterThan(0);
        }
    });

    it("conducta sin plantilla específica (OTRO, SPAM, desconocida) usa la genérica", () => {
        expect(plantillasDenunciaUnicas(["OTRO"])[0]).toBe(PLANTILLA_DENUNCIA_GENERICA);
        expect(plantillasDenunciaUnicas(["SPAM"])[0]).toBe(PLANTILLA_DENUNCIA_GENERICA);
        expect(plantillasDenunciaUnicas(["NO_EXISTE"])[0]).toBe(PLANTILLA_DENUNCIA_GENERICA);
        expect(plantillasDenunciaUnicas([])[0]).toBe(PLANTILLA_DENUNCIA_GENERICA);
    });

    it("deduplica plantillas por texto de hecho", () => {
        const unicas = plantillasDenunciaUnicas(["OTRO", "SPAM", "SOLICITUD_MATERIAL"]);
        expect(unicas).toHaveLength(2);
    });

    it("el contenido usa lenguaje descriptivo/estadístico (presunción de inocencia)", () => {
        const { hechos } = armarContenidoDenuncia(datosBase({ conductas: ["EXTORSION"] }));
        expect(hechos[0]).toMatch(/^Se registraron reportes que describen /);
        expect(hechos[0]).not.toMatch(/peligros|culpable|veredicto/i);
    });

    it("genera un PDF válido (%PDF) por los canales y plantillas dadas", async () => {
        const buffer = await generarPdfDenuncia(datosBase());
        expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
        expect(buffer.length).toBeGreaterThan(1000);
    });

    it("DETERMINISTA: mismos datos (incluida fechaGeneracion) → PDF byte-idéntico", async () => {
        const a = await generarPdfDenuncia(datosBase());
        const b = await generarPdfDenuncia(datosBase());
        expect(Buffer.compare(a, b)).toBe(0);
    });

    it("sin canales configurados el PDF se genera igual (degradación elegante)", async () => {
        const buffer = await generarPdfDenuncia(datosBase({ canales: [] }));
        expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    });
});

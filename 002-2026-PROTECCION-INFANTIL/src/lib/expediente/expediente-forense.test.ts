import { describe, it, expect } from "vitest";
import { armarExpedienteForense, extraerConductas, generarPdfForense } from "./expediente-forense";
import type { ReporteExpediente } from "./expediente";

/**
 * SPEC-140 (N-4, FR-006): la vista forense se arma por WHITELIST. Estos tests
 * siembran un reporte con TODOS los campos sensibles del modelo (identidad del
 * denunciante, IP, huella, texto) y verifican su AUSENCIA en la salida.
 */

function reporteCompleto(): ReporteExpediente {
    return {
        id: "rep-1",
        identificador: "+573009998877",
        plataformaId: "plat-1",
        texto: "TEXTO ANONIMIZADO QUE NO DEBE SALIR",
        textoOriginal: "TEXTO ORIGINAL QUE NO DEBE SALIR",
        fechaIncidente: new Date("2026-07-01T10:00:00Z"),
        ciudad: "Medellín",
        pais: "Colombia",
        paisId: null,
        ciudadId: null,
        otraPlataforma: null,
        estado: "CLASIFICADO",
        esAnonimo: false,
        edadVictima: 12,
        usuarioId: "usuario-denunciante-SECRETO",
        operadorId: "op-1",
        comiteId: null,
        reporteOrigenId: null,
        numeroSeguimiento: "RPT-FOR-1",
        tenantId: "tenant-SECRETO",
        processingError: null,
        prioridadAlta: false,
        keywordsDetectadas: [],
        esRafaga: false,
        fuenteConfianza: 0.9,
        eliminado: false,
        motivoBaja: null,
        notaBaja: null,
        eliminadoEn: null,
        eliminadoPorId: null,
        anonimizacionValidadaPorId: null,
        anonimizacionValidadaEn: null,
        creadoEn: new Date("2026-07-02T10:00:00Z"),
        actualizadoEn: new Date("2026-07-03T10:00:00Z"),
        plataforma: { nombre: "WhatsApp" },
        fuente: {
            id: "fuente-1",
            reporteId: "rep-1",
            pesoAplicado: 0.8,
            cuentaDiasAntiguedad: 30,
            reportesPrevios: 1,
            reportesConfirmados: 1,
            reportesDescartados: 0,
            ipHash: "iphash-SECRETO",
            fingerprintHash: "fphash-SECRETO",
            creadoEn: new Date("2026-07-02T10:00:00Z"),
        },
        embedding: null,
        clasificacion: {
            id: "clas-1",
            reporteId: "rep-1",
            categoria: "EXTORSION",
            confianza: 0.9,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "test",
            latenciaMs: 100,
            promptTokens: null,
            responseTokens: null,
            rawResponse: "raw-SECRETO",
            categoriasSecundarias: [{ categoria: "CONTACTO_INSISTENTE" }],
            votos: null,
            usoCascada: false,
            modeloCascada: null,
            posibleAgresorPar: false,
            creadoEn: new Date("2026-07-02T11:00:00Z"),
            rubricaVotos: [],
        },
        transiciones: [
            {
                id: "tr-1",
                reporteId: "rep-1",
                estadoAnterior: "PENDIENTE",
                estadoNuevo: "CLASIFICADO",
                responsableTipo: "SISTEMA",
                responsableId: null,
                motivo: null,
                metadatos: null,
                creadoEn: new Date("2026-07-02T12:00:00Z"),
            },
        ],
        reintentos: [],
    } as unknown as ReporteExpediente;
}

describe("armarExpedienteForense — whitelist de campos autorizados (SPEC-140, SC-003)", () => {
    it("contiene solo los campos autorizados (lista cerrada)", () => {
        const forense = armarExpedienteForense(reporteCompleto(), 5);
        expect(Object.keys(forense).sort()).toEqual([
            "ciudad",
            "conductas",
            "conteoReportesIdentificador",
            "creadoEn",
            "descripcionConductas",
            "estadoActual",
            "fechaIncidente",
            "identificador",
            "origen",
            "pais",
            "plataforma",
            "traza",
        ]);
        expect(forense.identificador).toBe("+573009998877");
        expect(forense.plataforma).toBe("WhatsApp");
        expect(forense.origen).toBe("cuenta registrada");
        expect(forense.conteoReportesIdentificador).toBe(5);
        expect(forense.conductas).toEqual(["EXTORSION", "CONTACTO_INSISTENTE"]);
        expect(forense.traza).toHaveLength(1);
        expect(Object.keys(forense.traza[0]).sort()).toEqual([
            "creadoEn",
            "estadoAnterior",
            "estadoNuevo",
            "responsableTipo",
        ]);
    });

    it("NUNCA expone identidad del denunciante, IP, huella, texto ni tenant", () => {
        const forense = armarExpedienteForense(reporteCompleto(), 5);
        const json = JSON.stringify(forense);
        expect(json).not.toContain("usuario-denunciante-SECRETO");
        expect(json).not.toContain("usuarioId");
        expect(json).not.toContain("iphash-SECRETO");
        expect(json).not.toContain("fphash-SECRETO");
        expect(json).not.toContain("TEXTO ANONIMIZADO QUE NO DEBE SALIR");
        expect(json).not.toContain("TEXTO ORIGINAL QUE NO DEBE SALIR");
        expect(json).not.toContain("raw-SECRETO");
        expect(json).not.toContain("tenant-SECRETO");
        expect(json).not.toContain("fuenteConfianza");
    });

    it("reporte anónimo: origen 'anónimo' (sin resolver identidad)", () => {
        const reporte = reporteCompleto();
        reporte.esAnonimo = true;
        reporte.usuarioId = null;
        const forense = armarExpedienteForense(reporte, null);
        expect(forense.origen).toBe("anónimo");
        expect(forense.conteoReportesIdentificador).toBeNull();
    });

    it("sin clasificación: conductas vacías (sin romper)", () => {
        const reporte = reporteCompleto();
        reporte.clasificacion = null;
        const forense = armarExpedienteForense(reporte, null);
        expect(forense.conductas).toEqual([]);
        expect(forense.descripcionConductas).toEqual([]);
    });
});

describe("extraerConductas", () => {
    it("categoría principal + secundarias, deduplicadas y en orden estable", () => {
        const clasificacion = reporteCompleto().clasificacion;
        expect(extraerConductas(clasificacion)).toEqual(["EXTORSION", "CONTACTO_INSISTENTE"]);
        expect(extraerConductas(null)).toEqual([]);
    });
});

describe("generarPdfForense", () => {
    it("genera un PDF válido y DETERMINISTA con la misma fecha de generación", async () => {
        const forense = armarExpedienteForense(reporteCompleto(), 5);
        const fecha = new Date("2026-08-02T15:00:00Z");
        const a = await generarPdfForense(forense, fecha);
        const b = await generarPdfForense(forense, fecha);
        expect(a.subarray(0, 5).toString("latin1")).toBe("%PDF-");
        expect(Buffer.compare(a, b)).toBe(0);
    });
});

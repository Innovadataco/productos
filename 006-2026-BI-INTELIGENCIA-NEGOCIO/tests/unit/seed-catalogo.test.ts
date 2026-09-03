// tests/unit/seed-catalogo.test.ts · Contrato estático del catálogo del chat
// Producto 006 · BI v2 · Auditoría BI vs PI 2026-09-03 (DEFECTO 2) · candado
//
// La CI corre sin réplica, así que el guardián dinámico (scripts/verify-catalogo.ts)
// vive en el deploy. Este test es su brazo estático: valida el SEED del catálogo
// contra el esquema REAL medido en bi-db el 03-09-2026 (information_schema,
// resultado de las consultas de la auditoría). Si alguien reintroduce una tabla
// fuera de la publicación, un nombre de modelo Prisma en vez del nombre real
// en BD, una columna fantasma o el dominio de estados inventado, la CI se
// pone roja sin necesidad de base de datos.

import { describe, expect, it } from "vitest";
import { COLUMNAS, EJEMPLOS, METRICAS, TABLAS } from "../../prisma/seed";

/** Tablas retiradas/fuera de la publicación o que PI dejó de escribir. Jamás deben volver al catálogo. */
const TABLAS_VETADAS = ["Subscription", "BillingCycle", "HijoPadre", "ClasificacionRubricaVoto"];

/** Dominio de estados REAL de Reporte.estado (verificado en PI el 03-09-2026). */
const DOMINIO_ESTADOS_REAL = ["CLASIFICADO", "REVISION_MANUAL", "POSIBLE_SPAM", "DUPLICADO"];

/**
 * Columnas reales medidas hoy con information_schema de bi-db (auditoría).
 * Solo tablas completamente verificadas; el resto las cubre el guardián
 * dinámico en deploy.
 */
const COLUMNAS_REALES: Record<string, string[]> = {
    Reporte: [
        "id", "plataformaId", "fechaIncidente", "ciudad", "pais", "estado", "esAnonimo",
        "reporteOrigenId", "numeroSeguimiento", "tenantId", "creadoEn", "actualizadoEn",
        "paisId", "ciudadId", "otraPlataforma", "edadVictima", "keywordsDetectadas",
        "prioridadAlta", "esRafaga", "eliminado", "eliminadoEn", "motivoBaja",
        "fuenteConfianza", "anonimizacionValidadaEn", "origenRol", "reportePrincipalId",
    ],
    SolicitudComite: [
        "id", "reporteId", "numero", "estado", "comiteId", "operadorId", "motivo",
        "resolucion", "creadoEn", "resueltoEn", "alertaColegioId", "colegioId",
        "creadoPorId", "integranteFirmanteId",
    ],
    Alumno: ["id", "cursoId", "colegioId", "estado", "createdAt", "updatedAt"],
    AuditLog: [
        "id", "accion", "tipoRecurso", "recursoId", "usuarioId", "parametroId",
        "metadatos", "creadoEn", "colegioId",
    ],
    Colegio: [
        "id", "nombre", "paisId", "departamentoId", "ciudadId", "direccion",
        "inicioServicio", "finServicio", "tipoPeriodo", "estado", "tenantId",
        "creadoEn", "actualizadoEn", "nit",
    ],
    CorreccionAdmin: [
        "id", "clasificacionId", "categoriaOriginal", "categoriaCorregida",
        "adminId", "motivo", "creadoEn", "confirmada",
    ],
    FuenteReporte: [
        "id", "reporteId", "ipHash", "fingerprintHash", "cuentaDiasAntiguedad",
        "reportesPrevios", "reportesConfirmados", "reportesDescartados",
        "pesoAplicado", "creadoEn",
    ],
    Tenant: ["id", "nombre", "estado", "creadoEn"],
    clasificacion_rubrica_votos: [
        "id", "clasificacionIAId", "modelo", "categoria", "cumple", "preguntasJson", "creadoEn",
    ],
};

const nombresTablas = TABLAS.map((t) => t.nombreFuente);

describe("catálogo del chat · tablas vetadas (DEFECTO 2)", () => {
    it("ninguna tabla vetada vuelve al catálogo", () => {
        for (const vetada of TABLAS_VETADAS) {
            expect(nombresTablas).not.toContain(vetada);
        }
    });

    it("el jurado de IA se declara con su nombre REAL en BD (@@map de PI)", () => {
        expect(nombresTablas).toContain("clasificacion_rubrica_votos");
        expect(nombresTablas).not.toContain("ClasificacionRubricaVoto");
    });
});

describe("catálogo del chat · columnas reales (DEFECTO 2)", () => {
    it("toda columna declarada de una tabla verificada existe en el esquema real", () => {
        const errores: string[] = [];
        for (const col of COLUMNAS) {
            const reales = COLUMNAS_REALES[col.tabla];
            if (!reales) continue; // tablas no medidas hoy: las cubre el guardián dinámico
            if (!reales.includes(col.nombreFuente)) {
                errores.push(`${col.tabla}.${col.nombreFuente}`);
            }
        }
        expect(errores, `columnas fantasma reintroducidas: ${errores.join(", ")}`).toEqual([]);
    });

    it("Reporte.estado enseña el dominio REAL de valores, no el inventado", () => {
        const estado = COLUMNAS.find((c) => c.tabla === "Reporte" && c.nombreFuente === "estado");
        expect(estado).toBeDefined();
        for (const valor of DOMINIO_ESTADOS_REAL) {
            expect(estado?.descripcion).toContain(valor);
        }
        // El dominio inventado de la auditoría no debe reaparecer.
        expect(estado?.descripcion).not.toContain("PENDIENTE · REVISION");
        expect(estado?.descripcion).not.toContain("CERRADO");
    });

    it("CorreccionAdmin se liga por clasificacionId (reporteId directo no existe)", () => {
        const cols = COLUMNAS.filter((c) => c.tabla === "CorreccionAdmin").map((c) => c.nombreFuente);
        expect(cols).toContain("clasificacionId");
        expect(cols).toContain("categoriaCorregida");
        expect(cols).not.toContain("reporteId");
        expect(cols).not.toContain("categoriaCorrecta");
    });
});

describe("catálogo del chat · métricas y ejemplos sin SQL roto (DEFECTO 2)", () => {
    it("métricas: ninguna referencia tablas vetadas ni el estado inventado 'CERRADO'", () => {
        for (const m of METRICAS) {
            for (const vetada of TABLAS_VETADAS) {
                expect(m.formulaSQL).not.toContain(`"${vetada}"`);
            }
            expect(m.formulaSQL).not.toContain("'CERRADO'");
        }
    });

    it("ejemplos: ninguno enseña SQL contra tablas vetadas ni columnas fantasma", () => {
        for (const e of EJEMPLOS) {
            for (const vetada of TABLAS_VETADAS) {
                expect(e.sql).not.toContain(`"${vetada}"`);
            }
            expect(e.sql).not.toContain("'CERRADO'");
        }
        // La plataforma del reporte vive en Reporte.plataformaId, no en FuenteReporte.
        const fuente = EJEMPLOS.find((e) => e.preguntaNL === "Reportes creados por fuente esta semana");
        expect(fuente?.sql).toContain('r."plataformaId"');
        expect(fuente?.sql).not.toContain("fr.plataforma");
    });
});

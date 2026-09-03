// tests/unit/bi-personas-geo.test.ts · Contrato de src/lib/bi/personas.ts y geo.ts
// Producto 006 · BI v2 · Personas y Geografía (ampliación v3)
//
// Unitarios puros: '@lib/db' (prisma.$queryRaw) mockeado — sin BD ni red.
// Las filas mockeadas tienen la FORMA real del ResultSet de cada query
// (alias snake_case, ::int como number). Ningún módulo usa reloj ni config:
// no hacen falta fake timers ni mock de '@lib/config'.
//
// Se cubre: mapeo completo de Personas (rosters, madres/padres,
// identificadores con total calculado, alertas por sujeto/estado, cubo
// "Sin plataforma", círculo familiar) y de Geo (top de ciudades con
// coordenadas, conteo con fallback de texto, reincidencia 'agregado' vs
// 'honesto_vacio' con <30 filas — candado 9, dow L..D con 0s, 12 meses
// móviles con huecos), y degradación por sección cuando una consulta falla.
// SPEC-006: calorCiudades (intensidad 0..1 = total / máximo del top; la
// ciudad líder marca 1.0; total 0 → 0, jamás NaN; vacío/degradado → []).
// Mejoras en vivo: comportamiento por país/ciudad (top 8 con categoría más
// frecuente; categoriaTop NULL honesto si el país/ciudad no tiene reportes
// clasificados; sondeo roto → lista vacía sin reventar el resto).
// Mejoras del dueño (KPIs + choropleth): totales (reportes, identificadores
// visibles y % autenticados de UN ResultSet; % null con 0 reportes — NULLIF
// en SQL, jamás NaN; sondeo roto → los 3 en null, candado 9) y porPais
// (todos los países resueltos con su total para el relleno del mapa).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock } = vi.hoisted(() => ({ queryRawMock: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));

import { getPersonas } from "@/lib/bi/personas";
import { getGeo } from "@/lib/bi/geo";

type Filas = Record<string, unknown>[];
type Respuesta = Filas | Error;

/**
 * Despacha por fragmento distintivo del SQL (primer match gana). Un Error
 * simula el fallo de ESA consulta: la sección degrada a vacío con warn,
 * nunca revienta la pestaña entera.
 */
function mockConsultas(mapa: Array<[string, Respuesta]>): void {
    queryRawMock.mockImplementation((partes: unknown) => {
        const sql = (Array.isArray(partes) ? partes.join(" ") : String(partes)).replace(/\s+/g, " ");
        for (const [fragmento, respuesta] of mapa) {
            if (sql.includes(fragmento)) {
                return respuesta instanceof Error
                    ? Promise.reject(respuesta)
                    : Promise.resolve(respuesta);
            }
        }
        return Promise.resolve([]);
    });
}

// Fragmentos distintivos de cada query (ver personas.ts / geo.ts).
// OJO al orden: el sondeo de 'totales' también toca "IdentificadorReportado"
// y el de 'porPais' comparte JOIN "Pais" con comportamiento-*; el despachador
// toma el PRIMER match, así que los fragmentos más específicos van primero.
const F = {
    base: "AS profesores_vigilados",
    identificadores: 'SELECT count(*) FROM "IdentificadorAlumno"',
    porSujeto: '"tipoSujeto" AS sujeto',
    porEstado: '"estado" AS estado',
    porPlataforma: "AS plataforma",
    circulo: "AS hijos_vinculados",
    topCiudades: 'JOIN "Ciudad"',
    coberturaGeo: "'txt:'",
    reincidencia: '"totalReportes"',
    dow: "EXTRACT(ISODOW",
    porMes: "generate_series",
    comportamientoPais: 'PARTITION BY r."paisId"',
    comportamientoCiudad: 'PARTITION BY r."ciudadId"',
    totales: '"esVisiblePublicamente"',
    porPais: 'JOIN "Pais"',
} as const;

beforeEach(() => {
    vi.clearAllMocks();
    // Silencia los console.warn deliberados de degradación (no son fallos).
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

// ─── getPersonas ─────────────────────────────────────────────────────────────

describe("getPersonas · datos reales mockeados", () => {
    it("arma Personas completo: rosters, identificadores, alertas, plataformas y círculo", async () => {
        mockConsultas([
            [F.base, [{
                profesores: 300,
                profesores_vigilados: 285,
                alumnos: 2003,
                acudientes: 2818,
                acudientes_madres: 1900,
                acudientes_padres: 850,
            }]],
            [F.identificadores, [{ alumnos: 1384, acudientes: 1207, profesores: 129 }]],
            [F.porSujeto, [
                { sujeto: "ESTUDIANTE", total: 900 },
                { sujeto: "ACUDIENTE", total: 400 },
                { sujeto: "PROFESOR", total: 125 },
            ]],
            [F.porEstado, [
                { estado: "nueva", total: 600 },
                { estado: "gestionada", total: 500 },
                { estado: "escalada", total: 25 },
            ]],
            [F.porPlataforma, [
                { plataforma: "WhatsApp", total: 1800 },
                { plataforma: "Instagram", total: 700 },
                { plataforma: "Sin plataforma", total: 220 },
            ]],
            [F.circulo, [{
                hijos: 150,
                hijos_vinculados: 140,
                contactos: 60,
                identificadores_hijo: 210,
            }]],
        ]);

        const personas = await getPersonas();

        expect(personas).toEqual({
            profesores: 300,
            profesoresVigilados: 285,
            alumnos: 2003,
            acudientes: 2818,
            acudientesMadres: 1900,
            acudientesPadres: 850,
            identificadores: {
                alumnos: 1384,
                acudientes: 1207,
                profesores: 129,
                total: 2720, // 1384 + 1207 + 129: suma de cifras del ResultSet
            },
            alertasPorSujeto: [
                { sujeto: "ESTUDIANTE", total: 900 },
                { sujeto: "ACUDIENTE", total: 400 },
                { sujeto: "PROFESOR", total: 125 },
            ],
            alertasPorEstado: [
                { estado: "nueva", total: 600 },
                { estado: "gestionada", total: 500 },
                { estado: "escalada", total: 25 },
            ],
            identificadoresPorPlataforma: [
                { plataforma: "WhatsApp", total: 1800 },
                { plataforma: "Instagram", total: 700 },
                { plataforma: "Sin plataforma", total: 220 },
            ],
            circulo: {
                hijos: 150,
                hijosVinculados: 140,
                contactos: 60,
                identificadoresHijo: 210,
            },
        });
    });

    it("vacío total → todo en cero/vacío, nada inventado", async () => {
        mockConsultas([]); // todas las consultas devuelven []

        const personas = await getPersonas();

        expect(personas.profesores).toBe(0);
        expect(personas.profesoresVigilados).toBe(0);
        expect(personas.acudientesMadres).toBe(0);
        expect(personas.identificadores).toEqual({
            alumnos: 0,
            acudientes: 0,
            profesores: 0,
            total: 0,
        });
        expect(personas.alertasPorSujeto).toEqual([]);
        expect(personas.alertasPorEstado).toEqual([]);
        expect(personas.identificadoresPorPlataforma).toEqual([]);
        expect(personas.circulo).toEqual({
            hijos: 0,
            hijosVinculados: 0,
            contactos: 0,
            identificadoresHijo: 0,
        });
    });

    it("una consulta rota degrada su sección sin reventar las demás", async () => {
        mockConsultas([
            [F.porPlataforma, new Error('relation "Plataforma" does not exist')],
            [F.base, [{
                profesores: 10,
                profesores_vigilados: 8,
                alumnos: 100,
                acudientes: 150,
                acudientes_madres: 90,
                acudientes_padres: 55,
            }]],
            [F.circulo, [{
                hijos: 3,
                hijos_vinculados: 3,
                contactos: 1,
                identificadores_hijo: 5,
            }]],
        ]);

        const personas = await getPersonas();

        expect(personas.identificadoresPorPlataforma).toEqual([]); // degradada
        expect(personas.profesores).toBe(10); // el resto vive
        expect(personas.circulo.identificadoresHijo).toBe(5);
    });
});

// ─── getGeo ──────────────────────────────────────────────────────────────────

describe("getGeo · datos reales mockeados", () => {
    it("arma Geo completo: top con coordenadas, cobertura, reincidencia, dow y 12 meses", async () => {
        mockConsultas([
            [F.topCiudades, [
                { nombre: "Bogotá", total: 500, lat: 4.6097, lng: -74.0817 },
                { nombre: "Medellín", total: 320, lat: 6.2442, lng: -75.5812 },
            ]],
            [F.coberturaGeo, [{ ciudades: 21, paises: 1 }]],
            [F.reincidencia, [{ unicos: 64, con_2_mas: 20, con_5_mas: 5, multi_ciudad: 3 }]],
            [F.dow, [
                { dow: 1, total: 300 },
                { dow: 3, total: 280 },
                { dow: 5, total: 260 },
            ]],
            [F.porMes, [
                { mes: "2025-10", total: 0 },
                { mes: "2025-11", total: 120 },
                { mes: "2025-12", total: 140 },
            ]],
            [F.totales, [{ reportes: 8296, identificadores_visibles: 43, pct_autenticados: 40.2 }]],
            [F.porPais, [
                { pais: "Colombia", total: 8100 },
                { pais: "México", total: 120 },
            ]],
        ]);

        const geo = await getGeo();

        expect(geo.topCiudades).toEqual([
            { nombre: "Bogotá", total: 500, lat: 4.6097, lng: -74.0817 },
            { nombre: "Medellín", total: 320, lat: 6.2442, lng: -75.5812 },
        ]);
        expect(geo.ciudadesConReportes).toBe(21);
        expect(geo.paisesConReportes).toBe(1);
        // ≥30 filas en el agregado → estadística mostrable
        expect(geo.reincidencia).toEqual({
            unicos: 64,
            con2mas: 20,
            con5mas: 5,
            multiCiudad: 3,
            fuente: "agregado",
        });
        // Siempre 7 días L..D; los días sin filas quedan en 0 (hueco real)
        expect(geo.estacionalidadDow).toEqual([
            { dia: "L", total: 300 },
            { dia: "M", total: 0 },
            { dia: "X", total: 280 },
            { dia: "J", total: 0 },
            { dia: "V", total: 260 },
            { dia: "S", total: 0 },
            { dia: "D", total: 0 },
        ]);
        // Los meses con 0 llegan tal cual del ResultSet (generate_series)
        expect(geo.porMes).toEqual([
            { mes: "2025-10", total: 0 },
            { mes: "2025-11", total: 120 },
            { mes: "2025-12", total: 140 },
        ]);
        // KPIs generales: un solo ResultSet con las 3 subconsultas
        expect(geo.totales).toEqual({
            reportes: 8296,
            identificadoresVisibles: 43,
            pctAutenticados: 40.2,
        });
        // Choropleth: todos los países resueltos, mayor → menor
        expect(geo.porPais).toEqual([
            { pais: "Colombia", total: 8100 },
            { pais: "México", total: 120 },
        ]);
    });

    it("reincidencia con <30 filas → fuente 'honesto_vacio' (candado 9, cifras reales intactas)", async () => {
        mockConsultas([
            // El demo pobló poco IdentificadorReportado: 16 filas reales.
            [F.reincidencia, [{ unicos: 16, con_2_mas: 9, con_5_mas: 2, multi_ciudad: 0 }]],
        ]);

        const geo = await getGeo();

        expect(geo.reincidencia.fuente).toBe("honesto_vacio");
        // Los conteos se devuelven tal cual salieron — jamás maquillados.
        expect(geo.reincidencia.unicos).toBe(16);
        expect(geo.reincidencia.con2mas).toBe(9);
        expect(geo.reincidencia.con5mas).toBe(2);
        expect(geo.reincidencia.multiCiudad).toBe(0);
    });

    it("vacío total → mapa sin puntos, dow en 0, reincidencia honesto_vacio", async () => {
        mockConsultas([]);

        const geo = await getGeo();

        expect(geo.topCiudades).toEqual([]);
        expect(geo.ciudadesConReportes).toBe(0);
        expect(geo.paisesConReportes).toBe(0);
        expect(geo.reincidencia).toEqual({
            unicos: 0,
            con2mas: 0,
            con5mas: 0,
            multiCiudad: 0,
            fuente: "honesto_vacio", // 0 < 30: sin base no se presume nada
        });
        expect(geo.estacionalidadDow).toEqual([
            { dia: "L", total: 0 },
            { dia: "M", total: 0 },
            { dia: "X", total: 0 },
            { dia: "J", total: 0 },
            { dia: "V", total: 0 },
            { dia: "S", total: 0 },
            { dia: "D", total: 0 },
        ]);
        expect(geo.porMes).toEqual([]);
    });

    it("una consulta rota degrada su sección sin reventar las demás", async () => {
        mockConsultas([
            [F.topCiudades, new Error('relation "Ciudad" does not exist')],
            [F.coberturaGeo, [{ ciudades: 4, paises: 1 }]],
            [F.reincidencia, [{ unicos: 40, con_2_mas: 12, con_5_mas: 4, multi_ciudad: 1 }]],
        ]);

        const geo = await getGeo();

        expect(geo.topCiudades).toEqual([]); // degradada: mapa sin puntos
        expect(geo.ciudadesConReportes).toBe(4); // el resto vive
        expect(geo.reincidencia.fuente).toBe("agregado");
    });
});

// ─── getGeo · calorCiudades (SPEC-006) ───────────────────────────────────────

describe("getGeo · calorCiudades (SPEC-006)", () => {
    it("intensidad normalizada: la ciudad líder marca 1.0 y el resto proporcional", async () => {
        mockConsultas([
            [F.topCiudades, [
                { nombre: "Bogotá", total: 500, lat: 4.6097, lng: -74.0817 },
                { nombre: "Medellín", total: 250, lat: 6.2442, lng: -75.5812 },
                { nombre: "Cali", total: 125, lat: 3.4516, lng: -76.532 },
            ]],
        ]);

        const geo = await getGeo();

        expect(geo.calorCiudades).toEqual([
            { nombre: "Bogotá", lat: 4.6097, lng: -74.0817, total: 500, intensidad: 1 },
            { nombre: "Medellín", lat: 6.2442, lng: -75.5812, total: 250, intensidad: 0.5 },
            { nombre: "Cali", lat: 3.4516, lng: -76.532, total: 125, intensidad: 0.25 },
        ]);
    });

    it("total 0 → intensidad 0 (jamás NaN); vacío → []", async () => {
        // Defensivo: count(*) real nunca da 0, pero si llegara no se divide.
        mockConsultas([
            [F.topCiudades, [{ nombre: "Bogotá", total: 0, lat: 4.6097, lng: -74.0817 }]],
        ]);

        const geo = await getGeo();

        expect(geo.calorCiudades).toEqual([
            { nombre: "Bogotá", lat: 4.6097, lng: -74.0817, total: 0, intensidad: 0 },
        ]);
    });

    it("sin top de ciudades (vacío o consulta rota) → calorCiudades []", async () => {
        mockConsultas([]);
        expect((await getGeo()).calorCiudades).toEqual([]);

        mockConsultas([[F.topCiudades, new Error('relation "Ciudad" does not exist')]]);
        expect((await getGeo()).calorCiudades).toEqual([]);
    });
});

// ─── getGeo · comportamiento por país/ciudad ─────────────────────────────────

describe("getGeo · comportamiento por país/ciudad", () => {
    it("top por volumen con la categoría más frecuente de cada uno", async () => {
        mockConsultas([
            [F.comportamientoPais, [
                { pais: "Colombia", total: 900, categoria_top: "CIBERACOSO" },
                { pais: "México", total: 120, categoria_top: "CONTACTO_INSISTENTE" },
            ]],
            [F.comportamientoCiudad, [
                { ciudad: "Bogotá", total: 500, categoria_top: "CIBERACOSO" },
                { ciudad: "Medellín", total: 320, categoria_top: "EXTORSION" },
            ]],
        ]);

        const geo = await getGeo();

        expect(geo.comportamiento.porPais).toEqual([
            { pais: "Colombia", total: 900, categoriaTop: "CIBERACOSO" },
            { pais: "México", total: 120, categoriaTop: "CONTACTO_INSISTENTE" },
        ]);
        expect(geo.comportamiento.porCiudadTop).toEqual([
            { ciudad: "Bogotá", total: 500, categoriaTop: "CIBERACOSO" },
            { ciudad: "Medellín", total: 320, categoriaTop: "EXTORSION" },
        ]);
    });

    it("categoriaTop NULL honesto cuando el país/ciudad no tiene reportes clasificados", async () => {
        mockConsultas([
            // LEFT JOIN sin fila en cats → categoria_top NULL del ResultSet.
            [F.comportamientoPais, [{ pais: "Colombia", total: 40, categoria_top: null }]],
            [F.comportamientoCiudad, [{ ciudad: "Cali", total: 25, categoria_top: null }]],
        ]);

        const geo = await getGeo();

        expect(geo.comportamiento.porPais).toEqual([
            { pais: "Colombia", total: 40, categoriaTop: null },
        ]);
        expect(geo.comportamiento.porCiudadTop).toEqual([
            { ciudad: "Cali", total: 25, categoriaTop: null },
        ]);
    });

    it("vacío o sondeo roto → listas vacías, el resto de Geo vive", async () => {
        mockConsultas([]);
        const vacio = await getGeo();
        expect(vacio.comportamiento).toEqual({ porPais: [], porCiudadTop: [] });

        mockConsultas([
            [F.comportamientoPais, new Error("réplica caída")],
            [F.coberturaGeo, [{ ciudades: 4, paises: 1 }]],
        ]);
        const degradado = await getGeo();
        expect(degradado.comportamiento.porPais).toEqual([]); // degradada
        expect(degradado.paisesConReportes).toBe(1); // el resto vive
    });
});

// ─── getGeo · totales generales (KPIs, como el dashboard público de PI) ──────

describe("getGeo · totales generales (KPIs)", () => {
    it("reportes, identificadores visibles y % autenticados desde un solo ResultSet", async () => {
        mockConsultas([
            [F.totales, [{ reportes: 8296, identificadores_visibles: 43, pct_autenticados: 40.2 }]],
        ]);

        const geo = await getGeo();

        expect(geo.totales).toEqual({
            reportes: 8296,
            identificadoresVisibles: 43,
            pctAutenticados: 40.2,
        });
    });

    it("0 reportes → pctAutenticados null del ResultSet (NULLIF en SQL, jamás NaN)", async () => {
        // Réplica viva sin reportes: el % no existe, no es 0 ni división por cero.
        mockConsultas([
            [F.totales, [{ reportes: 0, identificadores_visibles: 0, pct_autenticados: null }]],
        ]);

        const geo = await getGeo();

        expect(geo.totales).toEqual({
            reportes: 0,
            identificadoresVisibles: 0,
            pctAutenticados: null,
        });
    });

    it("sondeo roto → los 3 en null (candado 9: se anuncia, nunca un 0 inventado)", async () => {
        mockConsultas([
            [F.totales, new Error('column "esVisiblePublicamente" does not exist')],
            [F.coberturaGeo, [{ ciudades: 4, paises: 1 }]],
        ]);

        const geo = await getGeo();

        expect(geo.totales).toEqual({
            reportes: null,
            identificadoresVisibles: null,
            pctAutenticados: null,
        });
        // El resto de la pestaña vive
        expect(geo.ciudadesConReportes).toBe(4);
    });
});

// ─── getGeo · porPais (choropleth del mapa) ──────────────────────────────────

describe("getGeo · porPais (choropleth)", () => {
    it("todos los países resueltos con su total, mayor → menor", async () => {
        mockConsultas([
            [F.porPais, [
                { pais: "Colombia", total: 8100 },
                { pais: "México", total: 120 },
                { pais: "España", total: 3 },
            ]],
        ]);

        const geo = await getGeo();

        expect(geo.porPais).toEqual([
            { pais: "Colombia", total: 8100 },
            { pais: "México", total: 120 },
            { pais: "España", total: 3 },
        ]);
    });

    it("vacío o sondeo roto → [] y el resto de Geo vive", async () => {
        mockConsultas([]);
        expect((await getGeo()).porPais).toEqual([]);

        mockConsultas([
            [F.porPais, new Error("réplica caída")],
            [F.coberturaGeo, [{ ciudades: 4, paises: 1 }]],
        ]);
        const geo = await getGeo();
        expect(geo.porPais).toEqual([]); // degradada: países con relleno base
        expect(geo.ciudadesConReportes).toBe(4); // el resto vive
    });
});

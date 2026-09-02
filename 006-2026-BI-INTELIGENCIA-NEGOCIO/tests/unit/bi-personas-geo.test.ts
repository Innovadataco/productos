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
const F = {
    base: "AS profesores_vigilados",
    identificadores: 'SELECT count(*) FROM "IdentificadorAlumno"',
    porSujeto: '"tipoSujeto" AS sujeto',
    porEstado: '"estado" AS estado',
    porPlataforma: "AS plataforma",
    circulo: "AS hijos_vinculados",
    topCiudades: 'JOIN "Ciudad"',
    coberturaGeo: "'txt:'",
    reincidencia: 'FROM "IdentificadorReportado"',
    dow: "EXTRACT(ISODOW",
    porMes: "generate_series",
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

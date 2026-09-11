import { describe, it, expect } from "vitest";
import {
    construirItemsHistorial,
    resolverValorCampo,
    ETIQUETAS_CAMPO_PERFIL,
    VALOR_NO_DISPONIBLE,
    type FilaAudit,
    type MapasResolucion,
} from "./perfil-cambios";
import { AVISOS_PADRE } from "./avisos-perfil";

/**
 * SPEC-628 · CANDADO de contenido y de conducta del «Historial de cambios».
 *
 * El defecto que Jelkin describió: el historial mostraba códigos crudos
 * («ciudad: vacío → 05001») y los avisos no dejaban rastro. Este candado fija
 * dos invariantes sobre el builder puro (sin BD):
 *
 *  (contenido) NINGUNA salida contiene un identificador interno — id/cuid,
 *              código de catálogo, clave de evento ni nombre de columna. Los
 *              campos con código se resuelven a NOMBRE; si el id ya no existe se
 *              muestra el marcador, jamás el id.
 *  (conducta)  un cambio de DATO y un cambio de AVISO producen, cada uno, una
 *              línea legible.
 *
 * Muere con el defecto por MUTACIÓN: si `resolverValorCampo` devolviera el valor
 * crudo para un campo-código, (contenido) cae. Verificado en preflight.
 */

const mapas: MapasResolucion = {
    ciudades: new Map([["clcity_medellin_0001", "Medellín"]]),
    paises: new Map([["clpais_co_0001", "Colombia"]]),
    tiposDoc: new Map([["CC", "Cédula de ciudadanía"]]),
};

// Ids/claves internos que NUNCA deben aparecer en la salida.
const INTERNOS = [
    "clcity_medellin_0001",
    "clcity_borrada_9999", // ciudad de un catálogo ya borrado
    "clpais_co_0001",
    "reporte.resuelto.EMAIL", // clave de evento del aviso
    "ciudadId",
    "paisId",
    "documentoTipo", // nombres de columna
];

const filas: FilaAudit[] = [
    {
        id: "a1",
        accion: "PERFIL_CAMBIO",
        valorAnterior: JSON.stringify({ campo: "ciudadId", valor: null }),
        valorNuevo: JSON.stringify({ campo: "ciudadId", valor: "clcity_medellin_0001" }),
        creadoEn: "2026-09-08T15:00:00.000Z",
    },
    {
        id: "a2",
        accion: "PERFIL_CAMBIO",
        valorAnterior: JSON.stringify({ campo: "paisId", valor: null }),
        valorNuevo: JSON.stringify({ campo: "paisId", valor: "clpais_co_0001" }),
        creadoEn: "2026-09-08T15:01:00.000Z",
    },
    {
        id: "a3",
        accion: "PERFIL_CAMBIO",
        valorAnterior: JSON.stringify({ campo: "documentoTipo", valor: null }),
        valorNuevo: JSON.stringify({ campo: "documentoTipo", valor: "CC" }),
        creadoEn: "2026-09-08T15:02:00.000Z",
    },
    {
        id: "a4",
        accion: "PERFIL_CAMBIO",
        valorAnterior: JSON.stringify({ campo: "email", valor: "viejo@correo.com" }),
        valorNuevo: JSON.stringify({ campo: "email", valor: "nuevo@correo.com" }),
        creadoEn: "2026-09-08T15:03:00.000Z",
    },
    {
        id: "a5",
        accion: "NOTIFICACION_PREFERENCIA_ACTUALIZADA",
        valorAnterior: null,
        valorNuevo: JSON.stringify({ eventoRegla: "reporte.resuelto.EMAIL", habilitado: true }),
        creadoEn: "2026-09-08T15:04:00.000Z",
    },
    {
        id: "a6",
        accion: "PERFIL_CAMBIO",
        valorAnterior: JSON.stringify({ campo: "ciudadId", valor: "clcity_medellin_0001" }),
        valorNuevo: JSON.stringify({ campo: "ciudadId", valor: "clcity_borrada_9999" }),
        creadoEn: "2026-09-08T15:05:00.000Z",
    },
];

describe("SPEC-628 · el historial no expone identificadores internos", () => {
    const items = construirItemsHistorial(filas, mapas);
    const serial = JSON.stringify(items);

    // El conjunto de TODO lo legible que el builder puede emitir con estos fixtures:
    // nombres resueltos + el marcador + los valores ya-legibles sembrados (correos) + null.
    const NOMBRES_RESUELTOS = [...mapas.ciudades.values(), ...mapas.paises.values(), ...mapas.tiposDoc.values()];
    const VALORES_LEGIBLES = new Set<string | null>([
        ...NOMBRES_RESUELTOS,
        VALOR_NO_DISPONIBLE,
        "viejo@correo.com",
        "nuevo@correo.com",
        null,
    ]);
    const ETIQUETAS_DATO_OK = new Set([...Object.values(ETIQUETAS_CAMPO_PERFIL), "un dato"]);
    const ETIQUETAS_AVISO_OK = new Set([...AVISOS_PADRE.map((a) => a.titulo), "un aviso"]);
    const CLAVES_DATO = new Set(["id", "tipo", "etiqueta", "anterior", "nuevo", "creadoEn"]);
    const CLAVES_AVISO = new Set(["id", "tipo", "etiqueta", "estado", "creadoEn"]);

    // El candado FUERTE: en POSITIVO. Cada entrada se compone SOLO de campos
    // legibles resueltos a nombre — no una lista de formatos prohibidos (una
    // lista deja pasar el formato que no está en ella). Si el resolver filtra un
    // id crudo, ese id NO pertenece a VALORES_LEGIBLES → cae.
    it("(contenido·POSITIVO) cada entrada se compone solo de campos legibles", () => {
        for (const it of items) {
            if (it.tipo === "aviso") {
                expect([...Object.keys(it)].every((k) => CLAVES_AVISO.has(k)), `claves inesperadas en ${JSON.stringify(it)}`).toBe(true);
                expect(ETIQUETAS_AVISO_OK.has(it.etiqueta), `etiqueta de aviso no aprobada: «${it.etiqueta}»`).toBe(true);
                expect(["activado", "desactivado"]).toContain(it.estado);
            } else {
                expect([...Object.keys(it)].every((k) => CLAVES_DATO.has(k)), `claves inesperadas en ${JSON.stringify(it)}`).toBe(true);
                expect(ETIQUETAS_DATO_OK.has(it.etiqueta), `etiqueta de dato no legible: «${it.etiqueta}»`).toBe(true);
                expect(VALORES_LEGIBLES.has(it.anterior), `valor «anterior» no legible: «${it.anterior}»`).toBe(true);
                expect(VALORES_LEGIBLES.has(it.nuevo), `valor «nuevo» no legible: «${it.nuevo}»`).toBe(true);
            }
        }
    });

    it("(contenido) red secundaria: ninguna salida contiene un id/clave/columna interno", () => {
        for (const interno of INTERNOS) {
            expect(serial, `se filtró el identificador interno «${interno}»`).not.toContain(interno);
        }
        // Ni un cuid-like suelto (defensa de clase, no solo de los fixtures).
        expect(serial).not.toMatch(/cl[a-z]{3,}_[a-z0-9_]+/i);
    });

    it("(contenido) los campos-código se muestran resueltos a nombre", () => {
        expect(serial).toContain("Medellín");
        expect(serial).toContain("Colombia");
        expect(serial).toContain("Cédula de ciudadanía");
    });

    it("(contenido) un id sin resolver muestra el marcador, no el id", () => {
        const ghost = items.find((i) => i.id === "a6");
        expect(ghost).toBeDefined();
        if (ghost && ghost.tipo === "dato") {
            expect(ghost.nuevo).toBe(VALOR_NO_DISPONIBLE);
            expect(ghost.anterior).toBe("Medellín");
        }
    });

    it("(conducta) un cambio de DATO y un cambio de AVISO producen, cada uno, una línea legible", () => {
        const dato = items.find((i) => i.tipo === "dato" && i.id === "a1");
        const aviso = items.find((i) => i.tipo === "aviso");
        expect(dato).toBeDefined();
        expect(aviso).toBeDefined();
        if (dato && dato.tipo === "dato") {
            expect(dato.etiqueta).toBe("Ciudad");
            expect(dato.nuevo).toBe("Medellín");
        }
        if (aviso && aviso.tipo === "aviso") {
            expect(aviso.etiqueta).toBe("Cuando se resuelva un reporte que hice");
            expect(aviso.estado).toBe("activado");
        }
    });

    it("(unidad) resolverValorCampo nunca devuelve el id crudo de un campo-código", () => {
        expect(resolverValorCampo("ciudadId", "clcity_medellin_0001", mapas)).toBe("Medellín");
        expect(resolverValorCampo("ciudadId", "clcity_borrada_9999", mapas)).toBe(VALOR_NO_DISPONIBLE);
        // Un campo ya legible pasa tal cual.
        expect(resolverValorCampo("email", "nuevo@correo.com", mapas)).toBe("nuevo@correo.com");
    });
});

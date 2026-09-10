/**
 * I-366 · CANDADO del PRE-FLIGHT de purga (unit, sin base ni llaves).
 *
 * El hueco que cerró SPEC-... (revisión adversarial de Dev 1): el pre-flight comprobaba que la copia
 * nueva DESCIFRA (`plano && length>0`) pero NUNCA la comparaba contra la vieja que el DROP destruye.
 * Una fila con backfill mal enlazado/cifrado descifra LEGIBLE pero INCORRECTA → el pre-flight viejo
 * daba verde → el DROP borraba la única copia correcta (corrupción silenciosa e irreversible).
 *
 * Este candado ejercita la EVASIÓN, no la ruta feliz: fuerza «nueva legible pero DISTINTA» y exige
 * NO_COINCIDE. Si alguien afloja la decisión a «con que descifre basta», el test 1 se pone rojo.
 * Es unit a propósito (decisión inyectada, sin `leerNuevo` real) → NO necesita base: por eso va en la
 * suite unit sin el error de SPEC-612 (candado con base en la suite sin base).
 */
import { describe, it, expect } from "vitest";
import {
    verificarFilaContraViejo,
    descifrarViejo,
    esFallo,
    type LeerNuevo,
    type FilaViejo,
} from "./i366-verificar-copia-nueva";

/** `leerNuevo` falso: devuelve el plano de `mapa[contenidoId/campo]`, o LANZA si no está. Sin base. */
function leerNuevoDe(mapa: Record<string, string>): LeerNuevo {
    return (contenidoId, campo) => {
        const clave = `${contenidoId}/${campo}`;
        return clave in mapa
            ? Promise.resolve(mapa[clave])
            : Promise.reject(new Error(`sin copia nueva para ${clave}`));
    };
}

describe("I-366 · pre-flight compara igualdad, no solo legibilidad", () => {
    it("EVASIÓN: la copia nueva descifra LEGIBLE pero DISTINTA → NO_COINCIDE (fallo), no verde", async () => {
        const fila: FilaViejo = { id: "r1", contenidoId: "c1", texto: "relato-viejo-correcto", textoOriginal: null };
        // La nueva descifra bien (no vacía, legible) pero NO es la vieja: el pre-flight viejo pasaba acá.
        const veredictos = await verificarFilaContraViejo(fila, leerNuevoDe({ "c1/texto": "relato-NUEVO-distinto-legible" }));
        const texto = veredictos.find((v) => v.campo === "texto")!;
        expect(texto.estado).toBe("NO_COINCIDE");
        expect(esFallo(texto.estado)).toBe(true);
    });

    it("control positivo: nueva === vieja → COINCIDE (no fallo)", async () => {
        const fila: FilaViejo = { id: "r2", contenidoId: "c2", texto: "mismo-relato", textoOriginal: "misma-evidencia" };
        const veredictos = await verificarFilaContraViejo(
            fila,
            leerNuevoDe({ "c2/texto": "mismo-relato", "c2/textoOriginal": "misma-evidencia" }),
        );
        expect(veredictos.map((v) => v.estado)).toEqual(["COINCIDE", "COINCIDE"]);
        expect(veredictos.some((v) => esFallo(v.estado))).toBe(false);
    });

    it("por campo: si UNO coincide y el otro no, la discrepancia se caza (no se promedia)", async () => {
        const fila: FilaViejo = { id: "r3", contenidoId: "c3", texto: "trabajo-ok", textoOriginal: "evidencia-vieja" };
        const veredictos = await verificarFilaContraViejo(
            fila,
            leerNuevoDe({ "c3/texto": "trabajo-ok", "c3/textoOriginal": "evidencia-CAMBIADA" }),
        );
        expect(veredictos.find((v) => v.campo === "texto")!.estado).toBe("COINCIDE");
        expect(veredictos.find((v) => v.campo === "textoOriginal")!.estado).toBe("NO_COINCIDE");
        expect(veredictos.some((v) => esFallo(v.estado))).toBe(true);
    });

    it("campo viejo NULL → VIEJO_NULL (NO es fallo: dropear una columna NULL no pierde nada)", async () => {
        const fila: FilaViejo = { id: "r4", contenidoId: "c4", texto: "algo", textoOriginal: null };
        const veredictos = await verificarFilaContraViejo(fila, leerNuevoDe({ "c4/texto": "algo" }));
        const orig = veredictos.find((v) => v.campo === "textoOriginal")!;
        expect(orig.estado).toBe("VIEJO_NULL");
        expect(esFallo(orig.estado)).toBe(false);
    });

    it("texto viejo con contenidoId NULL → SIN_CONTENIDO (fallo): no hay copia nueva que verificar", async () => {
        const fila: FilaViejo = { id: "r5", contenidoId: null, texto: "relato-huerfano", textoOriginal: null };
        const veredictos = await verificarFilaContraViejo(fila, leerNuevoDe({}));
        const texto = veredictos.find((v) => v.campo === "texto")!;
        expect(texto.estado).toBe("SIN_CONTENIDO");
        expect(esFallo(texto.estado)).toBe(true);
    });

    it("la copia nueva no descifra (DEK quemada / ilegible) → NUEVA_NO_DESCIFRA (fallo), no se purga a ciegas", async () => {
        const fila: FilaViejo = { id: "r6", contenidoId: "c6", texto: "relato", textoOriginal: null };
        const veredictos = await verificarFilaContraViejo(fila, leerNuevoDe({})); // c6/texto ausente → leerNuevo lanza
        const texto = veredictos.find((v) => v.campo === "texto")!;
        expect(texto.estado).toBe("NUEVA_NO_DESCIFRA");
        expect(esFallo(texto.estado)).toBe(true);
    });
});

describe("I-366 · descifrarViejo replica la semántica legada (sin llave para estos casos)", () => {
    it("plano legado → tal cual; cadena vacía → tal cual; marcador de purga → tal cual", () => {
        expect(descifrarViejo("relato-plano-legado")).toBe("relato-plano-legado");
        expect(descifrarViejo("")).toBe("");
        expect(descifrarViejo("[contenido purgado]")).toBe("[contenido purgado]");
    });
});

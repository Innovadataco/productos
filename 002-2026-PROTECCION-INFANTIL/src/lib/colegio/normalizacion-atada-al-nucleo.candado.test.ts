/**
 * CANDADO · SPEC-674 — las DOS normalizaciones de identificador no pueden diverger.
 *
 * Hay dos funciones que normalizan identificadores:
 *  · `src/lib/dal/identificadores/normalizar.ts` (`trim().toLowerCase()`) — la usan
 *    el hijo, el intake público del reporte y el círculo.
 *  · `src/lib/colegio/normalizacion.ts` (toma `tipo`, hoy inerte) — la usa el colegio.
 *
 * El match del COLEGIO compara `reporte.identificador` (normalizado por la del
 * NÚCLEO en el intake, `reporte-creation.ts`) contra el identificador del alumno
 * (normalizado por la de COLEGIO). Si las dos DIVERGEN para la misma entrada, el
 * match se rompe EN SILENCIO: un colegio deja de enterarse de que reportaron a un
 * alumno, y no-avisar se ve EXACTAMENTE igual que no-hubo-caso — no hay error, ni
 * log, ni diferencia observable. Es la misma ambigüedad que casi hace leer mal el
 * «cero coincidencias» de hoy.
 *
 * Candado de CONDUCTA, no de implementación: no compara el CÓDIGO de las dos
 * funciones, compara sus SALIDAS para un banco de entradas. Si alguien hace
 * divergir la de colegio (p. ej. activando el `tipo` inerte para quitar `@` o
 * formatear teléfonos), CI lo para y la divergencia se decide con el contexto
 * delante. NO se unifica acá: ese `tipo` está por algo que hoy nadie sabe, y
 * borrarlo a ciegas podría quitar una capacidad planeada (SPEC-674).
 */
import { describe, it, expect } from "vitest";
import { normalizarIdentificador as normalizarNucleo } from "@/lib/dal/identificadores/normalizar";
import {
    normalizarIdentificador as normalizarColegio,
    inferirTipoIdentificador,
} from "@/lib/colegio/normalizacion";

// Entradas representativas: lo que un padre/colegio carga y lo que llega por el
// intake — con los casos donde una divergencia futura es más probable (`@`, email,
// teléfono con `+`/espacios, acentos/unicode, mayúsculas).
const ENTRADAS = [
    "  TioJuan1  ",
    "@Juanito",
    "JUANITO",
    "Maria.Gomez",
    "usuario@Gmail.com",
    "  ADMIN@Ejemplo.COM ",
    "+57 300 111 2233",
    "(300) 111-2233",
    "Niño_Feliz",
    "ÑOÑO",
    "Señor.X",
    "tiocarlos01",
];

// Todos los `tipo` que la de colegio puede recibir, incluido el vacío y el inferido.
const TIPOS: (string | undefined)[] = [undefined, "", "email", "EMAIL", "telefono", "nick"];

const PORQUE =
    "Las dos normalizaciones de identificador DIVERGEN. El match del COLEGIO " +
    "(reporte.identificador ↔ identificador de alumno) se rompería EN SILENCIO: un " +
    "colegio dejaría de enterarse de que reportaron a un alumno, y no-avisar se ve " +
    "igual que no-hubo-caso. Si la divergencia es deliberada, decidila con el " +
    "contexto delante y hacé que el match del colegio pase por la MISMA forma " +
    "canónica; no la dejes pasar.";

describe("SPEC-674 · colegioNorm(v, tipo) === nucleoNorm(v) para todo el banco", () => {
    it("no diverge en ninguna combinación entrada × tipo (ni con el tipo inferido)", () => {
        const divergencias: string[] = [];
        for (const v of ENTRADAS) {
            const esperado = normalizarNucleo(v);
            const tiposAProbar = [...TIPOS, inferirTipoIdentificador(v)];
            for (const tipo of tiposAProbar) {
                const obtenido = normalizarColegio(v, tipo);
                if (obtenido !== esperado) {
                    divergencias.push(
                        `«${v}» (tipo=${tipo ?? "—"}): colegio=${JSON.stringify(obtenido)} ≠ núcleo=${JSON.stringify(esperado)}`
                    );
                }
            }
        }
        expect(divergencias, `${PORQUE}\n${divergencias.join("\n")}`).toEqual([]);
    });
});

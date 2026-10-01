/**
 * CANDADO ESTRUCTURAL · SPEC-790 (D-8) · toda ruta que RESERVA o REUBICA un profesional pasa por el
 * chokepoint central de selección — derivado del ÁRBOL, no de una lista de rutas a mano.
 *
 * El árbol real (medido): una cita con profesional se crea en UN solo lugar —
 * `new SolicitudCitaRepository(tx).crear(...)` dentro de `crearSolicitudCita`— y el profesional se
 * SELECCIONA en UN solo lugar — `obtenerPublicoPorId` dentro de `crearSolicitudCita`. `reprogramarPorPadre`
 * y `reasignarPorPadre` NO crean la fila ni seleccionan por su cuenta: llaman a `crearSolicitudCita`. Por
 * eso el gate REPS que entre a `obtenerPublicoPorId` (T4) lo heredan las TRES rutas sin tocarlas — y una
 * reubicación futura (§4 · T6) que intente crear una cita saltándose el chokepoint cae en el test A1.
 *
 * Esto es lo contrario de una lista `['crear','reasignar','reprogramar']`: no enumera rutas, enumera el
 * ÚNICO creador y el ÚNICO selector; cualquier ruta nueva que quiera asignar un profesional tiene que
 * pasar por ahí o se delata.
 *
 * RED-BEFORE / GREEN-AFTER (control de no-vacuidad, estilo `facetas`): HOY la selección central NO exige
 * REPS, así que el test de T4 está como `it.fails` — PASA porque FALLA. Cuando el post-filtro REPS entre a
 * `obtenerPublicoPorId`, ese test empezará a pasar → vitest reporta «expected to fail but passed» → ROJO →
 * hay que convertirlo en `it`. Salida autoexigida: el candado se pone verde SOLO al cablear el gate.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const DIR = __dirname; // src/lib/profesional/cita
const SERVICE = fs.readFileSync(path.resolve(DIR, "cita.service.ts"), "utf-8");
const REPO_PERFIL = fs.readFileSync(path.resolve(DIR, "../../dal/repositories/perfil-profesional.ts"), "utf-8");

const sinComentarios = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Acota el cuerpo `{…}` de una función por su NOMBRE (balanceo de llaves desde su primera `{`). */
function cuerpoDeFuncion(src: string, nombre: string): string {
    const i = src.indexOf(nombre);
    if (i < 0) throw new Error(`no se encontró ${nombre}`);
    const abre = src.indexOf("{", i);
    if (abre < 0) throw new Error(`sin cuerpo para ${nombre}`);
    let prof = 0;
    for (let j = abre; j < src.length; j++) {
        if (src[j] === "{") prof++;
        else if (src[j] === "}") {
            prof--;
            if (prof === 0) return src.slice(abre, j + 1);
        }
    }
    throw new Error(`cuerpo de ${nombre} sin cerrar`);
}

const RE_CREADOR = /SolicitudCitaRepository\([^)]*\)\s*\.\s*crear\(/g;
const RE_SELECTOR = /\.obtenerPublicoPorId\(/g;

describe("SPEC-790 (D-8) · chokepoint de asignación de profesional a cita", () => {
    const servicio = sinComentarios(SERVICE);
    const cuerpoCrear = cuerpoDeFuncion(servicio, "crearSolicitudCita");

    it("A1 · la fila de cita se crea en UN solo lugar, dentro de crearSolicitudCita", () => {
        const creadores = [...servicio.matchAll(RE_CREADOR)];
        expect(creadores.length, "debe existir exactamente un creador de citas en el servicio").toBe(1);
        expect(cuerpoCrear, "el único creador vive dentro de crearSolicitudCita").toMatch(RE_CREADOR);
    });

    it("A2 · el profesional se SELECCIONA en UN solo lugar (obtenerPublicoPorId), dentro de crearSolicitudCita", () => {
        const selectores = [...servicio.matchAll(RE_SELECTOR)];
        expect(selectores.length, "el servicio selecciona al profesional en un solo lugar").toBe(1);
        expect(cuerpoCrear, "la selección vive dentro de crearSolicitudCita").toMatch(RE_SELECTOR);
    });

    it("control positivo: un SEGUNDO creador de citas fuera de crearSolicitudCita se CAZA", () => {
        const mutado = SERVICE.replace(
            "export async function aprobarPago(",
            "export async function fuga() { await new SolicitudCitaRepository().crear({}); }\nexport async function aprobarPago(",
        );
        expect(mutado, "la mutación debía aplicar").not.toBe(SERVICE);
        const creadores = [...sinComentarios(mutado).matchAll(RE_CREADOR)];
        expect(creadores.length, "el candado debe ver el segundo creador inyectado").toBeGreaterThan(1);
    });

    it("control positivo: un SEGUNDO selector de profesional fuera de crearSolicitudCita se CAZA", () => {
        const mutado = SERVICE.replace(
            "export async function aprobarPago(",
            "export async function fuga() { await new PerfilProfesionalRepository().obtenerPublicoPorId('x', null); }\nexport async function aprobarPago(",
        );
        expect(mutado).not.toBe(SERVICE);
        const selectores = [...sinComentarios(mutado).matchAll(RE_SELECTOR)];
        expect(selectores.length).toBeGreaterThan(1);
    });

    it("ancla · obtenerPublicoPorId existe y se acota (si no, el test de T4 sería un falso rojo)", () => {
        const cuerpo = cuerpoDeFuncion(sinComentarios(REPO_PERFIL), "obtenerPublicoPorId");
        expect(cuerpo.length).toBeGreaterThan(50);
        expect(cuerpo, "hoy la selección pasa por el builder (whereDirectorioPublico)").toContain("whereDirectorioPublico");
    });

    // RED-BEFORE → `it` en T4. HOY obtenerPublicoPorId NO exige REPS: el `expect` de abajo FALLA, así que
    // `it.fails` PASA (verde). Al cablear el post-filtro REPS en T4, el `expect` pasará → `it.fails` dará
    // «expected to fail but passed» → ROJO → convertir a `it` (el candado se pone verde solo al cablear).
    it.fails("T4 · la selección central (obtenerPublicoPorId) exige la elegibilidad REPS — HOY no (rojo antes)", () => {
        const cuerpo = cuerpoDeFuncion(sinComentarios(REPO_PERFIL), "obtenerPublicoPorId");
        expect(cuerpo, "obtenerPublicoPorId debe aplicar la elegibilidad REPS (idsRepsElegibles/repsElegible)").toMatch(/reps/i);
    });
});

/**
 * SPEC-408 · Candado permanente del emisor de resultado del Verificador.
 *
 * Veredicto del CEO (03-09-2026 16:2x, orden de Jelkin): **el ciclo de
 * verificación no tiene rechazo terminal**. Devolver ≠ rechazar; se corrige y
 * reenvía sin límite hasta aprobar. `decidir()` puede emitir SOLO `APROBADO`
 * o `MAS_INFORMACION`. `ResultadoVerificacion.RECHAZADO` queda huérfano en el
 * enum de Prisma y en el enum de AccionAudit por seguridad (DROP VALUE es
 * migración delicada), pero NINGÚN emisor puede escribirlo desde este flujo.
 *
 * Riesgo que este candado caza: un Dev nuevo, dentro de tres semanas, abre el
 * enum, ve `RECHAZADO` disponible y lo mete en `service.decidir()` pensando
 * que es la forma correcta de expresar la devolución. Sin este candado la
 * regresión pasa CI porque tipo-checkea; con este candado el test grita.
 *
 * Estrategia: lectura estática del archivo `service.ts`. Busca cualquier
 * literal `"RECHAZADO"` o `"PROFESIONAL_VERIFICACION_RECHAZADA"` fuera de los
 * comentarios (donde SÍ se documenta el orfan-status). Falla ruidoso con el
 * mensaje del CEO como razón.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SERVICE_PATH = path.resolve(__dirname, "./service.ts");

/**
 * Elimina comentarios de bloque y de línea (aprox.) para no cazar las
 * menciones justificadas — el orfan-status vive en comentarios a propósito.
 */
function sinComentarios(contenido: string): string {
    return contenido
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const RAZON_CEO =
    "el ciclo de verificación no tiene rechazo terminal — orden de Jelkin 03-09 · " +
    "decidir() solo puede emitir APROBADO o MAS_INFORMACION";

describe("SPEC-408 · candado: decidir() solo emite APROBADO o MAS_INFORMACION", () => {
    const codigo = sinComentarios(fs.readFileSync(SERVICE_PATH, "utf-8"));

    it(`no aparece el literal "RECHAZADO" fuera de comentarios (${RAZON_CEO})`, () => {
        const matches = codigo.match(/["'`]RECHAZADO["'`]/g) ?? [];
        expect(
            matches,
            `RECHAZADO detectado ${matches.length} vez(es) en service.ts como literal — ${RAZON_CEO}`,
        ).toEqual([]);
    });

    it(`no aparece la acción de audit "PROFESIONAL_VERIFICACION_RECHAZADA" fuera de comentarios (${RAZON_CEO})`, () => {
        const matches = codigo.match(/["'`]PROFESIONAL_VERIFICACION_RECHAZADA["'`]/g) ?? [];
        expect(
            matches,
            `PROFESIONAL_VERIFICACION_RECHAZADA detectado ${matches.length} vez(es) como literal — ${RAZON_CEO}`,
        ).toEqual([]);
    });

    it("los DOS resultados emisibles aparecen literalmente en el código", () => {
        // Confirmación positiva: garantiza que si alguien borra ambas ramas por
        // error, el candado también chilla (no basta con "ausencia de RECHAZADO").
        expect(codigo).toMatch(/["'`]APROBADO["'`]/);
        expect(codigo).toMatch(/["'`]MAS_INFORMACION["'`]/);
    });

    it("la acción de audit MAS_INFO aparece literalmente en el código", () => {
        expect(codigo).toMatch(/["'`]PROFESIONAL_VERIFICACION_MAS_INFO["'`]/);
    });
});

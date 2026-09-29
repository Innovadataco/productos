/**
 * CANDADO · SPEC-791 — NINGÚN plan puede incluir citas. Estructural: el modelo `Plan`/`Suscripcion`
 * NO PUEDE REPRESENTAR «citas incluidas».
 *
 * EL PORQUÉ (va acá, junto al candado, a propósito — sin esta línea el próximo lo levanta por una razón
 * comercial perfectamente sensata y tendrá razón desde su punto de vista):
 *
 *   «La suscripción es acceso a la PLATAFORMA; la cita se paga aparte (`montoConsulta` en
 *    `SolicitudCita`). Empaquetarlas convertiría el plan en venta de un SERVICIO DE SALUD y exigiría
 *    habilitación sanitaria propia (REPS). El cobro de suscripciones HOY, sin habilitación, se sostiene
 *    exactamente en que el plan NO incluye citas. Si algún plan las incluyera, el fundamento del ingreso
 *    se rompe en silencio.»
 *
 * Qué vigila (por MORFOLOGÍA, no por lista de nombres): que en `Plan`/`Suscripcion` no aparezca un campo
 * que NOMBRE una cita, que se RELACIONE con la entidad cita (`SolicitudCita`), o que cuente
 * consultas/sesiones INCLUIDAS. Control positivo por MUTACIÓN: agregar `citasIncluidas Int` (o una
 * relación a `SolicitudCita`, o `consultasIncluidas`) pone esto ROJO. Unit puro (lee el schema).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/src/lib/pagos
const SCHEMA = resolve(AQUI, "../../../prisma/schema.prisma");

/** Extrae el cuerpo (entre llaves) del `model <nombre>` pedido. */
export function bloqueModelo(schema: string, modelo: string): string {
    const re = new RegExp(`^model ${modelo} \\{([\\s\\S]*?)^\\}`, "m");
    const m = schema.match(re);
    if (!m) throw new Error(`no se encontró el modelo ${modelo} en el schema`);
    return m[1]!;
}

/**
 * Los campos de un bloque de modelo que EMPAQUETAN citas. Morfología, no lista:
 *  (1) el TIPO se relaciona con la entidad cita (`SolicitudCita`/`Cita`) — empaquetado inequívoco;
 *  (2) el NOMBRE nombra una «cita» — en este producto «cita» es SIEMPRE la consulta de salud;
 *  (3) el NOMBRE combina consulta/sesión/atención con una semántica de INCLUSIÓN/cantidad
 *      (incluidas, cupo, gratis, pack…) — así no marca «consulta pública» (la consulta del identificador),
 *      que no lleva morfema de inclusión.
 */
export function camposQueEmpaquetanCitas(cuerpoModelo: string): string[] {
    const ofensores: string[] = [];
    for (const linea of cuerpoModelo.split("\n")) {
        const m = linea.match(/^\s*(\w+)\s+([A-Za-z0-9_[\]?]+)/);
        if (!m) continue; // comentarios, atributos de bloque, líneas vacías
        const nombre = m[1]!.toLowerCase();
        const tipo = m[2]!.toLowerCase();
        const inclusion = /(inclu|cupo|gratis|bonus|pack|otorg|entreg|paquet|prepag|regal|cortesia|porplan|delplan)/;
        const relacionaCita = /(solicitud)?cita(s)?(\[\])?$/.test(tipo) || /^cita/.test(tipo);
        const nombraCita = /cita/.test(nombre);
        const consultaIncluida = /(consulta|sesion|atencion)/.test(nombre) && inclusion.test(nombre);
        if (relacionaCita || nombraCita || consultaIncluida) ofensores.push(linea.trim());
    }
    return ofensores;
}

describe("SPEC-791 · el modelo de planes NO PUEDE representar «citas incluidas»", () => {
    const schema = readFileSync(SCHEMA, "utf8");

    it("`Plan` no tiene ningún campo que empaquete citas (schema REAL)", () => {
        const ofensores = camposQueEmpaquetanCitas(bloqueModelo(schema, "Plan"));
        expect(ofensores, `campos que empaquetan citas en Plan: ${ofensores.join(" · ")}`).toEqual([]);
    });

    it("`Suscripcion` tampoco (una cita empaquetada podría colarse por la suscripción)", () => {
        const ofensores = camposQueEmpaquetanCitas(bloqueModelo(schema, "Suscripcion"));
        expect(ofensores, `campos que empaquetan citas en Suscripcion: ${ofensores.join(" · ")}`).toEqual([]);
    });

    it("CONTROL POSITIVO por mutación: el detector CAE ante un campo que empaqueta citas", () => {
        expect(camposQueEmpaquetanCitas("  citasIncluidas Int?\n")).not.toEqual([]);
        expect(camposQueEmpaquetanCitas("  consultasIncluidas Int\n")).not.toEqual([]);
        expect(camposQueEmpaquetanCitas("  sesionesGratis Int\n")).not.toEqual([]);
        expect(camposQueEmpaquetanCitas("  citasDelPlan SolicitudCita[]\n")).not.toEqual([]);
        expect(camposQueEmpaquetanCitas("  paquete Cita[]\n")).not.toEqual([]);
    });

    it("CONTROL NEGATIVO: no marca los campos legítimos del plan (no es vacuo ni sobre-marca)", () => {
        // El cap del freemium, el precio, la descripción y la consulta PÚBLICA (del identificador) no
        // son citas empaquetadas.
        expect(camposQueEmpaquetanCitas("  usosMaximosPorCliente Int?\n")).toEqual([]);
        expect(camposQueEmpaquetanCitas("  precioBaseCOP Float?\n")).toEqual([]);
        expect(camposQueEmpaquetanCitas("  descripcion String?\n")).toEqual([]);
        expect(camposQueEmpaquetanCitas("  consultaPublicaLimite Int\n")).toEqual([]);
        expect(camposQueEmpaquetanCitas("  suscripciones Suscripcion[]\n")).toEqual([]);
    });
});

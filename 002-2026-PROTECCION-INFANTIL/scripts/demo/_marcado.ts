/**
 * SPEC-412 · el marcador de lo sembrado — `demo_marcado`, por fin usado.
 *
 * La regla del BRIEF A-76, en una línea: **el marcador va en `demo_marcado`;
 * nunca en la llave primaria, nunca en el nombre.** Un identificador es un
 * contrato que el sistema valida (`cuidIdSchema`) y usa para relacionar;
 * cargarlo con "esto es demo" lo rompe y deja el módulo fuera de prueba —
 * exactamente lo que pasó con los 254 casos del comité (I-292).
 *
 * Este archivo es el mecanismo. Todo lo que siembre un poblador pasa por acá,
 * y todo lo que borre el borrador se lee de acá.
 *
 * Por qué no se reusa `scripts/demo-prod/lib/marcar.ts`: ese hace un `upsert`
 * por fila. Para las 9.000 marcas que hoy faltan en producción son 9.000
 * viajes a la base. Acá se marca por lotes contra el `@@unique([entidad,
 * entidadId])` del modelo, que hace idempotente el re-marcado sin leer antes.
 */
import type { Prisma, PrismaClient } from "@prisma/client";

/** Cliente o transacción — el marcado siempre puede ir dentro de la tx que creó la fila. */
export type ClienteMarcado = PrismaClient | Prisma.TransactionClient;

/** Nombre de la corrida del poblador v5. Vive en `metadata.corrida`. */
export const CORRIDA_V5 = "spec-412-v5";

/** Lotes de escritura. 1.000 filas por viaje: cómodo para el pool y para el planner. */
const LOTE_MARCADO = 1000;

/**
 * SPEC-420 · **PostgreSQL admite como máximo 32.767 parámetros por sentencia
 * preparada.** Un `where: { id: { in: [...] } }` los gasta de a uno, así que
 * una lista larga revienta con:
 *
 * ```
 * too many bind variables in prepared statement,
 * expected maximum of 32767, received 37176
 * ```
 *
 * Pasó de verdad, en producción, borrando lo sembrado: 37.176 marcas. **La
 * corrida de ensayo había escrito 30.254 y pasó** — no estaba mal probada,
 * estaba probada a otra escala, y esa escala caía justo por debajo del límite.
 * De ahí la lección que vale para cualquiera que pruebe con datos propios:
 * **un volumen de prueba menor que producción no prueba el límite.**
 *
 * 2.000 va sobrado y deja margen para consultas que además lleven otros
 * parámetros.
 */
export const LOTE_IDS = 2000;

/**
 * Parte una lista de ids en tandas y acumula lo que devuelva cada una.
 *
 * Se usa en TODA consulta con `in:` sobre una lista de ids de tamaño no
 * acotado. La alternativa —confiar en que la lista sea corta— es la que nos
 * costó una corrida de borrado en producción.
 */
export async function enLotes<T>(
    ids: readonly string[],
    fn: (trozo: string[]) => Promise<T>,
    tamano: number = LOTE_IDS,
): Promise<T[]> {
    const salidas: T[] = [];
    for (let i = 0; i < ids.length; i += tamano) {
        salidas.push(await fn(ids.slice(i, i + tamano)));
    }
    return salidas;
}

/** Suma los resultados de un `count()` hecho por tandas. */
export async function contarEnLotes(
    ids: readonly string[],
    fn: (trozo: string[]) => Promise<number>,
): Promise<number> {
    if (ids.length === 0) return 0;
    const partes = await enLotes(ids, fn);
    return partes.reduce((suma, n) => suma + n, 0);
}

/** Azúcar para el caso más común: sumar los `count` de varios `deleteMany`. */
export async function borrarEnLotes(
    ids: readonly string[],
    fn: (trozo: string[]) => Promise<{ count: number }>,
): Promise<number> {
    if (ids.length === 0) return 0;
    const partes = await enLotes(ids, fn);
    return partes.reduce((suma, p) => suma + p.count, 0);
}

export interface OpcionesMarcado {
    corrida?: string;
    script?: string;
    notas?: string;
}

/**
 * Registra en `demo_marcado` cada id sembrado de una entidad.
 *
 * Se llama SIEMPRE dentro de la misma transacción que creó las filas: no debe
 * existir jamás una ventana en la que haya una fila sembrada sin su marca.
 *
 * Devuelve cuántas filas se escribieron de verdad (las repetidas se saltan).
 */
export async function marcar(
    client: ClienteMarcado,
    entidad: string,
    ids: readonly string[],
    opciones: OpcionesMarcado = {},
): Promise<number> {
    if (ids.length === 0) return 0;
    const { corrida = CORRIDA_V5, script = "poblar-demo-v5", notas } = opciones;
    const metadata = { corrida, script, ...(notas ? { notas } : {}) } satisfies Prisma.InputJsonValue;

    let escritas = 0;
    for (let i = 0; i < ids.length; i += LOTE_MARCADO) {
        const trozo = ids.slice(i, i + LOTE_MARCADO);
        const res = await client.demoMarcado.createMany({
            data: trozo.map((entidadId) => ({ entidad, entidadId, metadata })),
            skipDuplicates: true,
        });
        escritas += res.count;
    }
    return escritas;
}

/** Cuántas filas marcadas hay por entidad. Es el reporte previo del borrado. */
export async function contarPorEntidad(client: ClienteMarcado): Promise<{ entidad: string; cantidad: number }[]> {
    const filas = await client.demoMarcado.groupBy({
        by: ["entidad"],
        _count: { entidad: true },
    });
    return filas
        .map((f) => ({ entidad: f.entidad, cantidad: f._count.entidad }))
        .sort((a, b) => b.cantidad - a.cantidad);
}

/** Los ids sembrados de una entidad. Es lo ÚNICO que el borrado mira. */
export async function idsMarcados(client: ClienteMarcado, entidad: string): Promise<string[]> {
    const filas = await client.demoMarcado.findMany({
        where: { entidad },
        select: { entidadId: true },
    });
    return filas.map((f) => f.entidadId);
}

/** ¿Ya hay una corrida sembrada con este nombre? Es la idempotencia del v5. */
export async function existeCorrida(client: ClienteMarcado, corrida: string): Promise<boolean> {
    const fila = await client.demoMarcado.findFirst({
        where: { metadata: { path: ["corrida"], equals: corrida } },
        select: { id: true },
    });
    return fila !== null;
}

/**
 * Orden FK-safe de borrado: hojas primero, padres al final.
 *
 * Cada nombre es el `entidad` con el que se marca (modelo Prisma en PascalCase).
 * El test-candado exige que TODA entidad que el poblador marca esté en esta
 * lista: una entidad marcada y no listada quedaría sembrada para siempre.
 */
export const ENTIDADES_ORDEN_BORRADO: readonly string[] = [
    // Cuelgan del reporte / de la alerta
    "SolicitudComite",
    "TransicionReporte",
    "AlertaColegio",
    "ClasificacionIA",
    "Reporte",
    // Expediente del padre
    "IdentificadorContacto",
    "ContactoConfianza",
    // Aula — identificadores antes que sus dueños
    "IdentificadorAcudiente",
    "IdentificadorEstudiante",
    "IdentificadorProfesor",
    "AcudienteEstudiante",
    "Estudiante",
    "Curso",
    "Profesor",
    // Comercial — el pago cuelga de la suscripción, y ella del plan.
    "Pago",
    "Suscripcion",
    "Plan",
    // Colegio
    "PreferenciaAlertaColegio",
    "OnboardingColegio",
    "Usuario",
    "Colegio",
    "Tenant",
] as const;

/**
 * INTOCABLES (heredados del candado 3 de v1, `_common.ts`). Se verifican antes
 * de sembrar Y antes de borrar: si alguna de estas filas apareciera marcada por
 * error, el borrado la excluye igual.
 */
export const INTOCABLES = {
    /** Colegio de Calidad — jamás se toca (Bloque D §5). */
    colegios: ["cmticor7l000kglr93d1ypox6"],
    /** Buzones que no se tocan aunque calzaran con cualquier marca. */
    emailsUsuario: ["soporte@innovadataco.com"],
} as const;

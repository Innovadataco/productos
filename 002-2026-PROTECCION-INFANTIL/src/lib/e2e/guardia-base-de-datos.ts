/**
 * SPEC-770 · Guardia estructural: ningún spec e2e puede escribir sobre una base
 * que no sea la de PRUEBAS.
 *
 * Los specs de `tests/e2e/**` siembran por Prisma DIRECTO. El `baseURL` está fijo
 * en localhost, así que el lado HTTP no puede pegarle a prod — pero el lado Prisma
 * sigue a lo que diga `DATABASE_URL`. Antes de esta guardia, la única protección
 * era que nadie exportara mal esa variable, y eso no es una protección.
 *
 * DECISIÓN (por qué se afirma contra `current_database()` y NO contra la env var):
 *   una variable de entorno es una INTENCIÓN que se puede exportar mal, heredar de
 *   otra shell, o traer un typo; la base a la que Prisma REALMENTE quedó conectado
 *   es el HECHO. Preguntarle a la conexión su `current_database()` no se puede
 *   falsear con un export equivocado. NO reemplazar esto por un chequeo de
 *   `process.env.DATABASE_URL` ni de `NODE_ENV`: sería «más simple» y volvería a
 *   confiar en la intención en vez del hecho.
 *
 * Se cablea como `globalSetup` de Playwright (una sola pieza que corre ANTES de
 * todos los specs): si la base no es de pruebas, ABORTA la corrida entera y ningún
 * spec llega a sembrar.
 */
import { PrismaClient } from "@prisma/client";

/** Solo se necesita `$queryRaw` para preguntar el nombre. */
type ClienteConsulta = Pick<PrismaClient, "$queryRaw">;

/** Proveedor del nombre de la base conectada. Inyectable POR PARÁMETRO (ver abajo). */
type ProveedorDeNombre = () => Promise<string>;

/**
 * Predicado PURO (testeable en las dos direcciones). Convención del repo: la base
 * de pruebas termina en `_test` (`proteccion_infantil_test`); la de producción es
 * `proteccion_infantil`, SIN sufijo. Cualquier nombre que no termine en `_test`
 * —incluida la de prod— se rechaza.
 */
export function esBaseDeDatosDePrueba(nombre: string): boolean {
    return /_test$/.test(nombre.trim());
}

/** Pregunta a la conexión el nombre de la base REAL a la que quedó atada. */
async function nombreBaseConectada(prisma: ClienteConsulta): Promise<string> {
    const filas = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    return filas?.[0]?.current_database ?? "";
}

/** Default: abre un cliente (lee `DATABASE_URL`) y pregunta la base real. */
async function proveedorRealDeNombre(): Promise<string> {
    const prisma = new PrismaClient();
    try {
        return await nombreBaseConectada(prisma);
    } finally {
        await prisma.$disconnect();
    }
}

/**
 * ABORTA (lanza) si la base conectada no es de pruebas.
 *
 * `proveedorDeNombre` es un PARÁMETRO con default —no un interruptor de módulo—:
 * el test pasa su doble por argumento; producción usa el default (la base real).
 * A propósito NO existe un `let` de módulo ni un export inyector: un parámetro no
 * se filtra entre corridas y no se puede importar para desactivar la guardia (esa
 * fue la razón para elegir globalSetup sobre import-por-spec: no confiar en que
 * nadie se equivoque). El candado «sin interruptor» del test lo fija.
 *
 * LÍMITE DECLARADO (no se finge cubrir): que en PRODUCCIÓN se pase el proveedor
 * REAL es el default de esta línea; ningún test lo prueba, porque probarlo exigiría
 * o una base de prod real o volver a meter un seam inyectable — y eso reabre
 * exactamente el hueco que este diseño cierra.
 */
export async function exigirBaseDeDatosDePrueba(
    proveedorDeNombre: ProveedorDeNombre = proveedorRealDeNombre,
): Promise<void> {
    const nombre = await proveedorDeNombre();
    if (!esBaseDeDatosDePrueba(nombre)) {
        throw new Error(
            `SPEC-770 · ABORTA: los specs e2e están conectados a la base «${nombre}», que NO es de pruebas ` +
                "(debe terminar en «_test»). Se detiene la corrida entera para no escribir sobre datos reales. " +
                "Revisá DATABASE_URL.",
        );
    }
}

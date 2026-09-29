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
 * spec llega a sembrar. Su conducta la fija el test de esta guardia end-to-end
 * (resuelve el globalSetup que la config cablea y lo invoca).
 */
import { PrismaClient } from "@prisma/client";

/** Solo se necesita `$queryRaw` para preguntar el nombre — así el test inyecta un doble. */
type ClienteConsulta = Pick<PrismaClient, "$queryRaw">;

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
export async function nombreBaseConectada(prisma: ClienteConsulta): Promise<string> {
    const filas = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    return filas?.[0]?.current_database ?? "";
}

/**
 * Semilla de inyección SOLO para el test de esta guardia (nivel 3): permite
 * ejercer la conducta del globalSetup que la config cablea contra un nombre de
 * PROD, sin una base real y SIN mockear el cliente Prisma (la regla SPEC-174
 * prohíbe mockear el singleton en la suite de integración). En producción nunca
 * se llama → queda `null` → se consulta la base real.
 */
let inyeccionNombreParaTest: (() => Promise<string>) | null = null;
export function __inyectarNombreConectadoParaTest(fn: (() => Promise<string>) | null): void {
    inyeccionNombreParaTest = fn;
}

async function nombreConectadoReal(): Promise<string> {
    if (inyeccionNombreParaTest) return inyeccionNombreParaTest();
    const prisma = new PrismaClient();
    try {
        return await nombreBaseConectada(prisma);
    } finally {
        await prisma.$disconnect();
    }
}

function abortarSiNoEsDePrueba(nombre: string): void {
    if (!esBaseDeDatosDePrueba(nombre)) {
        throw new Error(
            `SPEC-770 · ABORTA: los specs e2e están conectados a la base «${nombre}», que NO es de pruebas ` +
                "(debe terminar en «_test»). Se detiene la corrida entera para no escribir sobre datos reales. " +
                "Revisá DATABASE_URL.",
        );
    }
}

/**
 * ABORTA (lanza) si la base conectada no es de pruebas. Usa el cliente inyectado
 * si se le pasa uno (nivel 2 del test); si no, consulta la base real (o el nombre
 * inyectado por el seam de test — nivel 3).
 */
export async function exigirBaseDeDatosDePrueba(prismaInyectado?: ClienteConsulta): Promise<void> {
    const nombre = prismaInyectado ? await nombreBaseConectada(prismaInyectado) : await nombreConectadoReal();
    abortarSiNoEsDePrueba(nombre);
}

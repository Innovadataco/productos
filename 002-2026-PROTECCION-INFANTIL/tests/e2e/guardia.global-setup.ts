/**
 * SPEC-770 · globalSetup de Playwright — corre UNA vez antes de TODOS los specs
 * e2e y ABORTA la corrida si la base conectada no es de pruebas.
 *
 * Es la imposibilidad estructural: no depende de que cada spec recuerde importar
 * una guardia ni de que la llame antes de sembrar. Un spec nuevo queda protegido
 * sin tocar nada.
 *
 * El 2º parámetro `proveedorDeNombre` es la INYECCIÓN POR PARÁMETRO que usa el test
 * end-to-end (nivel 3) para invocar ESTE globalSetup contra un nombre controlado.
 * Playwright lo llama con un solo argumento (la config) → queda `undefined` → la
 * guardia usa su default (la base real). No es un interruptor: no se exporta ningún
 * switch, y llamar a este globalSetup a mano NO desactiva la corrida que Playwright
 * ya ejecutó al inicio.
 */
import { exigirBaseDeDatosDePrueba } from "@/lib/e2e/guardia-base-de-datos";

export default async function globalSetup(
    _config?: unknown,
    proveedorDeNombre?: () => Promise<string>,
): Promise<void> {
    await exigirBaseDeDatosDePrueba(proveedorDeNombre);
}

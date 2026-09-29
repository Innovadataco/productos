/**
 * SPEC-770 · globalSetup de Playwright — corre UNA vez antes de TODOS los specs
 * e2e y ABORTA la corrida si la base conectada no es de pruebas.
 *
 * Es la imposibilidad estructural: no depende de que cada spec recuerde importar
 * una guardia ni de que la llame antes de sembrar. Un spec nuevo queda protegido
 * sin tocar nada. Que este cableado exista y ABORTE lo fija el candado end-to-end
 * en `src/lib/e2e/guardia-base-de-datos.test.ts` (nivel 3).
 */
import { exigirBaseDeDatosDePrueba } from "@/lib/e2e/guardia-base-de-datos";

export default async function globalSetup(): Promise<void> {
    await exigirBaseDeDatosDePrueba();
}

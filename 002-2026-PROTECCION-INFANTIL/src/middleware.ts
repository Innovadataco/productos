/**
 * SPEC-600 — middleware.ts en `src/` (App Router con directorio `src/`).
 *
 * Next.js con `src/` directory SOLO reconoce el middleware en
 * `src/middleware.ts`: el archivo de la raíz (`../middleware.ts`) implementa
 * toda la lógica y queda inerte en runtime si nadie lo referencia. Este
 * archivo es el único que Next autodetecta; su única responsabilidad es
 * re-exportar la implementación y declarar el matcher. La lógica NO se mueve:
 * los tests y la historia de SPEC-287/588 viven con la raíz.
 *
 * El matcher se declara como LITERAL acá (no re-exportado) a propósito: Next
 * analiza `config` estáticamente y NO reconoce uno re-exportado — avisa y
 * aplica el default, que ejecutaría el guard también sobre assets estáticos.
 * El candado `src/middleware-ubicacion.candado.test.ts` asiente que este
 * matcher es idéntico al de la raíz (cero deriva permitida).
 */
export { middleware } from "../middleware";

export const config = {
    matcher: [
        // Todas las rutas menos assets estáticos y las convenciones de Next.
        // (Copia literal del matcher de la raíz — el candado lo verifica.)
        "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    ],
};

/**
 * SPEC-362 (A-70 · G21) — El pie que va en TODAS las pantallas.
 *
 * "Desarrollado por Innovadataco · V1" más la versión del despliegue, que se
 * actualiza sola: sale de `package.json` y del SHA del build que el Dockerfile
 * inyecta en `APP_BUILD_SHA`. Nadie escribe la versión a mano, así que nunca
 * queda mintiendo después de una subida.
 *
 * Server Component: `getBuildSha()` lee una variable que NO viaja al bundle del
 * cliente (no es `NEXT_PUBLIC_`), y así se conserva.
 */
import { APP_VERSION, getBuildSha } from "@/lib/version";

export function PieGlobal() {
    const sha = getBuildSha();

    return (
        <footer
            data-testid="pie-global"
            className="mt-auto border-t border-tinta/10 px-4 py-4 text-center text-xs text-muted"
        >
            <p>
                Desarrollado por <span className="font-medium text-body">Innovadataco</span> · V1
            </p>
            <p className="mt-0.5">
                Versión {APP_VERSION}
                {sha ? ` · ${sha}` : ""}
            </p>
        </footer>
    );
}

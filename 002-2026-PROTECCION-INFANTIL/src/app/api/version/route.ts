/**
 * SPEC-548 (I-337) · Sello de versión del servidor, para el motor de detección
 * de despliegue del cliente (ver `version-cliente.ts`).
 *
 * Devuelve la versión y el SHA del build que corre AHORA en este contenedor.
 * El SHA no es secreto: ya se sirve en el pie global (`PieGlobal`) en el HTML de
 * todas las pantallas; acá solo se ofrece como JSON para poder consultarlo sin
 * recargar. `force-dynamic` + `no-store` para que jamás lo sirva una capa vieja
 * (ni el service worker, que ya excluye `/api/`).
 */
import { APP_VERSION, getBuildSha } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET() {
    return Response.json(
        { version: APP_VERSION, sha: getBuildSha() },
        { headers: { "cache-control": "no-store, max-age=0" } },
    );
}

/**
 * SPEC-291 (002-PI-191) — Liveness básico del contenedor `pi-app`.
 * Devuelve 200 si Next.js responde. NO depende de la BD ni del worker; para
 * eso están `/api/health/worker` (probe del monitor) y el propio healthcheck
 * de `db` (pg_isready) en docker-compose.prod.yml.
 */
export function GET() {
    return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
}

import pkg from "../../package.json";

/** Versión pública de la aplicación (fuente única: package.json). */
export const APP_VERSION: string = pkg.version;

/**
 * SHA corto del build (spec 102). Se inyecta SOLO en servidor vía la variable
 * de entorno `APP_BUILD_SHA` durante el build (dev-restart.sh / Dockerfile);
 * al no ser `NEXT_PUBLIC_`, Next.js no la expone al bundle del cliente.
 * Solo la usa el área admin (Server Component). Devuelve null si no está
 * disponible: el sello muestra solo la versión.
 */
export function getBuildSha(): string | null {
    const sha = process.env.APP_BUILD_SHA;
    return sha && sha.length > 0 ? sha : null;
}

/**
 * SPEC-126: rutas canónicas de las fuentes que leen los generadores.
 * Ancladas a la ubicación de este archivo (no al cwd) para que la salida
 * no dependa de desde dónde se invoque el script.
 */
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export const RAIZ_PRODUCTO = path.resolve(AQUI, "..", "..", "..");
export const RUTA_SCHEMA = path.join(RAIZ_PRODUCTO, "prisma", "schema.prisma");
export const RUTA_SEED = path.join(RAIZ_PRODUCTO, "prisma", "seed-modulos-grants.ts"); // 002-PI-048: fuente única de módulos/grants (la comparten seed y sync)
export const RUTA_APP = path.join(RAIZ_PRODUCTO, "src", "app");
export const RUTA_PROXY = path.join(RAIZ_PRODUCTO, "src", "lib", "proxy.ts");
export const RUTA_NAV_HEADER = path.join(RAIZ_PRODUCTO, "src", "components", "modules", "NavHeader.tsx");
export const RUTA_PACKAGE_JSON = path.join(RAIZ_PRODUCTO, "package.json");
export const RUTA_DOCKERFILE = path.join(RAIZ_PRODUCTO, "Dockerfile");
export const RUTA_COMPOSE_PROD = path.join(RAIZ_PRODUCTO, "docker-compose.prod.yml");
export const RUTA_COMPOSE_DEV = path.join(RAIZ_PRODUCTO, "docker-compose.yml");
export const RUTA_DOCS_ARCH = path.join(RAIZ_PRODUCTO, "docs", "architecture");
export const RUTA_EXCEPCIONES = path.join(AQUI, "..", "excepciones.json");

/** Ruta relativa a la raíz del producto, con separadores posix (determinista entre máquinas). */
export function relativa(absoluta: string): string {
    return path.relative(RAIZ_PRODUCTO, absoluta).split(path.sep).join("/");
}

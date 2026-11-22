// Candados del login (D-014): que nada quede fuera por descuido.
// - El proxy no toca la base ni bcrypt (solo verifica la firma; la base se lee en cada página y API).
// - El login lee solo sus variables: no existe ninguna que lo apague.
// - Cada página y API nueva (de cualquier frente) revalida la sesión, salvo la lista pública. El guardián del dueño
//   (exigirDueno / exigirDuenoApi, frente familia-lectura) también la revalida. Las API se buscan en todo src/app.
// - Ninguna Server Action: un cambio del matcher la dejaría sin proxy.
// - TOTP: las páginas y API del segundo paso exigen la pre-sesión; /totp/codigos exige la sesión; el
//   proxy no alcanza el cifrado, el TOTP, la pre-sesión del servidor ni la librería del QR.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const SRC = join(RAIZ, "src");
const leer = (ruta: string) => readFileSync(ruta, "utf8");

function archivos(carpeta: string, filtro: (ruta: string) => boolean): string[] {
  if (!existsSync(carpeta)) return [];
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta, filtro) : filtro(ruta) ? [ruta] : [];
  });
}

/** Importaciones de un archivo de src (relativas o con `@/`), resueltas a rutas; los paquetes, por nombre. */
function importaciones(ruta: string): string[] {
  const especificadores = [...leer(ruta).matchAll(/^\s*(?:import|export)[^"']*?from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
  return especificadores.map((e) => {
    if (!e.startsWith(".") && !e.startsWith("@/")) return e;
    const base = e.startsWith("@/") ? join(SRC, e.slice(2)) : resolve(dirname(ruta), e);
    return [".ts", ".tsx", "/index.ts"].map((ext) => `${base}${ext}`).find(existsSync) ?? base;
  });
}

function grafo(inicio: string): Set<string> {
  const visto = new Set<string>();
  const pendientes = [inicio];
  while (pendientes.length > 0) {
    const actual = pendientes.pop() ?? "";
    if (visto.has(actual)) continue;
    visto.add(actual);
    if (actual.startsWith(SRC)) pendientes.push(...importaciones(actual));
  }
  return visto;
}

const PROXY = join(SRC, "proxy.ts");
const SUPERFICIE = [
  PROXY,
  join(SRC, "instrumentation.ts"),
  ...archivos(join(SRC, "auth"), (r) => r.endsWith(".ts")),
  ...archivos(join(SRC, "app", "ingresar"), (r) => /\.tsx?$/.test(r)),
  ...archivos(join(SRC, "app", "definir-clave"), (r) => /\.tsx?$/.test(r)),
  ...archivos(join(SRC, "app", "totp"), (r) => /\.tsx?$/.test(r)),
  ...archivos(join(SRC, "app", "api", "sesion"), (r) => r.endsWith(".ts")),
].filter(existsSync);
const VARIABLES_PERMITIDAS = new Set(["AUTH_SECRET", "AUTH_SECRET_FILE", "APP_ORIGEN", "NODE_ENV", "NEXT_RUNTIME"]);

const PAGINAS_PUBLICAS = new Set(["src/app/ingresar/page.tsx", "src/app/definir-clave/page.tsx"]);
const APIS_PUBLICAS = new Set(["src/app/api/salud/route.ts", "src/app/api/sesion/ingresar/route.ts", "src/app/api/sesion/definir-clave/route.ts"]);
/** El segundo paso: sin sesión en el proxy, pero con la pre-sesión exigida en el servidor. */
const PAGINAS_PRESESION = new Set(["src/app/totp/page.tsx", "src/app/totp/enrolar/page.tsx"]);
const APIS_PRESESION = new Set(["src/app/api/sesion/totp/route.ts", "src/app/api/sesion/totp/enrolar/route.ts"]);
const rel = (ruta: string) => relative(RAIZ, ruta);

describe("candados del login", () => {
  it("el proxy no alcanza la base, bcrypt ni la revalidación con Prisma", () => {
    const alcanzados = [...grafo(PROXY)].map(rel);
    for (const prohibido of [
      "@prisma/client",
      "src/lib/db.ts",
      "bcryptjs",
      "src/auth/sesion.ts",
      "next/headers",
      "qrcode-generator",
      "src/auth/totp.ts",
      "src/auth/presesion.ts",
      "src/auth/presesion-servidor.ts",
      "src/cifrado/sobre.ts",
      "src/cifrado/llavero.ts",
    ]) {
      expect(alcanzados, prohibido).not.toContain(prohibido);
    }
  });

  it("el login solo lee sus variables de entorno, y nunca por nombre dinámico", () => {
    expect(SUPERFICIE.length).toBeGreaterThan(10);
    for (const ruta of SUPERFICIE) {
      const texto = leer(ruta);
      expect(texto, rel(ruta)).not.toMatch(/process\.env\[/);
      for (const [, nombre] of texto.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
        expect(VARIABLES_PERMITIDAS.has(nombre ?? ""), `${rel(ruta)} lee ${nombre}`).toBe(true);
      }
    }
  });

  it("no hay Server Actions en la app", () => {
    for (const ruta of archivos(SRC, (r) => /\.tsx?$/.test(r))) {
      expect(leer(ruta), rel(ruta)).not.toMatch(/["']use server["']/);
    }
  });

  it("cada página que no es pública exige sesión", () => {
    const paginas = archivos(join(SRC, "app"), (r) => /\/page\.tsx$/.test(r));
    expect(paginas.length).toBeGreaterThan(0);
    for (const ruta of paginas) {
      if (PAGINAS_PUBLICAS.has(rel(ruta)) || PAGINAS_PRESESION.has(rel(ruta))) continue;
      expect(leer(ruta), rel(ruta)).toMatch(/\b(?:exigirSesion|exigirDueno)\(\)/);
    }
  });

  it("cada página y API del segundo paso exige la pre-sesión, y existen todas", () => {
    for (const ruta of PAGINAS_PRESESION) expect(leer(join(RAIZ, ruta)), ruta).toMatch(/\bexigirPresesion\(\)/);
    for (const ruta of APIS_PRESESION) expect(leer(join(RAIZ, ruta)), ruta).toMatch(/\bexigirPresesionApi\(/);
  });

  it("regenerar los códigos de recuperación exige la sesión completa", () => {
    expect(leer(join(SRC, "app", "totp", "codigos", "page.tsx"))).toMatch(/\bexigirSesion\(\)/);
    expect(leer(join(SRC, "app", "api", "sesion", "totp", "codigos", "route.ts"))).toMatch(/\bexigirSesionApi\(/);
  });

  it("la librería del QR solo la importa un módulo server-only", () => {
    const quienes = archivos(SRC, (r) => /\.tsx?$/.test(r)).filter((r) => /from\s+["']qrcode-generator["']/.test(leer(r)));
    expect(quienes.map(rel)).toEqual(["src/auth/qr.ts"]);
    expect(leer(join(SRC, "auth", "qr.ts"))).toMatch(/^import "server-only";/);
  });

  it("cada API que no es pública revalida la sesión", () => {
    for (const ruta of archivos(join(SRC, "app"), (r) => /\/route\.ts$/.test(r))) {
      if (APIS_PUBLICAS.has(rel(ruta)) || APIS_PRESESION.has(rel(ruta))) continue;
      expect(leer(ruta), rel(ruta)).toMatch(/\b(exigirSesionApi|validarSesionApi|exigirDuenoApi)\(/);
    }
  });

  it("las rutas públicas de los candados son las mismas que deja pasar el proxy", () => {
    const rutas = leer(join(SRC, "auth", "rutas.ts"));
    for (const ruta of [
      "/ingresar",
      "/definir-clave",
      "/api/salud",
      "/api/sesion/ingresar",
      "/api/sesion/definir-clave",
      "/totp",
      "/totp/enrolar",
      "/api/sesion/totp",
      "/api/sesion/totp/enrolar",
    ]) {
      expect(rutas, ruta).toContain(`"${ruta}"`);
    }
  });

  it.each(["/", "/ingresar", "/api/plan", "/api/salud", "/tablero/algo", "/archivo.txt", "/__nextjs_original-stack-frames"])(
    "el proxy corre en %s",
    (url) => {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    },
  );

  it.each(["/favicon.icox", "/favicon.ico/otra", "/_next/staticx", "/_next/imagenes"])("el matcher está anclado: el proxy corre en %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });

  it.each(["/_next/static/chunks/app.js", "/_next/image?url=x", "/favicon.ico"])("el proxy no corre en el estático %s", (url) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });
});

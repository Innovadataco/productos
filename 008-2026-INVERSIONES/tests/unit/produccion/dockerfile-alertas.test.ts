// El bundle del servicio de las alertas en el Dockerfile: se arma con esbuild después de next build, va en /app/alertas de root y de
// solo lectura (0444), y la imagen no se construye si no carga. Sin la condición react-server: src/alertas no trae `server-only`.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const dockerfile = leer008("Dockerfile");

describe("Dockerfile · el bundle de las alertas", () => {
  it("esbuild de la entrada scripts/servicio-alertas.ts, un solo .mjs de node22 con @prisma/client fuera, después de next build", () => {
    expect(dockerfile).toMatch(/esbuild scripts\/servicio-alertas\.ts --bundle --platform=node --format=esm --target=node22 --external:@prisma\/client --outfile=\.next\/alertas\/servicio-alertas\.mjs/);
    expect(dockerfile.indexOf("servicio-alertas.ts")).toBeGreaterThan(dockerfile.indexOf("npm run build"));
  });

  it("va en /app/alertas, de root y de solo lectura (0444); el usuario de la imagen no lo escribe y el humo carga", () => {
    expect(dockerfile).toContain("mkdir -p -m 0755 /app/alertas");
    expect(dockerfile).toContain("COPY --from=builder --chmod=0444 /app/.next/alertas/servicio-alertas.mjs ./alertas/servicio-alertas.mjs");
    expect(dockerfile).toMatch(/stat -c '%u:%g %a' alertas\/servicio-alertas\.mjs\)" = "0:0 444"/);
    expect(dockerfile).toContain("test ! -w alertas/servicio-alertas.mjs");
    expect(dockerfile).toContain("RUN node alertas/servicio-alertas.mjs --ayuda >/dev/null");
  });

  it("la imagen trae /estado (0700, del usuario 10008): un volumen nombrado nuevo copia su dueño y el servicio puede escribir la marca", () => {
    expect(dockerfile).toMatch(/mkdir -p -m 0700 \/estado && chown 10008:10008 \/estado/);
    expect(dockerfile.indexOf("chown 10008:10008 /estado")).toBeLessThan(dockerfile.indexOf("USER 10008:10008"));
  });

  it("los bundles de precios y de IA siguen igual", () => {
    expect(dockerfile).toContain("RUN node precios/servicio-precios.mjs --ayuda >/dev/null");
    expect(dockerfile).toContain("RUN node ia/servicio-ia.mjs --ayuda >/dev/null");
  });
});

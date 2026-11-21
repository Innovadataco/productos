// Candado de la imagen de producción de Inversiones: base fijada por digest, usuario no root, versión
// horneada, migrador con prisma 5.22.0 y age, y ningún secreto en la imagen ni en su contexto.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const dockerfile = leer008("Dockerfile");
const lineas = dockerfile.split("\n").map((l) => l.trim());
const instrucciones = lineas.filter((l) => l && !l.startsWith("#"));

type Etapa = { nombre: string; desde: string; cuerpo: string[] };
const etapas: Etapa[] = [];
for (const l of instrucciones) {
  const m = /^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i.exec(l);
  if (m) etapas.push({ desde: m[1]!, nombre: (m[2] ?? "").toLowerCase(), cuerpo: [] });
  else etapas.at(-1)?.cuerpo.push(l);
}
const etapa = (nombre: string): Etapa => {
  const e = etapas.find((x) => x.nombre === nombre);
  if (!e) throw new Error(`falta la etapa ${nombre}`);
  return e;
};

describe("Dockerfile de producción", () => {
  it("toda imagen externa va fijada por digest sha256 (las demás son etapas propias)", () => {
    const propias = new Set(etapas.map((e) => e.nombre));
    const externas = etapas.filter((e) => !propias.has(e.desde.toLowerCase()));
    expect(externas.length).toBeGreaterThan(0);
    for (const e of externas) expect(e.desde).toMatch(/^(node:22-alpine|alpine:3\.24)@sha256:[0-9a-f]{64}$/);
  });

  it("tiene las etapas runner (la app), migrador y vigia (vigía y respaldo)", () => {
    expect(etapa("runner")).toBeDefined();
    expect(etapa("migrador")).toBeDefined();
    expect(etapa("vigia")).toBeDefined();
  });

  it("vigia: imagen mínima sobre alpine fijada por digest, sin node: age, curl, certificados y pg_dump 16", () => {
    const e = etapa("vigia");
    expect(e.desde).toMatch(/^alpine:3\.24@sha256:[0-9a-f]{64}$/);
    const cuerpo = e.cuerpo.join("\n");
    expect(cuerpo).toMatch(/apk add --no-cache age curl ca-certificates postgresql16-client/);
    expect(cuerpo).not.toMatch(/node|npm|prisma|COPY --from=deps/);
    expect(cuerpo).toMatch(/docker\/vigia\/vigia\.sh \/usr\/local\/bin\/inv-vigia/);
    expect(cuerpo).toMatch(/docker\/respaldo\/respaldo\.sh \/usr\/local\/bin\/inv-respaldo/);
  });

  it("crea un usuario propio con addgroup y adduser, como PI, con uid fijo", () => {
    expect(dockerfile).toMatch(/addgroup -S -g 10008 \S+ && adduser -S -D -H -u 10008 -G \S+ \S+/);
  });

  for (const nombre of ["runner", "migrador", "vigia"]) {
    it(`${nombre}: corre con un USER numérico que no es root`, () => {
      const usuarios = etapa(nombre).cuerpo.filter((l) => /^USER\s/i.test(l));
      expect(usuarios.at(-1)).toBe("USER 10008:10008");
    });

    it(`${nombre}: hornea APP_VERSION (sha de 40 hex obligatorio) y la etiqueta OCI revision`, () => {
      const cuerpo = etapa(nombre).cuerpo.join("\n");
      expect(cuerpo).toMatch(/^ARG APP_VERSION$/m);
      expect(cuerpo).toMatch(/grep -Eq '\^\[0-9a-f\]\{40\}\$'/);
      expect(cuerpo).toMatch(/APP_VERSION=\$\{APP_VERSION\}/);
      expect(cuerpo).toMatch(/org\.opencontainers\.image\.revision="\$\{APP_VERSION\}"/);
    });
  }

  it("runner: Next standalone escuchando en 0.0.0.0:5008 dentro del contenedor (el mismo puerto que publica)", () => {
    const cuerpo = etapa("runner").cuerpo.join("\n");
    expect(cuerpo).toMatch(/NODE_ENV=production/);
    expect(cuerpo).toMatch(/HOSTNAME=0\.0\.0\.0/);
    expect(cuerpo).toMatch(/PORT=5008/);
    expect(cuerpo).toMatch(/^EXPOSE 5008$/m);
    expect(cuerpo).toMatch(/COPY --from=builder \/app\/\.next\/standalone \.\//);
    expect(cuerpo).toMatch(/CMD \["node", "server\.js"\]/);
  });

  it("runner: el build falla si el standalone no trae el engine de Prisma para musl", () => {
    expect(etapa("runner").cuerpo.join("\n")).toMatch(/test -f node_modules\/\.prisma\/client\/libquery_engine-linux-musl-openssl-3\.0\.x\.so\.node/);
  });

  for (const nombre of ["runner", "migrador", "vigia"]) {
    it(`${nombre}: el build falla si la imagen trae cualquier .env (next build copia el .env al standalone)`, () => {
      expect(etapa(nombre).cuerpo.join("\n")).toMatch(/find \/ -xdev \\\( -name '\.env' -o -name '\.env\.\*' \\\)/);
    });
  }

  it("migrador: prisma 5.22.0 del lockfile, migraciones, guardián, privilegios y tsx", () => {
    const cuerpo = etapa("migrador").cuerpo.join("\n");
    expect(etapa("migrador").desde).toBe("deps");
    expect(cuerpo).not.toMatch(/inv-vigia|inv-respaldo/);
    expect(cuerpo).toMatch(/COPY prisma \.\/prisma/);
    expect(cuerpo).toMatch(/COPY scripts \.\/scripts/);
    expect(cuerpo).toMatch(/docker\/migrador\/privilegios\.sql/);
    expect(cuerpo).toMatch(/CMD \["\/usr\/local\/bin\/inv-migrar"\]/);
    // La carga sin copias en el VPS: el sobre por stdin, el temporal en el tmpfs del migrador.
    expect(cuerpo).toMatch(/^COPY --chmod=0555 docker\/migrador\/cargar\.sh \/usr\/local\/bin\/inv-cargar$/m);
    const lock = JSON.parse(leer008("package-lock.json")) as { packages: Record<string, { version?: string }> };
    expect(lock.packages["node_modules/prisma"]?.version).toBe("5.22.0");
    expect(lock.packages["node_modules/tsx"]?.version).toBeDefined();
  });

  it("ningún ARG ni ENV lleva un nombre de secreto (la imagen no trae secretos)", () => {
    const declaraciones = instrucciones.filter((l) => /^(ARG|ENV)\s/i.test(l)).join("\n");
    expect(declaraciones).not.toMatch(/PASSWORD|SECRET|CLAVE|TOKEN|DATABASE_URL|PRIVATE|AUTH_/i);
  });
});

describe(".dockerignore", () => {
  const ignorados = leer008(".dockerignore")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  it("excluye .env*, node_modules y .next, también en subcarpetas", () => {
    for (const patron of [".env*", "**/.env*", "node_modules", "**/node_modules", ".next"]) {
      expect(ignorados).toContain(patron);
    }
  });

  it("no reincluye ningún .env con «!»", () => {
    expect(ignorados.filter((l) => l.startsWith("!") && l.includes(".env"))).toEqual([]);
  });
});

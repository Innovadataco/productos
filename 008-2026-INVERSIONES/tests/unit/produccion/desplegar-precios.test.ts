// desplegar-prod.sh con el servicio de precios (D-018, PR 3): lo levanta con los permanentes solo si la imagen lo trae
// (su commit tiene src/servicio-precios/bucle.ts; se mira en el clon, sin contenedores), lo verifica (corriendo de una
// vez y healthy, solo la red interna y la suya con el puente br-inv008-prec, sin puertos, sin variables ajenas y con la
// credencial de inv_precios o sin ella) y, con una imagen anterior al servicio, lo baja (--scale inv-008-precios=0) en
// lugar de dejarlo en un bucle de reinicios. La espera de #1035: el primer despliegue con el servicio, 600 s; uno de
// solo código después, 120 s. docker, curl, flock y sleep son falsos (falsos/). Datos inventados.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { carpetaTemporal, correr, crearFalsos, crearRepo, entorno, envProduccionFicticio, git, leer008, type Entorno, type Llamada } from "./falsos";

vi.setConfig({ testTimeout: 60_000 });

const COPIAR = ["Dockerfile", "docker-compose.prod.yml", "scripts/produccion-comun.sh", "scripts/desplegar-prod.sh", "scripts/respaldar-base.sh", "scripts/medir-memoria.sh", "scripts/vigilar-convivencia.sh"];
const BUCLE = "src/servicio-precios/bucle.ts";
const CON_SERVICIO = { [BUCLE]: "// el servicio de precios (ficticio para la prueba)\n" };
const ID = `sha256:${"d".repeat(64)}`;
const CLAVE = "clave-ficticia-4613";
const checks = JSON.stringify({
  total_count: 2,
  check_runs: [
    { name: "inv-gate", status: "completed", conclusion: "success", completed_at: "2027-01-08T15:41:00Z" },
    { name: "app-008", status: "completed", conclusion: "success", completed_at: "2027-01-08T15:37:00Z" },
  ],
});

/** El compose real sin el bloque del servicio de precios: el que corría antes de este PR. */
function composeSinPrecios(): string {
  const texto = leer008("docker-compose.prod.yml");
  const desde = texto.indexOf("  # Servicio de precios (D-018)");
  const hasta = texto.indexOf("\n# Las dos redes internal");
  if (desde < 0 || hasta < desde) throw new Error("no se encontró el bloque del servicio de precios en el compose");
  return `${texto.slice(0, desde)}${texto.slice(hasta + 1)}`;
}

function preparar(archivos: Record<string, string> = CON_SERVICIO, extra: Record<string, string> = {}) {
  const repo = crearRepo(COPIAR, archivos);
  const base = carpetaTemporal("desplegar-precios");
  envProduccionFicticio(base);
  mkdirSync(path.join(base, "respaldos"), { recursive: true });
  const cgroup = path.join(base, "cgroup");
  mkdirSync(path.join(cgroup, "system.slice"), { recursive: true });
  writeFileSync(path.join(cgroup, "system.slice", "memory.events"), "oom 0\noom_kill 0\n");
  const falsos = crearFalsos(base);
  const meminfo = path.join(base, "meminfo");
  writeFileSync(meminfo, "MemTotal: 7913473 kB\nMemAvailable: 3617293 kB\nSwapTotal: 4191233 kB\nSwapFree: 2483117 kB\n");
  const env = entorno(falsos, {
    INV_PROYECTO: "inv-008-prueba",
    INV_BASE: base,
    INV_MEMINFO: meminfo,
    INV_CGROUP: cgroup,
    INV_ESPERA_MEDICION_S: "0",
    FALSO_ID: ID,
    FALSO_SHA: repo.sha,
    FALSO_SALUD: JSON.stringify({ estado: "ok", version: repo.sha }),
    FALSO_SALUD_ARCHIVO: path.join(base, "salud-falsa.json"),
    FALSO_CHECKS: checks,
    FALSO_COMPARE: JSON.stringify({ status: "ahead" }),
    FALSO_RESPALDOS_DIR: path.join(base, "respaldos"),
    FALSO_TAGS: path.join(base, "tags.txt"),
    ...extra,
  });
  return { repo, base, falsos, env, script: path.join(repo.dir008, "scripts/desplegar-prod.sh") };
}
type Preparado = ReturnType<typeof preparar>;

/** Un commit nuevo en el clon (que queda en él) con `cambiar` aplicado; devuelve su sha y el entorno para desplegarlo. */
function commit(p: Preparado, cambiar: (dir008: string) => void, mensaje = "cambio") {
  cambiar(p.repo.dir008);
  git(p.repo.dir, ["add", "-A"]);
  git(p.repo.dir, ["commit", "-q", "--allow-empty", "-m", mensaje]);
  const sha = git(p.repo.dir, ["rev-parse", "HEAD"]);
  const env: Entorno = { ...p.env, FALSO_SHA: sha, FALSO_SALUD: JSON.stringify({ estado: "ok", version: sha }) };
  return { sha, env };
}
/** Agrega bucle.ts al clon: el commit que lo trae es de una imagen con el servicio. */
const conBucle = (dir008: string) => {
  mkdirSync(path.join(dir008, path.dirname(BUCLE)), { recursive: true });
  writeFileSync(path.join(dir008, BUCLE), CON_SERVICIO[BUCLE]);
};
const corriendo = (p: Preparado, sha: string) => {
  const estado = path.join(p.base, "estado");
  mkdirSync(estado, { recursive: true });
  writeFileSync(path.join(estado, "sha-actual"), `${sha}\n`);
  writeFileSync(path.join(estado, "imagen-actual"), `sha256:${"a".repeat(64)}\n`);
};
const ups = (p: Preparado) => readFileSync(path.join(p.base, "tags.txt"), "utf8").trim().split("\n").filter((l) => l.startsWith("up "));
const ultimaLinea = (s: string) => s.trim().split("\n").at(-1);
const enLaRedDePrecios = (l: Llamada) => l[0] === "docker" && l.join(" ").includes("bridge.name") && l.at(-1) === "inv-008-prueba_inv-008-red-precios";

describe("desplegar-prod.sh · servicio de precios: se levanta y se verifica solo si la imagen lo trae", () => {
  it("imagen con el servicio: lo levanta con los permanentes (sin --scale), lo verifica y dice que tiene la credencial de inv_precios", async () => {
    const p = preparar();
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${p.repo.sha}`);
    const final = ups(p).at(-1)!;
    expect(final).toMatch(/ inv-008-app inv-008-entrada inv-008-vigia inv-008-respaldo inv-008-ia inv-008-precios$/);
    expect(final).not.toContain("--scale");
    expect(r.stderr).toContain("la imagen trae el servicio de precios");
    expect(r.stderr).toContain("el servicio de precios corre la imagen enviada");
    expect(r.stderr).toContain("con la credencial de inv_precios");
    // Se verifica dos veces (al levantar y después de la espera), como la app.
    expect(p.falsos.llamadas().filter(enLaRedDePrecios)).toHaveLength(2);
  });

  it("nunca imprime la URL ni la clave del servicio (solo se mira el usuario de su DATABASE_URL)", async () => {
    const p = preparar();
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    for (const dato of [CLAVE, "postgresql://inv_precios", "connection_limit"]) expect(`${r.stdout}${r.stderr}`).not.toContain(dato);
  });

  it("con xtrace (SHELLOPTS=xtrace, como un `bash -x` a mano), la clave del servicio tampoco sale (revisión de seguridad M1)", async () => {
    const p = preparar(CON_SERVICIO, { SHELLOPTS: "xtrace" });
    const r = await correr(p.script, [ID], p.env);
    expect(r.stderr).toContain("+ ");
    const conClave = `${r.stdout}${r.stderr}`.split("\n").filter((l) => l.includes(CLAVE));
    expect(conClave, conClave.join("\n").slice(0, 2000)).toEqual([]);
  });

  it("sin el secreto (DATABASE_URL vacía): despliega y avisa que el servicio queda en espera", async () => {
    const p = preparar(CON_SERVICIO, { FALSO_ENV_PRECIOS: "TZ=America/Bogota\\nDATABASE_URL=\\n" });
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${p.repo.sha}`);
    expect(r.stderr).toMatch(/sin INV_PRECIOS_DATABASE_URL.*en espera/);
  });

  it("acepta las INV_INTRADIA_* de la configuración del ciclo por minuto (vacías, como las pone el compose) y sigue rechazando las ajenas", async () => {
    const nombres = ["ENCENDIDO", "CICLO_SEG", "DESDE_COT", "HASTA_COT", "PAUSA_MS", "RETENCION_DIAS", "HOST_YAHOO"].map((n) => `INV_INTRADIA_${n}=`).join("\\n");
    const p = preparar(CON_SERVICIO, { FALSO_ENV_PRECIOS: `TZ=America/Bogota\\nDATABASE_URL=\\n${nombres}\\n` });
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${p.repo.sha}`);
    const ajena = preparar(CON_SERVICIO, { FALSO_ENV_PRECIOS: `TZ=America/Bogota\\nDATABASE_URL=\\nINV_INTRADIA_OTRA=1\\n` });
    const rechazada = await correr(ajena.script, [ID], ajena.env);
    expect(rechazada.status).not.toBe(0);
    expect(rechazada.stderr).toMatch(/variables que no son suyas: INV_INTRADIA_OTRA/);
  });

  it("imagen anterior al servicio (su commit no trae bucle.ts): lo baja con --scale inv-008-precios=0, no lo verifica y lo dice", async () => {
    const p = preparar({});
    const r = await correr(p.script, [ID], p.env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${p.repo.sha}`);
    expect(ups(p).at(-1)).toMatch(/ --scale inv-008-precios=0 inv-008-app inv-008-entrada inv-008-vigia inv-008-respaldo inv-008-ia inv-008-precios$/);
    expect(r.stderr).toContain("la imagen no trae el servicio de precios");
    expect(p.falsos.llamadas().some(enLaRedDePrecios)).toBe(false);
  });

  // [caso, variables del docker falso, lo que dice] → sale con error, sin DEPLOY VERIFICADO y sin la clave.
  const fallas: Array<[string, Record<string, string>, RegExp]> = [
    ["sin contenedor", { FALSO_CID_PRECIOS: "" }, /no hay contenedor del servicio de precios/],
    ["con reinicios", { FALSO_ESTADO_PRECIOS: "running 3" }, /el servicio de precios no quedó corriendo de una vez/],
    ["sin quedar healthy", { FALSO_SALUD_PRECIOS: "unhealthy" }, /el servicio de precios no está healthy/],
    ["publicando un puerto", { FALSO_PUERTO_PRECIOS: "5008/tcp -> 0.0.0.0:5008" }, /el servicio de precios publica puertos/],
    ["en otra red además", { FALSO_REDES_PRECIOS: "inv-008-prueba_inv-008-red-entrada inv-008-prueba_inv-008-red-interna inv-008-prueba_inv-008-red-precios" }, /el servicio de precios está en otras redes/],
    ["con su red internal (sin salida)", { FALSO_RED_PRECIOS: "true|br-inv008-prec|1" }, /la red de precios no es la esperada/],
    ["con otro nombre de puente", { FALSO_RED_PRECIOS: "false|br-ficticio|1" }, /la red de precios no es la esperada/],
    ["con su red compartida", { FALSO_RED_PRECIOS: "false|br-inv008-prec|2" }, /la red de precios no es la esperada/],
    ["con el token de Telegram en su entorno", { FALSO_ENV_PRECIOS: `TZ=America/Bogota\\nTELEGRAM_BOT_TOKEN=${CLAVE}\\nDATABASE_URL=\\n` }, /variables que no son suyas: TELEGRAM_BOT_TOKEN/],
    ["con una clave de cifrado en su entorno", { FALSO_ENV_PRECIOS: `CIFRADO_CLAVE_V1=${CLAVE}\\nDATABASE_URL=\\n` }, /variables que no son suyas: CIFRADO_CLAVE_V1/],
    ["con la credencial de otro rol", { FALSO_ENV_PRECIOS: `DATABASE_URL=postgresql://inv_app:${CLAVE}@inv-008-db:5432/inversiones\\n` }, /no es la de inv_precios/],
    // Lista blanca (revisión de seguridad M2 y de código M3): solo las de la imagen, DATABASE_URL y TZ.
    ["con PGPASSWORD en su entorno (cambiaría el rol real)", { FALSO_ENV_PRECIOS: `PGPASSWORD=${CLAVE}\\nDATABASE_URL=\\n` }, /variables que no son suyas: PGPASSWORD/],
    ["con una variable cualquiera que no es de la imagen", { FALSO_ENV_PRECIOS: `AWS_SECRET_ACCESS_KEY=${CLAVE}\\nTZ=America/Bogota\\n` }, /variables que no son suyas: AWS_SECRET_ACCESS_KEY/],
    ["con la credencial de inv_precios en otro host", { FALSO_ENV_PRECIOS: `DATABASE_URL=postgresql://inv_precios:${CLAVE}@ejemplo.invalid:5432/inversiones\\n` }, /no es la de inv_precios en inv-008-db/],
  ];
  for (const [caso, falso, dice] of fallas) {
    it(`${caso}: no da el despliegue por verificado y lo dice, sin imprimir la clave`, async () => {
      const p = preparar(CON_SERVICIO, falso);
      const r = await correr(p.script, [ID], p.env);
      expect(r.status).not.toBe(0);
      expect(r.stdout).not.toContain("DEPLOY VERIFICADO");
      expect(r.stderr).toMatch(dice);
      expect(`${r.stdout}${r.stderr}`).not.toContain(CLAVE);
    });
  }
});

describe("desplegar-prod.sh · servicio de precios en la vuelta atrás", () => {
  it("si falla después de up y lo que corría es anterior al servicio, la vuelta atrás lo baja (--scale inv-008-precios=0)", async () => {
    const p = preparar({});
    corriendo(p, p.repo.sha);
    const { env } = commit(p, conBucle);
    const r = await correr(p.script, [ID], { ...env, FALSO_SALUD_PRECIOS: "unhealthy" });
    expect(r.status).not.toBe(0);
    const vuelta = ups(p).at(-1)!;
    expect(vuelta).toMatch(new RegExp(`^up ${p.repo.sha} .* --scale inv-008-precios=0 inv-008-app inv-008-entrada inv-008-vigia inv-008-respaldo inv-008-ia inv-008-precios$`));
    expect(r.stderr).toContain("vuelta atrás");
  });

  it("si lo que corría ya trae el servicio, la vuelta atrás lo levanta con los permanentes", async () => {
    const p = preparar();
    corriendo(p, p.repo.sha);
    const { env } = commit(p, (d) => writeFileSync(path.join(d, "codigo.ficticio.ts"), "export const x = 4613;\n"));
    const r = await correr(p.script, [ID], { ...env, FALSO_SALUD_PRECIOS: "unhealthy" });
    expect(r.status).not.toBe(0);
    const vuelta = ups(p).at(-1)!;
    expect(vuelta).toMatch(new RegExp(`^up ${p.repo.sha} .* inv-008-respaldo inv-008-ia inv-008-precios$`));
    expect(vuelta).not.toContain("--scale");
  });
});

describe("desplegar-prod.sh · servicio de precios y la espera de #1035", () => {
  const sleeps = (p: Preparado) => p.falsos.llamadas().filter((l) => l[0] === "sleep").map((l) => l[1]);
  const lineaEspera = (stderr: string) => stderr.split("\n").filter((l) => l.includes("espera de la medición"));

  it("el PRIMER despliegue con el servicio (lo que corre es el compose sin él): 600 s, y la línea nombra el servicio nuevo", async () => {
    const p = preparar({ "docker-compose.prod.yml": composeSinPrecios() });
    corriendo(p, p.repo.sha);
    const { sha, env } = commit(p, (d) => {
      writeFileSync(path.join(d, "docker-compose.prod.yml"), leer008("docker-compose.prod.yml"));
      conBucle(d);
    });
    delete env.INV_ESPERA_MEDICION_S;
    const r = await correr(p.script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${sha}`);
    expect(sleeps(p)).toEqual(["600"]);
    const lineas = lineaEspera(r.stderr);
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).toMatch(/espera de la medición: 600 s · cambian servicios.*inv-008-precios/);
  });

  it("después, un despliegue de solo código con el servicio ya corriendo: 120 s", async () => {
    const p = preparar();
    corriendo(p, p.repo.sha);
    const { sha, env } = commit(p, (d) => writeFileSync(path.join(d, "codigo.ficticio.ts"), "export const x = 4613;\n"));
    delete env.INV_ESPERA_MEDICION_S;
    const r = await correr(p.script, [ID], env);
    expect(r.status, r.stderr).toBe(0);
    expect(ultimaLinea(r.stdout)).toBe(`DEPLOY VERIFICADO ${sha}`);
    expect(sleeps(p)).toEqual(["120"]);
    expect(lineaEspera(r.stderr)[0]).toMatch(/espera de la medición: 120 s · solo código/);
  });
});

describe("la guarda imagen_con_servicio_precios", () => {
  it("es la misma en desplegar-prod.sh y en reanudar-008.sh, y solo mira el clon (git, sin contenedores ni red)", () => {
    const de = (archivo: string) => {
      const m = /\nimagen_con_servicio_precios\(\) \{\n[\s\S]*?\n\}\n/.exec(leer008(archivo));
      if (!m) throw new Error(`${archivo} no define imagen_con_servicio_precios`);
      return m[0];
    };
    expect(de("scripts/desplegar-prod.sh")).toBe(de("scripts/reanudar-008.sh"));
    expect(de("scripts/desplegar-prod.sh")).toContain("cat-file -e");
    expect(de("scripts/desplegar-prod.sh")).toContain("src/servicio-precios/bucle.ts");
    expect(de("scripts/desplegar-prod.sh")).not.toMatch(/docker|curl|wget/);
  });
});

// Candados estáticos de los scripts de producción (orden de Jelk: «no tocar gesmovil ni pi, solo
// inversiones, ojo no puede dañar nada»). Recorre cada script y falla si encuentra:
//  1. un docker global (prune, stop/rm sobre $(docker ps ...)) o un subcomando de docker fuera de la lista;
//  2. un nombre pi-, bi-, gesmovil o hermes en CUALQUIER comando de docker (ni siquiera de lectura: el OOM
//     de PI se lee del cgroup jerárquico, sin Docker);
//  3. un `docker compose` que no salga de la variable COMPOSE (proyecto inv-008-prod);
//  4. ufw, systemctl (salvo --user), /etc/, crontab, iptables o cloudflared.
// Cada regla tiene su control positivo: si el revisor deja de morder, la prueba se pone en rojo.
import { describe, expect, it } from "vitest";
import { leer008 } from "./falsos";

const SCRIPTS = [
  "scripts/produccion-comun.sh",
  "scripts/construir-imagen.sh",
  "scripts/crear-roles-prod.sh",
  "scripts/desplegar-prod.sh",
  "scripts/respaldar-base.sh",
  "scripts/medir-memoria.sh",
  "scripts/vigilar-convivencia.sh",
  "scripts/pausar-008.sh",
  "scripts/reanudar-008.sh",
  "scripts/crear-acceso-inicial.sh",
  "docker/migrar.sh",
];

type Hallazgo = { regla: string; linea: number; texto: string };

// Subcomandos de docker que un script puede llamar directo. Lo que cambia contenedores (stop, start,
// rm, run, up…) va siempre por "${COMPOSE[@]}", que fija el proyecto inv-008-prod.
const DOCKER_PERMITIDOS = /^docker\s+(?:(?:image\s+(?:inspect|ls|rm)|inspect|port|stats|load|save|buildx\s+build)\b|exec\s+"\$cid"(?=\s))/;
const NOMBRES_AJENOS = /(^|[^a-z0-9])(pi-|bi-|gesmovil|hermes)/i;

function revisar(archivo: string, contenido: string): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  contenido.split("\n").forEach((cruda, i) => {
    const texto = cruda.trim();
    if (!texto || texto.startsWith("#")) return;
    const agregar = (regla: string) => hallazgos.push({ regla, linea: i + 1, texto });

    if (/\bdocker\s+(system|image|volume|network|container|builder)\s+prune\b/.test(texto)) agregar("docker-global");
    if (/\bdocker\s+(stop|rm|kill|restart|pause|update|start)\b[^\n]*\$\(\s*docker\s+ps/.test(texto)) agregar("docker-global");
    if (/\bdocker\s+compose\b|\bdocker-compose(\s|$)/.test(texto) && archivo !== "scripts/produccion-comun.sh") agregar("compose-fuera-de-COMPOSE");

    for (const m of texto.matchAll(/(?:^|[\s;|&(`$])(docker\s+[^|;&)]*)/g)) {
      const comando = m[1]!.trim();
      if (/^docker\s+compose\b/.test(comando)) continue;
      if (!DOCKER_PERMITIDOS.test(comando)) agregar("docker-no-permitido");
      if (NOMBRES_AJENOS.test(comando)) agregar("nombre-ajeno");
    }
    if (/\bufw\b|\biptables\b|\bcrontab\b|\bcloudflared\b|\/etc\//.test(texto)) agregar("sistema");
    if (/\bsystemctl\b(?!\s+--user)/.test(texto)) agregar("sistema");
  });
  return hallazgos;
}

describe("candados de los scripts de producción", () => {
  for (const archivo of SCRIPTS) {
    it(`${archivo}: sin docker global, sin tocar PI, BI, Gesmovil ni Hermes, sin tocar el sistema`, () => {
      expect(revisar(archivo, leer008(archivo))).toEqual([]);
    });
  }

  it("todo script de producción carga produccion-comun.sh (proyecto y rutas con candado)", () => {
    for (const archivo of SCRIPTS.filter((a) => a.startsWith("scripts/") && a !== "scripts/produccion-comun.sh")) {
      expect(leer008(archivo), archivo).toMatch(/source "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/produccion-comun\.sh"/);
    }
  });

  it("pausar, reanudar y desplegar toman los candados de Inversiones", () => {
    for (const archivo of ["scripts/pausar-008.sh", "scripts/reanudar-008.sh", "scripts/desplegar-prod.sh"]) {
      expect(leer008(archivo), archivo).toMatch(/tomar_candado/);
    }
  });

  it("todo script que corre con sudo revisa el árbol justo después de preparar_entorno; la pausa solo avisa", () => {
    const conSudo = [
      "scripts/desplegar-prod.sh",
      "scripts/crear-roles-prod.sh",
      "scripts/crear-acceso-inicial.sh",
      "scripts/reanudar-008.sh",
      "scripts/respaldar-base.sh",
      "scripts/medir-memoria.sh",
      "scripts/vigilar-convivencia.sh",
    ];
    for (const archivo of conSudo) expect(leer008(archivo), archivo).toMatch(/^\s*preparar_entorno\n\s*revisar_arbol\n/m);
    expect(leer008("scripts/pausar-008.sh")).toMatch(/^\s*preparar_entorno\n\s*revisar_arbol --solo-avisar\n/m);
    // La revisión tardía (dentro de verificar_clon, después de docker load) ya no existe.
    expect(leer008("scripts/desplegar-prod.sh")).not.toMatch(/scripts_seguros/);
  });

  it("los scripts que escriben en el VPS pasan cada ruta por ruta_escribible", () => {
    for (const archivo of ["scripts/desplegar-prod.sh", "scripts/respaldar-base.sh", "scripts/medir-memoria.sh", "scripts/vigilar-convivencia.sh"]) {
      expect(leer008(archivo), archivo).toMatch(/ruta_escribible/);
    }
  });
});

describe("controles positivos del revisor (si dejan de morder, el candado no sirve)", () => {
  const casos: Array<[string, string, string]> = [
    ["docker system prune -af", "scripts/desplegar-prod.sh", "docker-global"],
    ["docker image prune -a", "scripts/desplegar-prod.sh", "docker-global"],
    ["docker volume prune -f", "scripts/desplegar-prod.sh", "docker-global"],
    ["docker network prune -f", "scripts/desplegar-prod.sh", "docker-global"],
    ["docker stop $(docker ps -q)", "scripts/pausar-008.sh", "docker-global"],
    ["docker stop pi-app", "scripts/vigilar-convivencia.sh", "nombre-ajeno"],
    ["docker exec pi-db psql", "scripts/vigilar-convivencia.sh", "nombre-ajeno"],
    ["docker restart bi-app", "scripts/pausar-008.sh", "nombre-ajeno"],
    ["docker inspect gesmovil-db", "scripts/pausar-008.sh", "nombre-ajeno"],
    ["docker ps -a --filter 'name=^pi-'", "scripts/vigilar-convivencia.sh", "nombre-ajeno"],
    ["docker inspect pi-app", "scripts/vigilar-convivencia.sh", "nombre-ajeno"],
    ["docker ps -q", "scripts/medir-memoria.sh", "docker-no-permitido"],
    ["docker update --memory 1g hermes", "scripts/vigilar-convivencia.sh", "nombre-ajeno"],
    ["docker stop inv-008-prod-inv-008-app-1", "scripts/pausar-008.sh", "docker-no-permitido"],
    ["docker run --rm alpine true", "scripts/respaldar-base.sh", "docker-no-permitido"],
    ["docker compose -p otro stop", "scripts/pausar-008.sh", "compose-fuera-de-COMPOSE"],
    ["sudo ufw allow 5008", "scripts/desplegar-prod.sh", "sistema"],
    ["systemctl restart cloudflared-hermes", "scripts/desplegar-prod.sh", "sistema"],
    ["cp x /etc/cloudflared/config.yml", "scripts/desplegar-prod.sh", "sistema"],
    ["crontab -l", "scripts/respaldar-base.sh", "sistema"],
  ];
  for (const [linea, archivo, regla] of casos) {
    it(`detecta «${linea}» (${regla})`, () => {
      expect(revisar(archivo, linea).map((h) => h.regla)).toContain(regla);
    });
  }

  it("deja pasar lo permitido: COMPOSE, stats de los ids del proyecto, systemctl --user y comentarios", () => {
    expect(revisar("scripts/medir-memoria.sh", 'docker stats --no-stream $ids')).toEqual([]);
    expect(revisar("scripts/pausar-008.sh", '"${COMPOSE[@]}" stop')).toEqual([]);
    expect(revisar("scripts/pausar-008.sh", "systemctl --user list-timers")).toEqual([]);
    expect(revisar("scripts/desplegar-prod.sh", "# docker system prune está prohibido")).toEqual([]);
  });
});

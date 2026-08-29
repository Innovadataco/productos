/**
 * SPEC-126 · Generador de `docs/architecture/06-stack.md`.
 * Fuentes: `package.json` (dependencias, scripts, engines), `Dockerfile` (etapas,
 * EXPOSE, CMD) y `docker-compose.yml` / `docker-compose.prod.yml` (servicios,
 * imágenes, puertos). Parseo textual determinista; nunca valores de secretos.
 *
 * Uso CLI: `npx tsx scripts/arch/generar-stack.ts` (escribe el artefacto).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { ARTEFACTOS, encabezadoGenerado } from "./artefactos";
import { RUTA_COMPOSE_DEV, RUTA_COMPOSE_PROD, RUTA_DOCS_ARCH, RUTA_DOCKERFILE, RUTA_PACKAGE_JSON } from "./lib/paths";

interface ServicioCompose {
    nombre: string;
    imagen?: string;
    build?: boolean;
    containerName?: string;
    puertos: string[];
}

/** Parseo textual mínimo de un docker-compose: servicios con imagen/build y puertos. */
function parsearCompose(ruta: string): ServicioCompose[] {
    const texto = fs.readFileSync(ruta, "utf-8");
    const servicios: ServicioCompose[] = [];
    let actual: ServicioCompose | null = null;
    let enServicios = false;
    let enPuertos = false;
    for (const linea of texto.split("\n")) {
        if (/^services:\s*$/.test(linea)) {
            enServicios = true;
            continue;
        }
        // Una clave de nivel raíz distinta cierra el bloque de servicios (p. ej. volumes:).
        if (/^\S/.test(linea)) {
            enServicios = false;
            actual = null;
            continue;
        }
        if (!enServicios) continue;
        const servicio = linea.match(/^  (\w[\w-]*):\s*$/);
        if (servicio) {
            actual = { nombre: servicio[1], puertos: [] };
            servicios.push(actual);
            enPuertos = false;
            continue;
        }
        if (!actual) continue;
        if (/^    ports:\s*$/.test(linea)) {
            enPuertos = true;
            continue;
        }
        if (/^    \w/.test(linea)) enPuertos = false;
        const imagen = linea.match(/^    image:\s*(.+?)\s*$/);
        if (imagen) actual.imagen = imagen[1];
        if (/^    build:\s*/.test(linea)) actual.build = true;
        const container = linea.match(/^    container_name:\s*(.+?)\s*$/);
        if (container) actual.containerName = container[1];
        const puerto = linea.match(/^      -\s*"?([0-9]+:[0-9]+)"?\s*$/);
        if (enPuertos && puerto) actual.puertos.push(puerto[1]);
    }
    return servicios.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

function seccionCompose(titulo: string, ruta: string): string[] {
    const servicios = parsearCompose(ruta);
    const lineas = [`### ${titulo}`, "", "| Servicio | Imagen / build | Contenedor | Puertos (host:interno) |", "| --- | --- | --- | --- |"];
    for (const s of servicios) {
        const origen = s.imagen ? `\`${s.imagen}\`` : s.build ? "build local (Dockerfile)" : "—";
        const imagenYBuild = s.imagen && s.build ? `${origen} (+ build local)` : origen;
        lineas.push(`| ${s.nombre} | ${imagenYBuild} | ${s.containerName ? `\`${s.containerName}\`` : "—"} | ${s.puertos.join(", ") || "—"} |`);
    }
    lineas.push("");
    return lineas;
}

export function generarStack(): string {
    const propio = ARTEFACTOS.find((a) => a.archivo === "06-stack.md")!;
    const pkg = JSON.parse(fs.readFileSync(RUTA_PACKAGE_JSON, "utf-8")) as {
        name: string;
        engines?: Record<string, string>;
        scripts: Record<string, string>;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
    };
    const dockerfile = fs.readFileSync(RUTA_DOCKERFILE, "utf-8");
    const etapas = [...dockerfile.matchAll(/^FROM\s+(\S+)(?:\s+AS\s+(\w+))?/gm)].map((m) =>
        m[2] ? `${m[1]} (etapa \`${m[2]}\`)` : m[1]
    );
    const expose = [...dockerfile.matchAll(/^EXPOSE\s+(\d+)/gm)].map((m) => m[1]);
    const cmds = [...dockerfile.matchAll(/^CMD\s+(.+)$/gm)].map((m) => m[1]);

    const lineas: string[] = [
        encabezadoGenerado(propio.generador, propio.fuentes),
        "# 06 · Stack, contenedores y puertos",
        "",
        `Paquete: \`${pkg.name}\`. Runtime: Node ${pkg.engines?.node ?? "(sin engines declarado)"}.`,
        "Valores de secretos NUNCA se documentan aquí: solo nombres de variables y puertos.",
        "",
        "## Dependencias de runtime (package.json)",
        "",
        "| Dependencia | Versión |",
        "| --- | --- |",
    ];
    for (const [nombre, version] of Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b))) {
        lineas.push(`| ${nombre} | ${version} |`);
    }
    lineas.push("", "## Dependencias de desarrollo (package.json)", "", "| Dependencia | Versión |", "| --- | --- |");
    for (const [nombre, version] of Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b))) {
        lineas.push(`| ${nombre} | ${version} |`);
    }
    lineas.push("", "## Scripts npm (package.json)", "", "| Script | Comando |", "| --- | --- |");
    for (const [nombre, comando] of Object.entries(pkg.scripts).sort(([a], [b]) => a.localeCompare(b))) {
        lineas.push(`| \`${nombre}\` | \`${comando.replaceAll("|", "\\|")}\` |`);
    }
    lineas.push(
        "",
        "## Imagen de producción (Dockerfile)",
        "",
        `Etapas: ${etapas.join(" → ")}.`,
        `Puertos expuestos: ${expose.join(", ") || "—"}.`,
        `Comando por defecto: ${cmds.map((c) => `\`${c}\``).join(" · ") || "—"}.`,
        "",
        "## Contenedores y puertos",
        ""
    );
    lineas.push(...seccionCompose("Desarrollo (`docker-compose.yml`)", RUTA_COMPOSE_DEV));
    lineas.push(...seccionCompose("Producción (`docker-compose.prod.yml`)", RUTA_COMPOSE_PROD));
    return lineas.join("\n");
}

function main() {
    const destino = path.join(RUTA_DOCS_ARCH, "06-stack.md");
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, generarStack());
    console.log(`[Arch:gen] ${destino} escrito.`);
}

if (process.argv[1]?.endsWith("generar-stack.ts")) {
    main();
}

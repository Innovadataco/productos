#!/usr/bin/env tsx
/**
 * Genera la hoja de credenciales markdown para el demo.
 * Uso:
 *   node --import tsx scripts/demo-prod/hoja-credenciales.ts
 */
import fs from "node:fs";
import path from "node:path";

interface UsuarioCredencial {
    email: string;
    rol: string;
    password: string;
}

interface ColegioCredencial {
    nombre: string;
    adminEmail: string;
}

interface DemoCredenciales {
    corrida: string;
    password: string;
    usuarios: UsuarioCredencial[];
    colegios: ColegioCredencial[];
}

function esCredenciales(obj: unknown): obj is DemoCredenciales {
    if (typeof obj !== "object" || obj === null) return false;
    const c = obj as DemoCredenciales;
    return (
        typeof c.corrida === "string" &&
        typeof c.password === "string" &&
        Array.isArray(c.usuarios) &&
        Array.isArray(c.colegios)
    );
}

function escaparCelda(valor: string): string {
    return valor.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function obtenerRutaCredenciales(): string {
    const runDir = process.env.RUN_DIR || (fs.existsSync("/app/run") ? "/app/run" : path.resolve(import.meta.dirname ?? "."));
    return path.resolve(runDir, ".demo-credenciales.json");
}

function main() {
    const ruta = obtenerRutaCredenciales();
    if (!fs.existsSync(ruta)) {
        console.error(`[hoja-credenciales] No existe ${ruta}. Ejecute sembrar-demo.ts primero.`);
        process.exit(1);
    }

    const raw = JSON.parse(fs.readFileSync(ruta, "utf8")) as unknown;
    if (!esCredenciales(raw)) {
        console.error("[hoja-credenciales] El archivo de credenciales tiene un formato inesperado.");
        process.exit(1);
    }

    const porRol = new Map<string, UsuarioCredencial[]>();
    for (const u of raw.usuarios) {
        const lista = porRol.get(u.rol) ?? [];
        lista.push(u);
        porRol.set(u.rol, lista);
    }

    const lineas: string[] = [];
    lineas.push(`# Credenciales Demo — ${raw.corrida}`);
    lineas.push("");
    lineas.push(`- **Corrida:** ${raw.corrida}`);
    lineas.push(`- **Contraseña común:** \`${raw.password}\``);
    lineas.push("");
    lineas.push("## Usuarios demo");
    lineas.push("");
    lineas.push("| Rol | Email | Contraseña |");
    lineas.push("|-----|-------|------------|");

    const ordenRoles = ["SCHOOL_ADMIN", "OPERADOR", "COMITE_VALIDACION", "PARENT"];
    for (const rol of ordenRoles) {
        const usuarios = porRol.get(rol) ?? [];
        for (const u of usuarios) {
            lineas.push(`| ${escaparCelda(rol)} | ${escaparCelda(u.email)} | ${escaparCelda(u.password)} |`);
        }
    }

    lineas.push("");
    lineas.push("## Colegios demo");
    lineas.push("");
    lineas.push("| Colegio | Email administrador |");
    lineas.push("|---------|---------------------|");
    for (const c of raw.colegios) {
        lineas.push(`| ${escaparCelda(c.nombre)} | ${escaparCelda(c.adminEmail)} |`);
    }

    lineas.push("");
    lineas.push("## Comandos");
    lineas.push("");
    lineas.push("### Procesar reportes frescos");
    lineas.push("```bash");
    lineas.push("node --env-file=.env --import tsx scripts/demo-prod/procesar-reportes-demo.ts");
    lineas.push("```");
    lineas.push("");
    lineas.push("### Purgar todo el demo");
    lineas.push("```bash");
    lineas.push("node --env-file=.env --import tsx scripts/demo-prod/purgar-demo.ts");
    lineas.push("```");
    lineas.push("");

    console.log(lineas.join("\n"));
}

main();

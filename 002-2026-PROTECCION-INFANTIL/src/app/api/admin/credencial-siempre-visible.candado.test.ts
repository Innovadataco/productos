/**
 * SPEC-423 (I-298) · Candado permanente: la credencial de respaldo se muestra
 * SIEMPRE en las respuestas admin que la generan.
 *
 * El defecto que este candado caza — verificado en producción por CEO:
 *   `passwordTemporal: emailEnviado ? undefined : password`
 * evaluaba si el motor de notificaciones había ENCOLADO, no si el correo
 * había llegado. Encolar siempre funciona (SPEC-201/296), así que
 * `emailEnviado` era siempre true → la credencial nunca se revelaba, ni
 * siquiera cuando el envío real fallaba en el worker (`[daily_quota_exceeded]`).
 * Se propagó copiando cuatro veces el mismo error.
 *
 * Regla: en `/api/admin/**` **ningún** endpoint puede tener el patrón
 * `passwordTemporal|enlace: <cond> ? undefined : <credencial>`. La credencial
 * viaja SIEMPRE. Los comentarios que documentan la lección están permitidos.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_ADMIN = path.resolve(__dirname);

function* recorrer(directorio: string): Generator<string> {
    for (const entrada of fs.readdirSync(directorio, { withFileTypes: true })) {
        if (entrada.isDirectory()) {
            yield* recorrer(path.join(directorio, entrada.name));
        } else if (/^route\.ts$/.test(entrada.name)) {
            yield path.join(directorio, entrada.name);
        }
    }
}

/**
 * Elimina bloques y líneas de comentarios (aprox.) para no cazar la
 * explicación histórica del defecto en comentarios de servicio.
 */
function sinComentarios(contenido: string): string {
    return contenido
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// Cazamos `<field>: <expr> ? undefined : <credencial-like>` para los tres
// nombres que hoy usa la app.
const PATRON_FUGA = /\b(passwordTemporal|enlace|password|token)\s*:\s*[^,{}]*\?\s*undefined\s*:/g;

describe("SPEC-423 · credencial siempre visible en /api/admin/** (candado I-298)", () => {
    const archivos = [...recorrer(RUTA_ADMIN)];

    it("hay archivos de rutas admin escaneados (contraprueba del scanner)", () => {
        // Contraprueba mínima: si algún día alguien mueve la carpeta o el
        // recorrer falla en silencio, este test avisa. 20 es un piso holgado.
        expect(archivos.length).toBeGreaterThan(20);
    });

    it("ningún endpoint condiciona `passwordTemporal|enlace|password|token` a `undefined` según un flag de correo", () => {
        const violaciones: string[] = [];
        for (const archivo of archivos) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            const matches = codigo.match(PATRON_FUGA);
            if (matches && matches.length > 0) {
                const relativo = path.relative(RUTA_ADMIN, archivo);
                for (const m of matches) violaciones.push(`${relativo}: ${m.trim()}`);
            }
        }
        expect(
            violaciones,
            [
                "SPEC-423 (I-298) — credencial escondida por condicional de encolado:",
                ...violaciones,
                "",
                "El motor de notif encolla siempre, así que ese flag no mide entrega real.",
                "La credencial de respaldo tiene que viajar SIEMPRE y el mensaje debe",
                "decir «encolado», no «enviado». Ver SPEC-423/spec.md.",
            ].join("\n"),
        ).toEqual([]);
    });
});

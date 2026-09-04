/**
 * SPEC-423 (I-298) · Candado permanente: los endpoints admin del contrato
 * "SIEMPRE muestra" no pueden esconder la credencial detrás de un flag.
 *
 * El defecto que este candado caza — verificado en producción por CEO en I-298:
 *   `passwordTemporal: emailEnviado ? undefined : password`
 * en `restablecer-password` (y análogos). El `emailEnviado` medía si el motor
 * de notificaciones había ENCOLADO, no si el correo había llegado. Encolar
 * siempre funciona (SPEC-201/296), así que la credencial nunca se revelaba.
 * Se propagó copiando el mismo error a padres/colegios/operadores/profesionales
 * y a `solicitudes/reenviar` (donde el "enlace" era la credencial).
 *
 * Contrato Jelkin (22:5x) — DOS BOTONES DISTINTOS, cada uno con su semántica:
 *   · «restablecer contraseña» / «regenerar contraseña»
 *     → SIEMPRE muestra la credencial en pantalla (este candado la protege).
 *   · «reenviar por correo»
 *     → NUNCA la devuelve cuando el envío se encoló bien; único fallback es
 *       el fallo de encolado (copia manual). El patrón condicional ES el
 *       contrato correcto ahí, así que reenviar-email queda FUERA del scan.
 *
 * Regla: en los endpoints listados abajo, NINGUNO puede tener el patrón
 * `passwordTemporal|enlace|password|token: <cond> ? undefined : <credencial>`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const RUTA_ADMIN = path.resolve(__dirname);

// Endpoints cuyo contrato es "SIEMPRE muestra" — únicos alcanzados por el
// candado. Coincide con path relativo a `/api/admin/**` (POSIX-normalizado).
const RUTAS_SIEMPRE_MUESTRA = [
    /(^|\/)restablecer-password\/route\.ts$/,
    /(^|\/)regenerar-password\/route\.ts$/,
    /(^|\/)solicitudes\/reenviar\/route\.ts$/,
];

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

// Cazamos `<field>: <expr> ? undefined : <credencial-like>` para los cuatro
// nombres que hoy usa la app.
const PATRON_FUGA = /\b(passwordTemporal|enlace|password|token)\s*:\s*[^,{}]*\?\s*undefined\s*:/g;

describe("SPEC-423 · credencial siempre visible en endpoints admin «SIEMPRE muestra» (I-298)", () => {
    const todosRoute = [...recorrer(RUTA_ADMIN)];
    const alcanzados = todosRoute.filter((abs) => {
        const rel = path.relative(RUTA_ADMIN, abs).split(path.sep).join("/");
        return RUTAS_SIEMPRE_MUESTRA.some((re) => re.test(rel));
    });

    it("cubre los endpoints «SIEMPRE muestra» conocidos (contraprueba)", () => {
        // Piso: hoy hay 6 (padres/prof/verificadores restablecer-password,
        // colegios/prof regenerar-password, solicitudes/reenviar). Si
        // desaparece uno, avisa. SPEC-435 sumó verificadores.
        expect(alcanzados.length).toBeGreaterThanOrEqual(6);
    });

    it("ningún endpoint «SIEMPRE muestra» condiciona la credencial a `undefined` según un flag de correo", () => {
        const violaciones: string[] = [];
        for (const archivo of alcanzados) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            const matches = codigo.match(PATRON_FUGA);
            if (matches && matches.length > 0) {
                const relativo = path.relative(RUTA_ADMIN, archivo).split(path.sep).join("/");
                for (const m of matches) violaciones.push(`${relativo}: ${m.trim()}`);
            }
        }
        expect(
            violaciones,
            [
                "SPEC-423 (I-298) — credencial escondida por condicional de encolado en un endpoint «SIEMPRE muestra»:",
                ...violaciones,
                "",
                "El motor de notif encolla siempre, así que ese flag no mide entrega real.",
                "En restablecer-password / regenerar-password / solicitudes/reenviar la credencial",
                "TIENE que viajar SIEMPRE. Si el endpoint es «reenviar por correo», el patrón",
                "condicional es válido (contrato Jelkin: «reenviar» NUNCA la devuelve).",
                "Ver SPEC-423/spec.md.",
            ].join("\n"),
        ).toEqual([]);
    });
});

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
// SPEC-435 (refutación adversarial 04-09): el ALTA de cuentas (verificadores,
// operadores, colegios) también devuelve `passwordTemporal` incondicional y
// estaba fuera del candado — un copy-paste del defecto I-298 en esos endpoints
// habría pasado invisible. Los sumamos: piso 5 → 9.
const RUTAS_SIEMPRE_MUESTRA = [
    /(^|\/)restablecer-password\/route\.ts$/,
    /(^|\/)regenerar-password\/route\.ts$/,
    /(^|\/)solicitudes\/reenviar\/route\.ts$/,
    // Altas de cuentas admin que muestran el password inicial (SIEMPRE en respuesta).
    /(^|\/)(verificadores|operadores|colegios)\/route\.ts$/,
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

// SPEC-435 (refutación adversarial 04-09): endurecemos el vocabulario y el
// patrón. Antes solo se cazaba `<field>: <expr> ? undefined : <cred>` con 4
// nombres — evadible con ternario invertido, otros sentinels (`null`, `""`,
// `void 0`), `delete respuesta.password`, o campos con nombres nuevos
// (`clave`, `credencial`, …). Ahora:
//   · Vocabulario ampliado a nombres razonables de credencial.
//   · Cazamos AMBOS lados del ternario: `? undefined :` y `: undefined` (invertido).
//   · Cazamos sentinels equivalentes: `undefined`, `null`, `""`, `void 0`.
//   · Alarma `delete respuesta.<credencial>` sobre los mismos archivos.
const CAMPOS_CREDENCIAL = "passwordTemporal|enlace|password|token|clave\\w*|credencial|contrasena|secretoInicial|otp|newPassword";
const SENTINEL = "(?:undefined|null|\"\"|''|void\\s*0)";
// Ternario directo:   passwordTemporal: <cond> ? undefined : <expr>
const PATRON_FUGA_DIRECTO = new RegExp(
    `\\b(${CAMPOS_CREDENCIAL})\\s*:\\s*[^,{}]*\\?\\s*${SENTINEL}\\s*:`,
    "g"
);
// Ternario invertido:  passwordTemporal: <cond> ? <expr> : undefined
const PATRON_FUGA_INVERTIDO = new RegExp(
    `\\b(${CAMPOS_CREDENCIAL})\\s*:\\s*[^,{}]*\\?[^,{}]*:\\s*${SENTINEL}\\b`,
    "g"
);
// Eliminación imperativa: delete respuesta.passwordTemporal
const PATRON_DELETE = new RegExp(
    `\\bdelete\\s+\\w+\\.(${CAMPOS_CREDENCIAL})\\b`,
    "g"
);
const PATRONES_FUGA: Array<{ nombre: string; regex: RegExp }> = [
    { nombre: "ternario ? sentinel :", regex: PATRON_FUGA_DIRECTO },
    { nombre: "ternario invertido ? expr : sentinel", regex: PATRON_FUGA_INVERTIDO },
    { nombre: "delete respuesta.<credencial>", regex: PATRON_DELETE },
];

describe("SPEC-423 · credencial siempre visible en endpoints admin «SIEMPRE muestra» (I-298)", () => {
    const todosRoute = [...recorrer(RUTA_ADMIN)];
    const alcanzados = todosRoute.filter((abs) => {
        const rel = path.relative(RUTA_ADMIN, abs).split(path.sep).join("/");
        return RUTAS_SIEMPRE_MUESTRA.some((re) => re.test(rel));
    });

    it("cubre los endpoints «SIEMPRE muestra» conocidos (contraprueba)", () => {
        // Piso: 9 endpoints tras SPEC-435:
        //   3 restablecer-password (padres, profesionales, verificadores)
        //   2 regenerar-password (colegios, operadores)
        //   1 solicitudes/reenviar (profesionales)
        //   3 altas de cuentas (verificadores, operadores, colegios) — SPEC-435
        // Si desaparece uno, avisa.
        expect(alcanzados.length).toBeGreaterThanOrEqual(9);
    });

    it("ningún endpoint «SIEMPRE muestra» esconde la credencial (ternario, sentinel o delete)", () => {
        const violaciones: string[] = [];
        for (const archivo of alcanzados) {
            const codigo = sinComentarios(fs.readFileSync(archivo, "utf-8"));
            const relativo = path.relative(RUTA_ADMIN, archivo).split(path.sep).join("/");
            for (const { nombre, regex } of PATRONES_FUGA) {
                const matches = codigo.match(regex);
                if (matches && matches.length > 0) {
                    for (const m of matches) violaciones.push(`${relativo} [${nombre}]: ${m.trim()}`);
                }
            }
        }
        expect(
            violaciones,
            [
                "SPEC-423 (I-298) / SPEC-435 — credencial escondida en un endpoint «SIEMPRE muestra»:",
                ...violaciones,
                "",
                "Formas cazadas: `X: cond ? undefined : password`, `X: cond ? password : undefined`,",
                "sentinels equivalentes (`null`, `\"\"`, `void 0`), y `delete respuesta.X`.",
                "En restablecer-password / regenerar-password / solicitudes/reenviar / altas de cuentas",
                "la credencial TIENE que viajar SIEMPRE. Si el endpoint es «reenviar por correo», el",
                "patrón condicional es válido (contrato Jelkin: «reenviar» NUNCA la devuelve).",
                "Ver SPEC-423/spec.md y SPEC-435/spec.md.",
            ].join("\n"),
        ).toEqual([]);
    });
});

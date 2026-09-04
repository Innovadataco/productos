/**
 * SPEC-427 · candados de los dos códigos del cierre — sin BD.
 *
 * Lo que se custodia acá no es "que funcione" (eso lo prueba el test de
 * integración con base): es que **no se rompa la promesa del brief** por un
 * cambio distraído. Vigencia de 30 minutos, 10 minutos de anticipación, y sobre
 * todo: el código no se guarda ni se registra en claro en ninguna parte.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
    generarCodigo,
    calcularExpiraEn,
    VIGENCIA_CODIGO_MS,
    ANTICIPACION_RECORDATORIO_MS,
    MAX_INTENTOS_CODIGO,
} from "./codigos";

const RAIZ = path.resolve(__dirname, "../../../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");
/** El código sin comentarios: un candado no puede dispararse por una frase. */
const leerCodigo = (r: string) =>
    leer(r)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

const CODIGOS = "src/lib/profesional/cita/codigos.ts";
const CIERRE = "src/lib/profesional/cita/cierre.service.ts";

describe("SPEC-427 · el código que se dicta en voz alta", () => {
    it("son seis dígitos, siempre", () => {
        for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
    });

    it("no es predecible: 200 tiradas no repiten casi nada", () => {
        const vistos = new Set(Array.from({ length: 200 }, () => generarCodigo()));
        // Con 900.000 posibles, 200 tiradas casi nunca chocan. Si esto baja de
        // 190 el generador dejó de ser aleatorio (p. ej. alguien puso Math.random
        // sembrado, o un contador).
        expect(vistos.size).toBeGreaterThan(190);
    });

    it("usa el CSPRNG, no Math.random", () => {
        const src = leerCodigo(CODIGOS);
        expect(src).toContain("randomInt");
        expect(src, "Math.random no sirve para un token de seguridad").not.toContain("Math.random");
    });
});

describe("SPEC-427 · los números que dictó el brief", () => {
    it("la vigencia es de 30 minutos", () => {
        expect(VIGENCIA_CODIGO_MS).toBe(30 * 60 * 1000);
    });

    it("el recordatorio sale 10 minutos antes", () => {
        expect(ANTICIPACION_RECORDATORIO_MS).toBe(10 * 60 * 1000);
    });

    it("el barrido corre bastante más seguido que la anticipación", () => {
        // Si el cron fuera cada 10 minutos o más, una cita podría empezar sin
        // que su código se haya emitido: el recordatorio llegaría tarde.
        const worker = leer("scripts/worker-citas.mjs");
        const cron = /const CRON_CADA_5_MIN = "\*\/(\d+) \* \* \* \*"/.exec(worker);
        expect(cron, "cambió la forma del cron: revisá que siga siendo por minutos").not.toBeNull();
        const minutos = Number(cron?.[1]);
        expect(minutos * 60 * 1000).toBeLessThan(ANTICIPACION_RECORDATORIO_MS);
    });

    it("el tope de intentos es el mismo del registro", () => {
        expect(MAX_INTENTOS_CODIGO).toBe(5);
    });

    it("SPEC-427 (B1) · la vigencia se ancla al fin de la franja, no a la emisión", () => {
        // Una consulta dura 45–60 min y el profesional cierra al terminar. El
        // código tiene que seguir vivo entonces, no morir a los 30 min de emitido.
        const inicio = new Date("2026-09-10T15:00:00Z");
        const fin = new Date("2026-09-10T15:50:00Z"); // franja de 50 min
        const vigenteDesde = new Date(inicio.getTime() - ANTICIPACION_RECORDATORIO_MS);
        const expira = calcularExpiraEn(vigenteDesde, fin);
        // Cerrar 10 min DESPUÉS de terminar la sesión sigue dentro de la vigencia.
        expect(expira.getTime()).toBeGreaterThan(fin.getTime() + 10 * 60 * 1000);
        // Sin franja, cae al mínimo de 30 min (llamadores sin sesión, p.ej. tests).
        const sinFranja = calcularExpiraEn(vigenteDesde);
        expect(sinFranja.getTime()).toBe(vigenteDesde.getTime() + 30 * 60 * 1000);
    });
});

describe("SPEC-427 · el código nunca queda escrito en claro", () => {
    it("se guarda hasheado con bcrypt, nunca el valor", () => {
        const src = leerCodigo(CODIGOS);
        expect(src).toContain("bcrypt.hash");
        expect(src).toContain("bcrypt.compare");
        // `codigoHash:` sí; `codigo:` como campo de la fila, jamás.
        expect(src).toMatch(/codigoHash:\s*await bcrypt\.hash/);
    });

    it("no se audita el valor del código, ni cuando falla", () => {
        const cierre = leerCodigo(CIERRE);
        // Se audita el MOTIVO del rechazo (de la variable que sea), nunca el valor.
        expect(cierre).toMatch(/metadatos:\s*\{\s*tipo:\s*"CITA",\s*motivo:\s*\w+\.motivo\s*\}/);
        expect(cierre).not.toMatch(/metadatos:\s*\{[^}]*\bcodigo\b\s*[,}]/);
        expect(cierre).not.toMatch(/valorNuevo:.*\bcodigo\b/);
    });

    it("CONTRAPRUEBA · el candado del audit detecta la forma prohibida", () => {
        const prohibido = "metadatos: { codigo, motivo: r.motivo },";
        expect(/metadatos:\s*\{[^}]*\bcodigo\b\s*[,}]/.test(prohibido)).toBe(true);
    });

    it("el módulo no escribe el código en consola", () => {
        for (const f of [CODIGOS, CIERRE]) {
            expect(leerCodigo(f), `${f} no puede loguear el código`).not.toMatch(
                /console\.(log|info|warn|error)\([^)]*\bcodigo\b/,
            );
        }
    });
});

describe("SPEC-427 · un solo uso, de verdad", () => {
    it("el consumo va condicionado a que siga sin usar", () => {
        // Si fuera un `update` a secas, dos peticiones simultáneas cerrarían dos
        // veces la misma cita. El WHERE es lo que lo impide.
        const repo = leerCodigo("src/lib/dal/repositories/codigo-cita.ts");
        expect(repo).toContain("updateMany");
        expect(repo).toMatch(/where:\s*\{\s*id,\s*usadoEn:\s*null\s*\}/);
    });

    it("el cierre exige que la cita esté CONFIRMADA en el propio WHERE", () => {
        const repo = leerCodigo("src/lib/dal/repositories/solicitud-cita.ts");
        expect(repo).toMatch(/where:\s*\{\s*id,\s*estado:\s*"CONFIRMADA"\s*\}/);
    });

    it("un código vencido NO gasta intentos: primero vence, después cuenta", () => {
        const src = leerCodigo(CODIGOS);
        const iVence = src.indexOf('motivo: "expirado"');
        const iIntentos = src.indexOf('motivo: "max_intentos"');
        const iCompara = src.indexOf("bcrypt.compare");
        expect(iVence).toBeGreaterThan(-1);
        expect(iVence).toBeLessThan(iIntentos);
        expect(iIntentos).toBeLessThan(iCompara);
    });
});

describe("SPEC-427 · el código y su aviso nacen juntos", () => {
    it("la emisión falla en cerrado si no hay regla activa (I-295)", () => {
        const cierre = leerCodigo(CIERRE);
        // Se acota a la función que emite el recordatorio: el archivo tiene
        // VARIAS transacciones ahora (cierre, inasistencia, autocierre), así
        // que un índice global apuntaría a la primera que aparezca.
        const i = cierre.indexOf("async function emitirYProgramarRecordatorio");
        // Acotar a la PRÓXIMA función, sea `async function` o `export async
        // function`: la que sigue a emitir es exportada, así que buscar solo
        // `\nasync function ` devolvía -1 y el cuerpo llegaba hasta el fin del
        // archivo, donde otro `aviso.programadas === 0` podía satisfacer el orden.
        const resto = cierre.slice(i + 1);
        const rel = resto.search(/\n(?:export )?async function /);
        const cuerpo = rel === -1 ? cierre.slice(i) : cierre.slice(i, i + 1 + rel);
        expect(cuerpo).toContain("withUnitOfWork");
        expect(cuerpo).toContain("aviso.programadas === 0");
        // Dentro de la transacción: si el aviso no se encola, el código no queda.
        const iTx = cuerpo.indexOf("withUnitOfWork");
        const iEmite = cuerpo.indexOf("await emitirCodigo(");
        const iChequeo = cuerpo.indexOf("aviso.programadas === 0");
        expect(iTx).toBeLessThan(iEmite);
        expect(iEmite).toBeLessThan(iChequeo);
    });

    it("el barrido es idempotente por consulta, no por bandera", () => {
        const repo = leerCodigo("src/lib/dal/repositories/solicitud-cita.ts");
        // Sin este `none`, cada corrida emitiría un código nuevo y el padre
        // recibiría un correo cada 5 minutos.
        expect(repo).toMatch(/codigos:\s*\{\s*none:\s*\{\s*tipo:\s*"CITA"\s*\}\s*\}/);
    });
});

describe("SPEC-427 fix a · consumir el código y CUMPLIDA, en una sola transacción", () => {
    /**
     * El bug original: se consumía el código y se escribía CUMPLIDA en dos
     * statements sueltos; si el segundo fallaba, el código quedaba quemado y la
     * cita sin cerrar, sin forma de reintentar. Un test de conducta no lo
     * reproduce fácil —el precheck de estado tapa la carrera—, así que se
     * custodia la ESTRUCTURA: los dos writes tienen que vivir dentro del mismo
     * `withUnitOfWork`.
     */
    const cierre = leerCodigo(CIERRE);

    /** El cuerpo de la función de cierre, acotado al próximo `export async function`. */
    function cuerpoDeCerrar(src: string): string {
        const i = src.indexOf("export async function cerrarConCodigoDeCita");
        const j = src.indexOf("\nexport async function ", i + 1);
        return src.slice(i, j === -1 ? undefined : j);
    }

    /**
     * ¿El consumo y el CUMPLIDA están en el mismo `withUnitOfWork` Y ambos
     * repositorios reciben el `tx`? Mirar solo los nombres no basta: quitarle el
     * `tx` a `new CodigoCitaRepository()` deja el candado en verde y devuelve el
     * bug —el repo cae al singleton y la escritura sobrevive al rollback—. El
     * cableado del `tx` es lo que hace atómica la operación, así que es lo que se
     * exige.
     */
    function ambosEnLaMismaTx(cuerpo: string): boolean {
        const tx = /withUnitOfWork\(async \(tx\) => \{([\s\S]*?)\n    \}\);/.exec(cuerpo);
        if (!tx) return false;
        const dentro = tx[1];
        return (
            /new CodigoCitaRepository\(tx\)\s*\.\s*marcarUsadoSiLibre/.test(dentro) &&
            /new SolicitudCitaRepository\(tx\)\s*\.\s*marcarCumplidaSiConfirmada/.test(dentro)
        );
    }

    it("los dos writes viven en el mismo withUnitOfWork Y reciben el tx", () => {
        expect(ambosEnLaMismaTx(cuerpoDeCerrar(cierre))).toBe(true);
    });

    it("CONTRAPRUEBA · la forma vieja (dos statements sueltos) se detecta como el bug", () => {
        const viejo = `export async function cerrarConCodigoDeCita() {
            const consumido = await new CodigoCitaRepository().marcarUsadoSiLibre(id, ahora);
            const cerrada = await new SolicitudCitaRepository().marcarCumplidaSiConfirmada(id);
        }
        export async function otra() {}`;
        expect(ambosEnLaMismaTx(cuerpoDeCerrar(viejo))).toBe(false);
    });

    it("CONTRAPRUEBA · quitarle el tx a un repo dentro de la tx también se detecta", () => {
        // La mutación exacta del radicado: el withUnitOfWork sigue, pero el repo
        // del consumo pierde el `tx` y su escritura ya no revierte con el rollback.
        const conBug = `export async function cerrarConCodigoDeCita() {
            await withUnitOfWork(async (tx) => {
                const consumido = await new CodigoCitaRepository().marcarUsadoSiLibre(v.codigoId, ahora);
                const fila = await new SolicitudCitaRepository(tx).marcarCumplidaSiConfirmada(solicitudId);
                return fila;
            });
        }
        export async function otra() {}`;
        expect(ambosEnLaMismaTx(cuerpoDeCerrar(conBug))).toBe(false);
    });
});

describe("SPEC-427 (B6) · ningún tipo de código queda sin quien lo emita", () => {
    // Lección I-277 con pantalla encima: un valor de `TipoCodigoCita` sin
    // emisor deja la cola 2 del Verificador afirmando «Nunca se pidió» sobre algo
    // que no puede pedirse — un hecho falso ante quien adjudica el incidente.
    function valoresDeTipoCodigo(): string[] {
        const schema = fs.readFileSync(path.join(RAIZ, "prisma/schema.prisma"), "utf-8");
        const m = /enum TipoCodigoCita \{([\s\S]*?)\}/.exec(schema);
        if (!m) return [];
        return m[1]
            .split("\n")
            .map((l) => l.replace(/\/\/.*$/, "").trim())
            .filter((l) => /^[A-Z_]+$/.test(l));
    }

    /** El código de todo src/ productivo (sin tests), sin comentarios. */
    function fuenteProductiva(): string {
        const out: string[] = [];
        const rec = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const r = path.join(dir, e.name);
                if (e.isDirectory()) rec(r);
                else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
                    out.push(leerCodigo(path.relative(RAIZ, r)));
                }
            }
        };
        rec(path.join(RAIZ, "src"));
        return out.join("\n");
    }

    it("cada valor de TipoCodigoCita aparece emitido en algún `emitirCodigo`", () => {
        const src = fuenteProductiva();
        const huerfanos = valoresDeTipoCodigo().filter(
            (v) => !new RegExp(`emitirCodigo\\([^)]*tipo:\\s*"${v}"`, "s").test(src),
        );
        expect(huerfanos, "un tipo de código sin emisor es I-277 con UI encima").toEqual([]);
    });

    it("CONTRAPRUEBA · el candado detecta un tipo sin emisor", () => {
        const src = 'emitirCodigo({ solicitudId, tipo: "CITA", vigenteDesde });';
        expect(new RegExp('emitirCodigo\\([^)]*tipo:\\s*"EXPEDIENTE"', "s").test(src)).toBe(false);
    });
});

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
    VIGENCIA_CODIGO_MS,
    ANTICIPACION_RECORDATORIO_MS,
    MAX_INTENTOS_CODIGO,
    MAX_REEMISIONES,
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

    it("el tope de intentos es el mismo del registro, y el de reemisiones es generoso", () => {
        expect(MAX_INTENTOS_CODIGO).toBe(5);
        // El brief dice «las veces que haga falta»: el tope frena una máquina de
        // correos, no a un padre que pide dos o tres.
        expect(MAX_REEMISIONES).toBeGreaterThanOrEqual(10);
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
        const j = cierre.indexOf("\nasync function ", i + 1);
        const cuerpo = cierre.slice(i, j === -1 ? undefined : j);
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

    /** El cuerpo de la función de cierre, desde su nombre hasta el próximo `\nexport`. */
    function cuerpoDeCerrar(src: string): string {
        const i = src.indexOf("export async function cerrarConCodigoDeCita");
        const j = src.indexOf("\nexport ", i + 1);
        return src.slice(i, j === -1 ? undefined : j);
    }

    /** ¿El consumo y el CUMPLIDA están dentro de un `withUnitOfWork`? */
    function ambosEnLaMismaTx(cuerpo: string): boolean {
        const tx = /withUnitOfWork\(async \(tx\) => \{([\s\S]*?)\n    \}\);/.exec(cuerpo);
        if (!tx) return false;
        const dentro = tx[1];
        return dentro.includes("marcarUsadoSiLibre") && dentro.includes("marcarCumplidaSiConfirmada");
    }

    it("los dos writes viven en el mismo withUnitOfWork", () => {
        expect(ambosEnLaMismaTx(cuerpoDeCerrar(cierre))).toBe(true);
    });

    it("CONTRAPRUEBA · la forma vieja (dos statements sueltos) se detecta como el bug", () => {
        const viejo = `export async function cerrarConCodigoDeCita() {
            const consumido = await repo.marcarUsadoSiLibre(id, ahora);
            const cerrada = await repo.marcarCumplidaSiConfirmada(id);
        }`;
        expect(ambosEnLaMismaTx(cuerpoDeCerrar(viejo))).toBe(false);
    });
});

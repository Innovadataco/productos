/**
 * SPEC-657 (I-389) · candado de CABLEADO del barrido de citas.
 *
 * El defecto que cierra esta spec **no era código faltante: era código que
 * nadie llamaba**. `barrerAvisoVencimiento48h` y `barrerPlazoPagoDelPadre`
 * (`worker.ts`, SPEC-395) estaban escritos, probados y con candado de repetición
 * (I-280), pero **sin un solo llamador** — su único importador en todo el repo
 * era su propio test. Consecuencia en producción: un padre que ya pagó y cuyo
 * profesional no responde en 48 h no se entera y la franja no se libera; y una
 * solicitud impaga bloquea la agenda del profesional para siempre.
 *
 * Por eso este candado es de **CABLEADO**: no comprueba que la lógica exista
 * —eso ya estaba y tiene sus tests— sino que **alguien la invoque de verdad**, y
 * que el worker esté registrado en TODOS los sitios (si falta uno, o queda muerto
 * o rompe una compuerta). Cuenta llamadores en `scripts/**` además de `src/`
 * (lección del falso positivo de SPEC-439). fs puro → unit, sin base.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../../..");
const WORKER = "scripts/worker-citas.mjs";
const MODULO = "src/lib/profesional/cita/worker.ts";

const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf-8");
const leerCodigo = (rel: string) =>
    leer(rel)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

describe("SPEC-657 · el barrido de citas tiene quien lo llame", () => {
    it("existe el worker y llama a la corrida — no basta con que la lógica exista", () => {
        expect(fs.existsSync(path.join(RAIZ, WORKER)), `falta ${WORKER}`).toBe(true);
        const worker = leerCodigo(WORKER);
        expect(
            /ejecutarBarridoCitas\s*\(/.test(worker),
            "Los barredores llevaban desde SPEC-395 escritos, probados y SIN llamador. " +
                "Si esta llamada desaparece, volvemos al estado en que NADA barre las citas.",
        ).toBe(true);
    });

    it("la corrida invoca de verdad a LOS DOS barredores", () => {
        const modulo = leerCodigo(MODULO);
        // ejecutarBarridoCitas() tiene que llamar a ambos, no a uno solo: dejar el
        // del pago sin el del aviso deja atascado justo al padre que YA pagó.
        expect(/barrerAvisoVencimiento48h\s*\(/.test(modulo), "falta el barrido de aviso 48h").toBe(true);
        expect(/barrerPlazoPagoDelPadre\s*\(/.test(modulo), "falta el barrido de plazo de pago").toBe(true);
    });

    it("la cola se CREA antes de agendarla y de consumirla (I-131)", () => {
        const worker = leerCodigo(WORKER);
        const crear = worker.indexOf("createQueue");
        const agendar = worker.indexOf("boss.schedule");
        const consumir = worker.indexOf("boss.work");
        expect(crear, "falta createQueue").toBeGreaterThan(-1);
        expect(
            crear,
            "Sin crear la cola primero, pg-boss tira «Queue not found» y el worker entra " +
                "en bucle de reinicio.",
        ).toBeLessThan(agendar);
        expect(crear).toBeLessThan(consumir);
    });

    it("está registrado en TODOS los sitios, o queda muerto o rompe una compuerta", () => {
        const locks = leer("scripts/ADVISORY-LOCKS.md");
        expect(locks, "sin fila en ADVISORY-LOCKS.md, `locks:check` se cae").toContain("worker-citas.mjs");
        expect(locks, "el ID declarado tiene que estar en la tabla").toContain("123456801");

        for (const compose of ["docker-compose.prod.yml", "docker-compose.yml"]) {
            expect(leer(compose), `falta el servicio en ${compose}`).toContain("worker-citas.mjs");
        }

        expect(
            leerCodigo("src/lib/servicios/docker-adapter.ts"),
            "sin la allowlist del adapter, el admin no puede operar el servicio",
        ).toContain("pi-citas");

        expect(
            leerCodigo("src/lib/monitoreo/probes.ts"),
            "un worker legal que se muere en silencio es el mismo defecto con otro disfraz",
        ).toContain("pi-citas");
    });

    it("la cadencia está SEMBRADA, no quemada", () => {
        const seed = leer("prisma/seed.ts");
        expect(seed, "el parámetro de cadencia tiene que sembrarse, no quemarse").toContain("cita.barrido.cron");
        expect(
            /seedParametrosBarridoCitas\s*\(\s*\)/.test(seed),
            "sembrar la función y NO llamarla desde main() deja el parámetro sin nacer",
        ).toBe(true);
    });
});

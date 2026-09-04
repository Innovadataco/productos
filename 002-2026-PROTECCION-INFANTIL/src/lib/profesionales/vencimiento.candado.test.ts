/**
 * SPEC-449 (I-313) · candados del reloj de vencimiento.
 *
 * El defecto que cierra esta spec **no era código faltante: era código que
 * nadie llamaba**. `decidirAcciones` (`cron-vencimiento.ts:56`) y
 * `puedeAparecerEnDirectorio` (`vigencia.ts:127`) estaban escritos, probados y
 * **sin un solo llamador** desde SPEC-389. Consecuencia: **nada en todo el
 * árbol escribía `estado = "VENCIDO"`**, así que un profesional cuyos
 * antecedentes caducaron seguía en el directorio del padre **para siempre**,
 * contra la Ley 2375/2024.
 *
 * Por eso el candado central de este archivo es de **CABLEADO**: no comprueba
 * que la lógica exista —eso ya estaba— sino que **alguien la llame de verdad**.
 * Y cuenta llamadores en `scripts/**` además de `src/`, que es la lección que
 * dejó el falso positivo de SPEC-439.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { horaCorridaACronVerificacion, CRON_POR_DEFECTO } from "./hora-corrida";

const RAIZ = path.resolve(__dirname, "../../..");
const WORKER = "scripts/worker-verificacion-vencimiento.mjs";

const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf-8");
const leerCodigo = (rel: string) =>
    leer(rel)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

describe("SPEC-449 · el reloj tiene quien lo llame", () => {
    it("existe el worker y llama a la corrida — no basta con que la lógica exista", () => {
        expect(fs.existsSync(path.join(RAIZ, WORKER)), `falta ${WORKER}`).toBe(true);
        const worker = leerCodigo(WORKER);

        expect(
            /ejecutarCorridaVencimiento\s*\(/.test(worker),
            "`decidirAcciones` llevaba desde SPEC-389 escrita, probada y sin llamador. " +
                "Si esta llamada desaparece, volvemos al estado en que NADA escribe VENCIDO.",
        ).toBe(true);
    });

    it("y la corrida llama de verdad a `decidirAcciones` y ESCRIBE el estado", () => {
        const servicio = leerCodigo("src/lib/profesionales/corrida-vencimiento.service.ts");

        expect(/decidirAcciones\s*\(/.test(servicio)).toBe(true);
        expect(
            /marcarVencidoSiActivo\s*\(/.test(servicio),
            "Decidir sin escribir deja el defecto igual: la spec existe para que " +
                "alguien ponga VENCIDO en la base.",
        ).toBe(true);
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
                "en bucle de reinicio — y el monitor lo ve VERDE porque el healthcheck es " +
                "`kill -0 1` (PID vivo ≠ avanzando).",
        ).toBeLessThan(agendar);
        expect(crear).toBeLessThan(consumir);
    });

    it("está registrado en los CINCO sitios, o queda muerto o rompe una compuerta", () => {
        const locks = leer("scripts/ADVISORY-LOCKS.md");
        expect(locks, "sin fila en ADVISORY-LOCKS.md, `locks:check` se cae").toContain(
            "worker-verificacion-vencimiento.mjs",
        );
        expect(locks).toContain("123456800");

        for (const compose of ["docker-compose.prod.yml", "docker-compose.yml"]) {
            expect(leer(compose), `falta el servicio en ${compose}`).toContain(
                "worker-verificacion-vencimiento.mjs",
            );
        }

        expect(
            leerCodigo("src/lib/servicios/docker-adapter.ts"),
            "sin la allowlist del adapter, el admin no puede operar el servicio",
        ).toContain("pi-verificacion-vencimiento");

        expect(
            leerCodigo("src/lib/monitoreo/probes.ts"),
            "un worker legal que se muere en silencio es el mismo defecto con otro disfraz",
        ).toContain("verificacion_vencimiento");
    });

    it("el aviso y la hora están SEMBRADOS, no quemados", () => {
        const seed = leer("prisma/seed.ts");
        expect(seed).toContain("profesional.verificacion.hora_corrida");
        expect(seed).toContain("profesional_verificacion_por_vencer");
        expect(
            seed,
            "El evento tiene que tener regla, o la plantilla queda sin quien la dispare.",
        ).toContain("profesional.verificacion.por_vencer");
    });
});

describe("SPEC-449 · la hora de la corrida no rompe el worker", () => {
    it("una hora válida se convierte en cron", () => {
        expect(horaCorridaACronVerificacion("02:00")).toBe("0 2 * * *");
        expect(horaCorridaACronVerificacion("23:45")).toBe("45 23 * * *");
        expect(horaCorridaACronVerificacion("00:00")).toBe("0 0 * * *");
    });

    it.each([null, undefined, "", "   ", "25:00", "02:99", "2 am", "0200", "02-00"])(
        "«%s» cae al default sin lanzar",
        (valor) => {
            expect(horaCorridaACronVerificacion(valor as string)).toBe(CRON_POR_DEFECTO);
        },
    );

    it("NO comparte el parámetro con el reloj de pagos", () => {
        const servicio = leer("src/lib/profesionales/hora-corrida.ts");
        expect(
            servicio.includes("pagos.vigencia.hora_corrida"),
            "Atar dos relojes de dominios distintos al mismo parámetro hace que mover " +
                "uno mueva el otro sin que nadie se entere.",
        ).toBe(false);
    });
});

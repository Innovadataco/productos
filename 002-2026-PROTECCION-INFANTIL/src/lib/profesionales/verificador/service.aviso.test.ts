/**
 * SPEC-418 (I-295) · candado estático: el Verificador NO vuelve a enviar el
 * aviso por su cuenta.
 *
 * El defecto: `service.ts` llamaba `enviarEmailNotificacion` —el envío DIRECTO
 * por Resend, el mismo que usa el worker— fuera de transacción y con el error
 * tragado en un `catch`. Con el proveedor caído, el profesional nunca se
 * enteraba de que le devolvieron la solicitud y **no quedaba ninguna fila** que
 * permitiera saberlo después. El ciclo de admisión se detenía en silencio.
 *
 * El comportamiento lo prueba `decidir/route.test.ts` contra la base. Este
 * archivo cuida la FORMA, que es lo que se rompe por descuido: alguien agrega
 * "un correito rápido" y vuelve a saltarse el motor.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");

/** Fuente sin comentarios: el archivo EXPLICA el defecto y eso no puede fallar el gate. */
const leerCodigo = (r: string) =>
    leer(r)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

const SERVICE = "src/lib/profesionales/verificador/service.ts";
const MOTOR = "src/lib/notificaciones/motor.ts";

describe("SPEC-418 · el Verificador no envía correos por su cuenta", () => {
    it("no llama al envío directo del proveedor", () => {
        const codigo = leerCodigo(SERVICE);
        expect(codigo).not.toContain("enviarEmailNotificacion");
        expect(codigo).not.toContain("resend");
    });

    it("usa el motor de notificaciones", () => {
        expect(leerCodigo(SERVICE)).toContain('from "@/lib/notificaciones"');
        expect(leerCodigo(SERVICE)).toContain("await programar(");
    });

    it("el candado detecta la forma vieja (contraprueba)", () => {
        const detecta = (l: string) =>
            !/^\s*(\/\/|\*)/.test(l) && l.replace(/\/\/.*$/, "").includes("enviarEmailNotificacion");
        expect(detecta("        await enviarEmailNotificacion(email, asunto, cuerpo);")).toBe(true);
        expect(detecta(" * usaba `enviarEmailNotificacion` — envío directo")).toBe(false);
        expect(detecta("        await programar({ evento }, { tx });")).toBe(false);
    });
});

describe("SPEC-418 · el aviso viaja DENTRO de la transacción de la decisión", () => {
    it("programa con la transacción del llamador", () => {
        const codigo = leerCodigo(SERVICE);
        expect(codigo).toContain("{ tx },");
        // Y el `programar` está adentro del bloque de la transacción, no después.
        const inicioTx = codigo.indexOf("await repo.transaccion(async (tx) => {");
        const finTx = codigo.indexOf("await despacharEnvios(");
        expect(inicioTx, "no se encontró la transacción").toBeGreaterThan(-1);
        expect(codigo.indexOf("await programar(")).toBeGreaterThan(inicioTx);
        expect(codigo.indexOf("await programar(")).toBeLessThan(finTx);
    });

    it("falla en CERRADO: sin regla activa la decisión no se guarda", () => {
        const codigo = leerCodigo(SERVICE);
        expect(codigo).toContain("aviso.programadas === 0");
        expect(codigo).toContain("throw new AppError(");
    });

    it("el despacho a pg-boss ocurre DESPUÉS del commit, nunca adentro", () => {
        const codigo = leerCodigo(SERVICE);
        // pg-boss usa otra conexión: adentro dejaría un job huérfano si revierte.
        expect(codigo).toContain("await despacharEnvios(envios);");
        expect(codigo.indexOf("await despacharEnvios(")).toBeGreaterThan(
            codigo.indexOf("await repo.transaccion("),
        );
    });
});

describe("SPEC-418 · el motor sabe programar dentro de una transacción", () => {
    it("acepta `tx` y arma sus repositorios con ella", () => {
        const codigo = leerCodigo(MOTOR);
        expect(codigo).toContain("ProgramarOpciones");
        expect(codigo).toContain("function reposDe(");
        expect(codigo).toContain("new NotificacionRepository(tx)");
    });

    it("con `tx` NO despacha en línea: acumula para después del commit", () => {
        const codigo = leerCodigo(MOTOR);
        expect(codigo).toContain("if (tx) {");
        expect(codigo).toContain("envios.push({ notificacionId: notificacion.id, enviarEn });");
        expect(codigo).toContain("export async function despacharEnvios(");
    });

    it("sin `tx` la conducta es la de siempre — los llamadores viejos no cambian", () => {
        const codigo = leerCodigo(MOTOR);
        // El camino sin transacción sigue despachando en el momento.
        expect(codigo).toContain("await despacharEnvios([{ notificacionId: notificacion.id, enviarEn }]);");
    });
});

describe("SPEC-418 · el seed faltante se descubre AL DESPLEGAR, no al hacer clic", () => {
    const guardian = leerCodigo("scripts/verify-reglas-notificacion.ts");

    it("el guardián declara los dos eventos que fallan en cerrado", () => {
        expect(guardian).toContain("profesional.verificacion.aprobada");
        expect(guardian).toContain("profesional.verificacion.devuelta");
    });

    it("no basta con la regla: la plantilla también tiene que estar activa", () => {
        // Con la plantilla ausente el motor loguea, sigue de largo y devuelve
        // `programadas: 0` — indistinguible de no tener regla. El guardián lo mira.
        expect(guardian).toContain("notificacionPlantilla.findMany");
        expect(guardian).toContain("activa: true");
        expect(guardian).toContain("plantilla ausente o inactiva");
    });

    it("solo observa: nunca crea ni repara una regla", () => {
        expect(guardian).not.toMatch(/notificacionRegla\.(create|upsert|update)/);
        expect(guardian).not.toMatch(/notificacionPlantilla\.(create|upsert|update)/);
    });

    it("corre en el deploy DESPUÉS del seed — antes no tendría nada que verificar", () => {
        const deploy = leer("scripts/deploy-prod.sh");
        expect(deploy).toContain("npm run reglas:check");
        expect(deploy.indexOf("npm run reglas:check")).toBeGreaterThan(
            deploy.indexOf("node --import tsx prisma/seed.ts"),
        );
    });

    it("está cableado como script de npm", () => {
        expect(leer("package.json")).toContain('"reglas:check"');
    });
});

describe("SPEC-418 · el catálogo del motor está sembrado", () => {
    const seed = leerCodigo("prisma/seed.ts");

    it.each([
        "profesional.verificacion.aprobada",
        "profesional.verificacion.devuelta",
    ])("el evento %s tiene plantilla y regla en el seed", (evento) => {
        expect(seed).toContain(evento);
    });

    it("las reglas son OBLIGATORIAS: una preferencia no puede dejar al profesional sin aviso", () => {
        const bloque = seed.slice(seed.indexOf("async function seedVerificacionProfesional"));
        const fin = bloque.indexOf("\n}");
        expect(bloque.slice(0, fin)).toContain("obligatoria: true");
        expect(bloque.slice(0, fin)).toContain('rol: "PROFESIONAL"');
    });

    it("el seed se ejecuta desde main()", () => {
        expect(seed).toContain("await seedVerificacionProfesional();");
    });
});

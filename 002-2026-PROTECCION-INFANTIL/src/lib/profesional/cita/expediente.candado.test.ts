/**
 * SPEC-427b · candados del código de expediente — sin BD.
 *
 * Custodian las dos reglas que, si se rompen, no dan error visible: que CADA
 * lectura del expediente quede auditada (reserva legal H-2) y que abrir el
 * expediente pase siempre por el código digitado (nunca por un atajo).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../../..");
const leer = (r: string) => fs.readFileSync(path.join(RAIZ, r), "utf-8");
const leerCodigo = (r: string) =>
    leer(r)
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");

const SERVICIO = "src/lib/profesional/cita/expediente.service.ts";

/** El cuerpo de una función exportada, de su nombre al próximo `export`/EOF. */
function cuerpoDe(src: string, nombre: string): string {
    const i = src.indexOf(`export async function ${nombre}`);
    const j = src.indexOf("\nexport ", i + 1);
    return src.slice(i, j === -1 ? undefined : j);
}

describe("SPEC-427b · H-2 · cada lectura del expediente se audita", () => {
    const svc = leerCodigo(SERVICIO);

    it("la lectura audita EXPEDIENTE_ABIERTO ANTES de devolver el contenido", () => {
        const cuerpo = cuerpoDe(svc, "lecturaExpedienteParaProfesional");
        const iAudit = cuerpo.indexOf('accion: "CITA_PROFESIONAL_EXPEDIENTE_ABIERTO"');
        const iReturn = cuerpo.indexOf("return lecturaDelExpediente");
        expect(iAudit, "sin auditoría de lectura no hay H-2").toBeGreaterThan(-1);
        expect(iReturn).toBeGreaterThan(-1);
        expect(iAudit, "auditar DESPUÉS de devolver deja lecturas sin rastro").toBeLessThan(iReturn);
    });

    it("CONTRAPRUEBA · una lectura que devuelve sin auditar se detecta", () => {
        const malo = `export async function lecturaExpedienteParaProfesional() {
            return lecturaDelExpediente(id, padre);
        }`;
        const cuerpo = cuerpoDe(malo, "lecturaExpedienteParaProfesional");
        const iAudit = cuerpo.indexOf('accion: "CITA_PROFESIONAL_EXPEDIENTE_ABIERTO"');
        expect(iAudit).toBe(-1);
    });
});

describe("SPEC-427b · el expediente se abre SOLO con el código", () => {
    const svc = leerCodigo(SERVICIO);

    it("la lectura exige acceso antes de leer (403 si no digitó)", () => {
        const cuerpo = cuerpoDe(svc, "lecturaExpedienteParaProfesional");
        expect(cuerpo).toContain("tieneAccesoAlExpediente");
        expect(cuerpo).toContain("FORBIDDEN");
    });

    it("abrir consume el código y audita en la MISMA transacción (lección fix a)", () => {
        const cuerpo = cuerpoDe(svc, "abrirExpedienteConCodigo");
        const tx = /withUnitOfWork\(async \(tx\) => \{([\s\S]*?)\n    \}\);/.exec(cuerpo);
        expect(tx, "el consumo tiene que estar en una transacción").not.toBeNull();
        const dentro = tx![1];
        expect(dentro).toContain("marcarUsadoSiLibre");
        expect(dentro).toContain('accion: "CITA_PROFESIONAL_CODIGO_DIGITADO"');
    });

    it("el acceso vive en la fila usada del código, no en un booleano aparte", () => {
        const cuerpo = cuerpoDe(svc, "tieneAccesoAlExpediente");
        expect(cuerpo).toContain('c.tipo === "EXPEDIENTE"');
        expect(cuerpo).toContain("c.usadoEn !== null");
    });
});

describe("SPEC-427b · el código no se escribe en claro", () => {
    it("no se audita ni se loguea el valor del código", () => {
        const svc = leerCodigo(SERVICIO);
        expect(svc).not.toMatch(/metadatos:\s*\{[^}]*\bcodigo\b\s*[,}]/);
        expect(svc).not.toMatch(/console\.(log|info|warn|error)\([^)]*\bcodigo\b/);
    });
});

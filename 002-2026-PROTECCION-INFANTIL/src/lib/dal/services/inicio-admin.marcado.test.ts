/**
 * SPEC-414 · candados estáticos del Inicio del administrador (sin BD).
 *
 * Defienden las dos mitades de **I-294**:
 *
 *  1. **El nombre de la tabla.** El modelo Prisma es `DemoMarcado`, pero lleva
 *     `@@map("demo_marcado")`. La consulta cruda decía `"DemoMarcado"` — una
 *     tabla que no existe — y reventaba en cada lectura desde SPEC-378.
 *  2. **El silencio.** `Promise.allSettled` descartaba los rechazos sin
 *     registrar nada, así que el defecto anterior era invisible: la pantalla se
 *     veía tranquila justo cuando no había podido mirar.
 *
 * Son estáticos a propósito: cuestan milisegundos, no necesitan base, y cazan
 * la regresión en el gate rápido en vez de en producción tres días después.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../../..");
const SERVICIO = path.join(RAIZ, "src/lib/dal/services/inicio-admin.ts");
const SCHEMA = path.join(RAIZ, "prisma/schema.prisma");

const fuente = fs.readFileSync(SERVICIO, "utf-8");

describe("SPEC-414 · I-294 (a) · el nombre de la tabla del marcador", () => {
    it("el schema mapea DemoMarcado a demo_marcado — este test se apoya en eso", () => {
        const schema = fs.readFileSync(SCHEMA, "utf-8");
        const modelo = schema.slice(schema.indexOf("model DemoMarcado {"));
        const bloque = modelo.slice(0, modelo.indexOf("\n}"));
        expect(bloque).toContain('@@map("demo_marcado")');
    });

    it("el servicio usa el nombre FÍSICO de la tabla, no el del modelo", () => {
        expect(fuente).toContain('Prisma.raw("demo_marcado")');
    });

    it('ninguna consulta cruda nombra "DemoMarcado" (la tabla que no existe)', () => {
        // Se ignoran los comentarios: el archivo EXPLICA el defecto, y explicarlo
        // no puede poner el test en rojo.
        const ofensores: string[] = [];
        fuente.split("\n").forEach((linea, i) => {
            const codigo = linea.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
            if (/"DemoMarcado"/.test(codigo)) ofensores.push(`inicio-admin.ts:${i + 1} → ${linea.trim()}`);
        });
        expect(ofensores, `vuelve I-294:\n${ofensores.join("\n")}`).toEqual([]);
    });

    it("el candado detecta la forma vieja (contraprueba)", () => {
        const detecta = (l: string) => /"DemoMarcado"/.test(l.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, ""));
        expect(detecta('        LEFT JOIN "DemoMarcado" dm')).toBe(true);
        expect(detecta("        LEFT JOIN demo_marcado dm")).toBe(false);
        expect(detecta(" * exactamente lo que pasó con \"DemoMarcado\"")).toBe(false);
    });
});

describe("SPEC-414 · I-294 (b) · una señal que truena NO desaparece", () => {
    it("los rechazos se registran en el logger", () => {
        expect(fuente).toContain('import { logger } from "@/lib/logger";');
        expect(fuente).toMatch(/res\.status === "rejected"/);
        expect(fuente).toMatch(/logger\.error\(/);
    });

    it("los rechazos se exponen en `degradadas`, no solo en el log", () => {
        // El log lo ve quien entra al servidor; el admin ve la pantalla.
        expect(fuente).toContain("degradadas.push(");
        expect(fuente).toContain("export interface SenalDegradada");
    });

    it("cada tarea lleva su nombre — sin él, un rechazo no se puede nombrar", () => {
        // `allSettled` sobre un array anónimo pierde la identidad de lo que falló.
        expect(fuente).toMatch(/etiqueta:\s*"/);
        expect(fuente).toMatch(/tareas\.map\(\(t\) => t\.ejecutar\(\)\)/);
    });

    it("no queda ningún `catch {}` vacío en el servicio", () => {
        expect(fuente).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
        expect(fuente).not.toMatch(/catch\s*\{\s*\}/);
    });
});

describe("SPEC-414 · el corte CARGA / SALUD queda declarado en el código", () => {
    it("las 4 señales de CARGA reciben el interruptor", () => {
        for (const senal of [
            "senalReportesHuerfanos",
            "senalRevisionManual",
            "senalVigenciasPorVencer",
            "senalComiteVencido",
        ]) {
            expect(fuente, `${senal} debe recibir incluirSembrados`).toMatch(
                new RegExp(`${senal}\\(incluirSembrados: boolean\\)`),
            );
        }
    });

    it("las señales de SALUD NO lo reciben — cuentan todo, sembrado incluido", () => {
        for (const senal of [
            "senalCorreosFallidos",
            "senalProveedorEmailCaido",
            "senalAnalisisRachaFallida",
            "senalJuradoReducido",
        ]) {
            expect(fuente, `${senal} no debe filtrar por datos de prueba`).toMatch(
                new RegExp(`${senal}\\(\\): Promise<SenalAlarma \\| null>`),
            );
        }
    });

    it("el default es SOLO LO REAL: hay que pedir explícitamente lo sembrado", () => {
        expect(fuente).toContain("opciones.incluirSembrados === true");
    });

    it("el total de sembrados cuenta filas distintas, no suma descuentos", () => {
        // Sumar `porSenal` inflaría el número: un reporte puede estar en dos colas.
        expect(fuente).toContain("contarSembradosDeCarga");
        expect(fuente).not.toContain("porSenal.reduce((suma, p) => suma + p.sembrados, 0)");
    });
});

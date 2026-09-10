/**
 * SPEC-609 (reparo 1 · «una cuenta, una puerta») · CANDADO ANTIRREGRESIÓN DE CLASE.
 *
 * Jelkin retiró el botón «Crear contraseña» (SPEC-598) del área del padre: una cuenta creada por
 * Google no necesita —ni entiende— que le ofrezcan crear una contraseña que nadie pidió. El candado
 * no vigila ese botón puntual sino la CLASE: cualquier control del área del padre que ofrezca
 * CREAR/ESTABLECER una contraseña (distinto de «cambiar» la que ya se tiene) o que enrute al flujo de
 * creación. Si alguien lo re-introduce «arreglándolo de vuelta», muere.
 *
 * Escanea sobre el código SIN comentarios (un puntero como este menciona «Crear contraseña» a
 * propósito; lo que importa es el control renderizado, no la prosa).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAICES = [
    path.resolve(__dirname), // src/app/dashboard/padre
    path.resolve(__dirname, "../../../components/modules/padre"),
];

function archivosFuente(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const salida: string[] = [];
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
            salida.push(...archivosFuente(p));
        } else if (/\.(tsx?|jsx?)$/.test(entrada.name) && !/\.(test|candado)\./.test(entrada.name)) {
            salida.push(p);
        }
    }
    return salida;
}

/** Quita comentarios de bloque y de línea para no cazar la prosa de los punteros. */
function sinComentarios(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// La clase prohibida: ofrecer la CREACIÓN de una contraseña, o enrutar a ese flujo.
const PATRONES: RegExp[] = [
    /Crear\s+contrase/i,
    /Establecer\s+contrase/i,
    /Crear\s+clave/i,
    /crear-password/i, // ruta/página o endpoint de creación
];

describe("SPEC-609 · el área del padre NO ofrece crear contraseña (antirregresión de clase)", () => {
    it("ningún control del área del padre ofrece crear/establecer contraseña", () => {
        const hallazgos: string[] = [];
        for (const raiz of RAICES) {
            for (const archivo of archivosFuente(raiz)) {
                const codigo = sinComentarios(fs.readFileSync(archivo, "utf8"));
                for (const patron of PATRONES) {
                    if (patron.test(codigo)) {
                        hallazgos.push(`${path.relative(process.cwd(), archivo)} :: ${patron}`);
                    }
                }
            }
        }
        expect(
            hallazgos,
            `control(es) de creación de contraseña en el área del padre (revierte SPEC-598, decisión de Jelkin; si de verdad hace falta, se ofrece con nombre claro y desde un lugar deliberado): ${hallazgos.join("; ")}`
        ).toEqual([]);
    });
});

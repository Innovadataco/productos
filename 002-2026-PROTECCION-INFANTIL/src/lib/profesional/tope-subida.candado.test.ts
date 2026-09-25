/**
 * SPEC-726 · CANDADO del tope de subida como PARÁMETRO.
 *
 * - `normalizarTopeMb` (pura): basura/vacío/null → default; fuera de rango → ACOTADO
 *   ([MIN,MAX]); válido → pasa. Nunca devuelve algo fuera de rango (ni 0 que tumbe
 *   la subida, ni infinito).
 * - Seed idempotente: crea `documentos.tamano_max_mb`=10 y `autorizacion.tamano_max_mb`=5
 *   (INTEGER, SYSTEM); re-sembrar NO pisa un valor editado por el admin (update:{}).
 *   Control positivo: editar a 20 y re-sembrar → sigue 20 (no vuelve a 10).
 * - Reader: sin fila → default; con basura en BD → default (la subida no se cae);
 *   con un valor gigante → acotado al máximo.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    normalizarTopeMb,
    sembrarTopesSubida,
    topeDocumentosMb,
    topeDocumentosBytes,
    topeAutorizacionMb,
    CLAVE_TOPE_DOCUMENTOS,
    CLAVE_TOPE_AUTORIZACION,
    DEFAULT_DOCUMENTOS_MB,
    DEFAULT_AUTORIZACION_MB,
    TOPE_SUBIDA_MB_MIN,
    TOPE_SUBIDA_MB_MAX,
} from "./tope-subida";

describe("SPEC-726 · normalizarTopeMb (validación pura, sin BD)", () => {
    it("un valor entero válido pasa tal cual", () => {
        expect(normalizarTopeMb("15", 10)).toBe(15);
        expect(normalizarTopeMb(String(TOPE_SUBIDA_MB_MAX), 10)).toBe(TOPE_SUBIDA_MB_MAX);
    });

    it("basura / vacío / no-entero / null → default", () => {
        for (const raw of ["banana", "", "   ", "1.5", "10mb", "0x10", null, undefined]) {
            expect(normalizarTopeMb(raw, 10), `«${String(raw)}» debe caer al default`).toBe(10);
        }
    });

    it("fuera de rango se ACOTA: no tumba la subida (min) ni la vuelve infinita (max)", () => {
        expect(normalizarTopeMb("0", 10)).toBe(TOPE_SUBIDA_MB_MIN);
        expect(normalizarTopeMb("-5", 10)).toBe(TOPE_SUBIDA_MB_MIN);
        expect(normalizarTopeMb("999", 10)).toBe(TOPE_SUBIDA_MB_MAX);
    });

    it("hasta el default se acota (jamás se devuelve algo fuera de rango)", () => {
        expect(normalizarTopeMb(null, 9999)).toBe(TOPE_SUBIDA_MB_MAX);
        expect(normalizarTopeMb(null, 0)).toBe(TOPE_SUBIDA_MB_MIN);
    });
});

describe("SPEC-726 · seed idempotente + reader (con BD)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("siembra documentos=10 y autorización=5 (INTEGER · SYSTEM)", async () => {
        await sembrarTopesSubida(prisma);
        const doc = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_TOPE_DOCUMENTOS } });
        const aut = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_TOPE_AUTORIZACION } });
        expect(doc?.valor).toBe(String(DEFAULT_DOCUMENTOS_MB));
        expect(doc?.tipo).toBe("INTEGER");
        expect(doc?.categoria).toBe("SYSTEM");
        expect(aut?.valor).toBe(String(DEFAULT_AUTORIZACION_MB));
    });

    it("IDEMPOTENTE: re-sembrar NO pisa el valor que editó el admin", async () => {
        await sembrarTopesSubida(prisma);
        await prisma.parametroSistema.update({ where: { clave: CLAVE_TOPE_DOCUMENTOS }, data: { valor: "20" } });
        await sembrarTopesSubida(prisma); // redeploy
        const doc = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE_TOPE_DOCUMENTOS } });
        expect(doc?.valor, "el redeploy respeta el valor custom del admin").toBe("20");
        expect(await prisma.parametroSistema.count({ where: { clave: CLAVE_TOPE_DOCUMENTOS } })).toBe(1);
    });

    it("reader: sin fila → default; con fila → el valor; en bytes", async () => {
        expect(await topeDocumentosMb(prisma)).toBe(DEFAULT_DOCUMENTOS_MB); // sin sembrar
        await sembrarTopesSubida(prisma);
        expect(await topeDocumentosMb(prisma)).toBe(DEFAULT_DOCUMENTOS_MB);
        expect(await topeAutorizacionMb(prisma)).toBe(DEFAULT_AUTORIZACION_MB);
        expect(await topeDocumentosBytes(prisma)).toBe(DEFAULT_DOCUMENTOS_MB * 1024 * 1024);
    });

    it("CONTROL POSITIVO: un valor basura en BD NO tumba la subida (cae al default); uno gigante se acota", async () => {
        await sembrarTopesSubida(prisma);
        await prisma.parametroSistema.update({ where: { clave: CLAVE_TOPE_DOCUMENTOS }, data: { valor: "banana" } });
        expect(await topeDocumentosMb(prisma)).toBe(DEFAULT_DOCUMENTOS_MB);
        await prisma.parametroSistema.update({ where: { clave: CLAVE_TOPE_DOCUMENTOS }, data: { valor: "100000" } });
        expect(await topeDocumentosMb(prisma)).toBe(TOPE_SUBIDA_MB_MAX);
    });
});

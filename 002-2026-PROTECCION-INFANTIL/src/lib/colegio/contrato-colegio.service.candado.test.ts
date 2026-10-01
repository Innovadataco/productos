/**
 * CANDADO · SPEC-796 — no-fuga del contrato + aislamiento por colegio (integración, BD de test).
 *
 * Con dato REAL plantado (un contrato adjuntado de verdad, con su archivoId opaco y su archivo
 * cifrado en disco):
 *  · la vista del colegio dueño trae SOLO `adjuntadoEn` — NUNCA el archivoId, la ruta ni el sha256
 *    (el registro guarda el id opaco, pero el DTO no lo deja salir);
 *  · OTRO colegio NO ve nada de este contrato (su vista es null) — no-fuga en las dos direcciones;
 *  · el dueño SÍ puede leer el PDF; otro colegio resuelve a null (el endpoint resuelve por sesión).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { ContratoColegioRepository } from "@/lib/dal/repositories/contrato-colegio";
import {
    adjuntarContratoColegio,
    contratoColegioVista,
    leerContratoColegioVigente,
} from "@/lib/colegio/contrato-colegio.service";

const PDF = Buffer.concat([Buffer.from("%PDF-"), Buffer.from("contrato-firmado-de-prueba")]);
const ADMIN = { id: "admin-test", nombre: "Admin Test", email: "admin@test.local" };

describe("SPEC-796 · no-fuga del contrato del colegio (integración)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("la vista del dueño trae SOLO adjuntadoEn — nunca archivoId, ruta ni sha256", async () => {
        const { colegio } = await crearColegioConAdmin();
        const r = await adjuntarContratoColegio({
            colegio: { id: colegio.id, nombre: colegio.nombre, nit: colegio.nit },
            suscripcionId: null,
            buffer: PDF,
            admin: ADMIN,
            maxBytes: 5 * 1024 * 1024,
            maxMb: 5,
        });
        expect(r.ok).toBe(true);

        // El REGISTRO sí tiene el archivoId opaco (lo necesita para servir)...
        const registro = await new ContratoColegioRepository().vigentePorColegio(colegio.id);
        expect(registro?.archivoId).toBeTruthy();
        const archivoId = registro!.archivoId;
        const sha = registro!.sha256;

        // ...pero el DTO que ve el colegio NO lo deja salir: solo `adjuntadoEn`.
        const vista = await contratoColegioVista(colegio.id);
        expect(vista).not.toBeNull();
        expect(Object.keys(vista!)).toEqual(["adjuntadoEn"]);
        const json = JSON.stringify(vista);
        expect(json).not.toContain(archivoId);
        expect(json).not.toContain(sha);
        expect(json).not.toContain(".enc");
        // el registro guarda un id OPACO, no una ruta de archivo.
        expect(archivoId).not.toContain("/");
        expect(archivoId).not.toContain(".enc");
    });

    it("OTRO colegio NO ve el contrato ajeno (no-fuga en las dos direcciones)", async () => {
        const { colegio: duenio } = await crearColegioConAdmin();
        const { colegio: otro } = await crearColegioConAdmin();
        await adjuntarContratoColegio({
            colegio: { id: duenio.id, nombre: duenio.nombre, nit: duenio.nit },
            suscripcionId: null,
            buffer: PDF,
            admin: ADMIN,
            maxBytes: 5 * 1024 * 1024,
            maxMb: 5,
        });
        // el dueño lo ve; el otro no ve NADA (su vista es null).
        expect(await contratoColegioVista(duenio.id)).not.toBeNull();
        expect(await contratoColegioVista(otro.id)).toBeNull();
    });

    it("el dueño SÍ puede leer el PDF; otro colegio resuelve a null", async () => {
        const { colegio: duenio } = await crearColegioConAdmin();
        const { colegio: otro } = await crearColegioConAdmin();
        await adjuntarContratoColegio({
            colegio: { id: duenio.id, nombre: duenio.nombre, nit: duenio.nit },
            suscripcionId: null,
            buffer: PDF,
            admin: ADMIN,
            maxBytes: 5 * 1024 * 1024,
            maxMb: 5,
        });
        const pdfDuenio = await leerContratoColegioVigente(duenio.id);
        expect(pdfDuenio?.equals(PDF)).toBe(true);
        expect(await leerContratoColegioVigente(otro.id)).toBeNull();
    });

    it("reemplazar = hecho NUEVO (append-only): el vigente es el último", async () => {
        const { colegio } = await crearColegioConAdmin();
        const base = { colegio: { id: colegio.id, nombre: colegio.nombre, nit: colegio.nit }, suscripcionId: null, admin: ADMIN, maxBytes: 5 * 1024 * 1024, maxMb: 5 };
        await adjuntarContratoColegio({ ...base, buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.from("v1")]) });
        await new Promise((r) => setTimeout(r, 5));
        await adjuntarContratoColegio({ ...base, buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.from("v2-reemplazo")]) });
        const total = await prisma.contratoColegio.count({ where: { colegioId: colegio.id } });
        expect(total).toBe(2); // dos hechos, no un update
        const vigente = await leerContratoColegioVigente(colegio.id);
        expect(vigente?.toString().includes("v2-reemplazo")).toBe(true);
    });
});

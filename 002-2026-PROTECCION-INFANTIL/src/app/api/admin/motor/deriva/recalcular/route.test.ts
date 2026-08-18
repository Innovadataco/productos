/**
 * SPEC-172 (Pilar D.5) — Tests de integración del POST
 * /api/admin/motor/deriva/recalcular. BD real; solo se mockea verifyAuth.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { lunesSemanaBogota } from "@/lib/motor/deriva";
import type { CategoriaConducta } from "@prisma/client";

const URL = "http://localhost:5005/api/admin/motor/deriva/recalcular";
const TEXTO_SEMILLA = "Texto semilla de recálculo de deriva";

let seq = 0;

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
    return admin;
}

async function sembrarParametros() {
    await prisma.parametroSistema.createMany({
        data: [
            { clave: "motor.deriva.umbral_pp", valor: "15", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
            { clave: "motor.deriva.min_muestra", valor: "5", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
            { clave: "motor.deriva.ventana_dias", valor: "7", tipo: "INTEGER", categoria: "SYSTEM", esPublico: false },
        ],
    });
}

async function sembrarClasificaciones(categoria: CategoriaConducta, n: number, creadoEn: Date, conCorreccion: number) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const admin = await crearUsuario("ADMIN");
    for (let i = 0; i < n; i++) {
        seq += 1;
        const reporte = await prisma.reporte.create({
            data: {
                identificador: `+57300REC${seq}`,
                plataformaId: plataforma!.id,
                texto: TEXTO_SEMILLA,
                fechaIncidente: creadoEn,
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria,
                confianza: 0.8,
                modeloUsado: "ornith:9b",
                latenciaMs: 100,
                creadoEn,
            },
        });
        if (i < conCorreccion) {
            await prisma.correccionAdmin.create({
                data: {
                    clasificacionId: clasificacion.id,
                    categoriaOriginal: categoria,
                    categoriaCorregida: "SOLICITUD_ENCUENTRO",
                    adminId: admin.id,
                    confirmada: true,
                    creadoEn,
                },
            });
        }
    }
}

describe("POST /api/admin/motor/deriva/recalcular (SPEC-172)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("401 sin autenticación", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401));
        const res = await POST(new Request(URL, { method: "POST" }));
        expect(res.status).toBe(401);
    });

    it("403 con rol PARENT (verifyAuth exige ADMIN)", async () => {
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403));
        const res = await POST(new Request(URL, { method: "POST" }));
        expect(res.status).toBe(403);
    });

    it("recalcula la ventana móvil, persiste el snapshot y audita sin PII", async () => {
        const admin = await autenticarAdmin();
        await sembrarParametros();
        const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await sembrarClasificaciones("OFRECIMIENTO_REGALOS", 6, hace2Dias, 1); // dentro de la ventana
        await sembrarClasificaciones("OFRECIMIENTO_REGALOS", 4, hace30Dias, 4); // fuera de la ventana

        const res = await POST(new Request(URL, { method: "POST" }));
        expect(res.status).toBe(200);
        const body = await res.json();

        // Ventana móvil de 7 días: solo cuentan las 6 recientes y 1 corrección.
        const fila = body.filas.find((f: { categoria: string }) => f.categoria === "OFRECIMIENTO_REGALOS");
        expect(fila.total).toBe(6);
        expect(fila.correcciones).toBe(1);
        expect(fila.tasaCorreccion).toBeCloseTo(1 / 6, 10);
        // Sin banco curado → sin brecha.
        expect(fila.accuracyBanco).toBeNull();
        expect(fila.brechaPp).toBeNull();

        // semanaInicio = lunes de esta semana (America/Bogota).
        const semanaEsperada = lunesSemanaBogota(new Date());
        expect(body.semanaInicio).toBe(semanaEsperada.toISOString());

        // Persistido con la misma clave.
        const snapshots = await prisma.derivaMotorSnapshot.findMany({ where: { semanaInicio: semanaEsperada } });
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.total).toBe(6);

        // Auditado con metadatos agregados, sin textos ni identificadores.
        const audit = await prisma.auditLog.findFirst({
            where: { accion: "MOTOR_DERIVA_RECALCULO", usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.tipoRecurso).toBe("DerivaMotorSnapshot");
        expect(JSON.stringify(audit?.metadatos)).not.toContain(TEXTO_SEMILLA);
        expect(JSON.stringify(audit?.metadatos)).not.toContain("+57300REC");

        // La respuesta tampoco expone textos ni identificadores.
        expect(JSON.stringify(body)).not.toContain(TEXTO_SEMILLA);
        expect(JSON.stringify(body)).not.toContain("+57300REC");
    });

    it("segundo recálculo de la misma semana actualiza sin duplicar (upsert)", async () => {
        await autenticarAdmin();
        await sembrarParametros();
        const hace2Dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
        await sembrarClasificaciones("EXTORSION", 6, hace2Dias, 2);

        await POST(new Request(URL, { method: "POST" }));
        await sembrarClasificaciones("EXTORSION", 1, hace2Dias, 1);
        const res = await POST(new Request(URL, { method: "POST" }));
        expect(res.status).toBe(200);

        const semanaEsperada = lunesSemanaBogota(new Date());
        const snapshots = await prisma.derivaMotorSnapshot.findMany({
            where: { semanaInicio: semanaEsperada, categoria: "EXTORSION" },
        });
        expect(snapshots).toHaveLength(1);
        expect(snapshots[0]?.total).toBe(7);
        expect(snapshots[0]?.correcciones).toBe(3);
    });
});

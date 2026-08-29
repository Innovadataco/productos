/**
 * SPEC-149 (T002, FR-009): tests de los repos de avisos del colegio.
 * A/B con dos colegios: B nunca ve ni pisa lo de A. Idempotencia real por
 * constraint: misma clave dos veces ⇒ UNA fila (no-op), no excepción.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PreferenciaAlertaColegioRepository } from "./preferencia-alerta-colegio";
import { RegistroAvisoColegioRepository } from "./registro-aviso-colegio";

const DIA = new Date(Date.UTC(2026, 7, 10)); // 2026-08-10

describe("PreferenciaAlertaColegioRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("upsert crea la fila y un segundo upsert la ACTUALIZA sin duplicar", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new PreferenciaAlertaColegioRepository();

        const creada = await repo.upsertPreferencia(colegio.id, "UMBRAL_CURSO", { habilitado: true, umbral: 2, ventanaDias: 7 });
        expect(creada.colegioId).toBe(colegio.id);
        expect(creada.umbral).toBe(2);

        const actualizada = await repo.upsertPreferencia(colegio.id, "UMBRAL_CURSO", { umbral: 5 });
        expect(actualizada.id).toBe(creada.id);
        expect(actualizada.umbral).toBe(5);
        expect(actualizada.ventanaDias).toBe(7); // campo ausente ≡ no tocarlo

        const filas = await repo.listarPorColegio(colegio.id);
        expect(filas).toHaveLength(1);
    });

    it("A/B: el colegio B no ve las preferencias del colegio A y su upsert no pisa la de A", async () => {
        const { colegio: colegioA } = await crearColegioConAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const repo = new PreferenciaAlertaColegioRepository();

        await repo.upsertPreferencia(colegioA.id, "REPORTE_NUEVO", { habilitado: false, emailDestino: "a@colegio.edu.co" });

        expect(await repo.listarPorColegio(colegioB.id)).toHaveLength(0);
        expect(await repo.obtenerPorTipo(colegioB.id, "REPORTE_NUEVO")).toBeNull();

        await repo.upsertPreferencia(colegioB.id, "REPORTE_NUEVO", { habilitado: true });

        const deA = await repo.obtenerPorTipo(colegioA.id, "REPORTE_NUEVO");
        expect(deA?.habilitado).toBe(false);
        expect(deA?.emailDestino).toBe("a@colegio.edu.co");
    });
});

describe("RegistroAvisoColegioRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("idempotencia por constraint: misma clave dos veces ⇒ UNA fila y creado=false", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new RegistroAvisoColegioRepository();
        const clave = { colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO" as const, entidadId: "reporte-1", dia: DIA };

        const primera = await repo.registrarSiAusente(clave, "ENVIADO");
        expect(primera.creado).toBe(true);

        const segunda = await repo.registrarSiAusente(clave, "ENVIADO");
        expect(segunda.creado).toBe(false);
        expect(segunda.registro.id).toBe(primera.registro.id);

        const filas = await prisma.registroAvisoColegio.findMany({ where: { colegioId: colegio.id } });
        expect(filas).toHaveLength(1);
    });

    it("otra entidad u otro día SÍ crean fila nueva", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new RegistroAvisoColegioRepository();
        const base = { colegioId: colegio.id, tipoEvento: "REPORTE_NUEVO" as const, entidadId: "reporte-1", dia: DIA };

        await repo.registrarSiAusente(base, "ENVIADO");
        const otraEntidad = await repo.registrarSiAusente({ ...base, entidadId: "reporte-2" }, "ENVIADO");
        const otroDia = await repo.registrarSiAusente({ ...base, dia: new Date(Date.UTC(2026, 7, 11)) }, "ENVIADO");

        expect(otraEntidad.creado).toBe(true);
        expect(otroDia.creado).toBe(true);
        expect(await prisma.registroAvisoColegio.count({ where: { colegioId: colegio.id } })).toBe(3);
    });

    it("contarEnviadosDelDia solo cuenta ENVIADO del día y excluye RESUMEN_SEMANAL", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new RegistroAvisoColegioRepository();
        const base = { colegioId: colegio.id, dia: DIA };

        await repo.registrarSiAusente({ ...base, tipoEvento: "REPORTE_NUEVO", entidadId: "r1" }, "ENVIADO");
        await repo.registrarSiAusente({ ...base, tipoEvento: "UMBRAL_CURSO", entidadId: "c1" }, "PENDIENTE_DIGEST");
        await repo.registrarSiAusente({ ...base, tipoEvento: "ESTUDIANTE_REPETIDO", entidadId: "e1" }, "OMITIDO");
        await repo.registrarSiAusente({ ...base, tipoEvento: "RESUMEN_SEMANAL", entidadId: "semanal" }, "ENVIADO");
        await repo.registrarSiAusente({ ...base, tipoEvento: "REPORTE_NUEVO", entidadId: "r1", dia: new Date(Date.UTC(2026, 7, 11)) }, "ENVIADO");

        expect(await repo.contarEnviadosDelDia(colegio.id, DIA)).toBe(1);
    });

    it("pendientesDigest devuelve los PENDIENTE_DIGEST y marcarDigestComoEnviados los entrega", async () => {
        const { colegio } = await crearColegioConAdmin();
        const repo = new RegistroAvisoColegioRepository();
        const base = { colegioId: colegio.id, dia: DIA };

        await repo.registrarSiAusente({ ...base, tipoEvento: "REPORTE_NUEVO", entidadId: "r1" }, "PENDIENTE_DIGEST");
        await repo.registrarSiAusente({ ...base, tipoEvento: "REPORTE_NUEVO", entidadId: "r2" }, "PENDIENTE_DIGEST");
        await repo.registrarSiAusente({ ...base, tipoEvento: "REPORTE_NUEVO", entidadId: "r3" }, "ENVIADO");

        const pendientes = await repo.pendientesDigest(colegio.id);
        expect(pendientes).toHaveLength(2);

        await repo.marcarDigestComoEnviados(colegio.id, pendientes.map((p) => p.id), "incluido en resumen 2026-08-10");
        expect(await repo.pendientesDigest(colegio.id)).toHaveLength(0);

        const entregados = await prisma.registroAvisoColegio.findMany({
            where: { colegioId: colegio.id, estado: "ENVIADO" },
        });
        expect(entregados).toHaveLength(3);
    });

    it("A/B: los registros del colegio A no cuentan ni se listan para el colegio B", async () => {
        const { colegio: colegioA } = await crearColegioConAdmin();
        const { colegio: colegioB } = await crearColegioConAdmin();
        const repo = new RegistroAvisoColegioRepository();

        await repo.registrarSiAusente({ colegioId: colegioA.id, tipoEvento: "REPORTE_NUEVO", entidadId: "r1", dia: DIA }, "ENVIADO");
        await repo.registrarSiAusente({ colegioId: colegioA.id, tipoEvento: "UMBRAL_CURSO", entidadId: "c1", dia: DIA }, "PENDIENTE_DIGEST");

        expect(await repo.contarEnviadosDelDia(colegioB.id, DIA)).toBe(0);
        expect(await repo.pendientesDigest(colegioB.id)).toHaveLength(0);
        // La misma clave en B es un evento DISTINTO: crea su propia fila.
        const deB = await repo.registrarSiAusente({ colegioId: colegioB.id, tipoEvento: "REPORTE_NUEVO", entidadId: "r1", dia: DIA }, "ENVIADO");
        expect(deB.creado).toBe(true);
    });
});

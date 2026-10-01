/**
 * CANDADO de CONDUCTA · SPEC-751 (T012c) · la puerta de audiencia del menor lee `AudienciaMenor`
 * como FUENTE ÚNICA, per-menor, con DATO REAL. Integración (BD aislada).
 *
 * Vigila las conductas que el predicado puro NO puede garantizar solo (necesitan la tabla):
 *   · per-menor: oír a UNO no cubre a los demás (fuente = filas reales, no un flag denormalizado).
 *   · versión (FR-008): oído para una versión vieja sigue pendiente si la política re-oír está activa.
 *   · la cuenta MANDA (SPEC-241 no se debilita): consent no vigente ⇒ titular no al día.
 *   · solo menores ACTIVOS cuentan.
 *   · declarar es idempotente por (menor, versión) y deja UN rastro durable en AuditLog sin PII.
 *   · PII: declarar un menor AJENO se rechaza (nunca por id suelto).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    declararAudienciaMenor,
    hayAudienciaPendiente,
    menoresPendientesDeAudienciaDelTitular,
    titularAlDiaDeAudiencia,
} from "./audiencia-menor";

const VERSION = "v-test-actual";

async function sembrarParametros(reoir: boolean) {
    await prisma.parametroSistema.upsert({
        where: { clave: "consentimiento.version_actual" },
        update: { valor: VERSION },
        create: { clave: "consentimiento.version_actual", valor: VERSION, tipo: "STRING", categoria: "LEGAL" },
    });
    await prisma.parametroSistema.upsert({
        where: { clave: "audiencia_menor.reoir_en_cambio_de_version" },
        update: { valor: reoir ? "true" : "false" },
        create: {
            clave: "audiencia_menor.reoir_en_cambio_de_version",
            valor: reoir ? "true" : "false",
            tipo: "BOOLEAN",
            categoria: "LEGAL",
        },
    });
}

async function crearPadre(email: string, consentimientoVersion: string | null) {
    const padre = await crearUsuario("PARENT", email);
    if (consentimientoVersion !== null) {
        await prisma.usuario.update({ where: { id: padre.id }, data: { consentimientoVersion } });
    }
    return padre;
}

async function crearHijo(usuarioId: string, nombre: string, estado = "activo") {
    return prisma.hijo.create({ data: { usuarioId, nombre, estado }, select: { id: true } });
}

const email = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2)}@t.local`;

describe("SPEC-751 · conducta de la puerta de audiencia (fuente única, per-menor, dato real)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarParametros(true);
    });

    it("C-per-menor: declarar a UN menor NO cubre a los demás (per-menor, no global)", async () => {
        const padre = await crearPadre(email("per-menor"), VERSION);
        const a = await crearHijo(padre.id, "A");
        const b = await crearHijo(padre.id, "B");

        expect(await hayAudienciaPendiente(padre.id)).toBe(true);
        expect((await menoresPendientesDeAudienciaDelTitular(padre.id)).sort()).toEqual([a.id, b.id].sort());

        const r = await declararAudienciaMenor({ usuarioId: padre.id, hijoId: a.id });
        expect(r.yaRegistrada).toBe(false);

        // A ya oído; B sigue pendiente — la fuente es AudienciaMenor, per-menor.
        expect(await menoresPendientesDeAudienciaDelTitular(padre.id)).toEqual([b.id]);
        expect(await hayAudienciaPendiente(padre.id)).toBe(true);

        await declararAudienciaMenor({ usuarioId: padre.id, hijoId: b.id });
        expect(await hayAudienciaPendiente(padre.id)).toBe(false);
        expect(await titularAlDiaDeAudiencia(padre.id)).toBe(true);
    });

    it("C-version (reoir=true): oído para una versión VIEJA sigue pendiente para la vigente", async () => {
        const padre = await crearPadre(email("version"), VERSION);
        const a = await crearHijo(padre.id, "A");
        await prisma.audienciaMenor.create({
            data: { hijoId: a.id, consentimientoVersion: "v-vieja", declaradoPor: padre.id },
        });

        // Política re-oír activa → la audiencia vieja no vale para la versión vigente.
        expect(await menoresPendientesDeAudienciaDelTitular(padre.id)).toEqual([a.id]);

        // Política re-oír APAGADA → una audiencia (cualquier versión) basta.
        await sembrarParametros(false);
        expect(await menoresPendientesDeAudienciaDelTitular(padre.id)).toEqual([]);
    });

    it("C-cuenta-manda (SPEC-241 no se debilita): consent NO vigente → NO al día aunque el menor esté oído", async () => {
        const padre = await crearPadre(email("cuenta"), "v-vieja"); // consent NO vigente
        const a = await crearHijo(padre.id, "A");
        await prisma.audienciaMenor.create({
            data: { hijoId: a.id, consentimientoVersion: VERSION, declaradoPor: padre.id },
        });

        // El eje per-menor está al día, pero la CUENTA manda primero.
        expect(await menoresPendientesDeAudienciaDelTitular(padre.id)).toEqual([]);
        expect(await titularAlDiaDeAudiencia(padre.id)).toBe(false);
    });

    it("C-solo-activos: un menor INACTIVO no cuenta como pendiente", async () => {
        const padre = await crearPadre(email("activos"), VERSION);
        await crearHijo(padre.id, "Activo");
        await crearHijo(padre.id, "Inactivo", "inactivo");

        const pendientes = await menoresPendientesDeAudienciaDelTitular(padre.id);
        expect(pendientes.length).toBe(1);
    });

    it("C-idempotente + AuditLog: declarar 2x crea UN hecho y UN audit (metadatos sin PII del menor)", async () => {
        const padre = await crearPadre(email("idem"), VERSION);
        const NOMBRE_MENOR = "NombrePrivadoDelMenor";
        const a = await crearHijo(padre.id, NOMBRE_MENOR);

        const r1 = await declararAudienciaMenor({ usuarioId: padre.id, hijoId: a.id });
        const r2 = await declararAudienciaMenor({ usuarioId: padre.id, hijoId: a.id });
        expect(r1.yaRegistrada).toBe(false);
        expect(r2.yaRegistrada).toBe(true);

        // Un hecho, no dos (idempotente por el @@unique).
        const filas = await prisma.audienciaMenor.findMany({ where: { hijoId: a.id } });
        expect(filas.length).toBe(1);
        expect(filas[0].declaradoPor).toBe(padre.id);
        expect(filas[0].consentimientoVersion).toBe(VERSION);

        // Un audit, no dos — y rastro DURABLE de responsabilidad sin PII del menor.
        const audits = await prisma.auditLog.findMany({
            where: { accion: "AUDIENCIA_MENOR_DECLARADA", recursoId: a.id },
        });
        expect(audits.length).toBe(1);
        const vn = audits[0].valorNuevo ?? "";
        expect(vn).toContain(a.id);
        expect(vn).toContain(VERSION);
        expect(vn, "el audit NO debe filtrar el nombre del menor").not.toContain(NOMBRE_MENOR);
    });

    it("C-propiedad: declarar la audiencia de un menor AJENO → se rechaza (PII, nunca por id suelto)", async () => {
        const padre = await crearPadre(email("prop-1"), VERSION);
        const otro = await crearPadre(email("prop-2"), VERSION);
        const hijoAjeno = await crearHijo(otro.id, "Ajeno");

        await expect(
            declararAudienciaMenor({ usuarioId: padre.id, hijoId: hijoAjeno.id }),
        ).rejects.toThrow();

        // No se creó ninguna fila para el menor ajeno.
        const filas = await prisma.audienciaMenor.findMany({ where: { hijoId: hijoAjeno.id } });
        expect(filas.length).toBe(0);
    });
});

/**
 * SPEC-814 · [NORMA] Ley 1581 art. 19 · CANDADO ESTRUCTURAL del modelo de reubicación de cita.
 *
 * Prisma es CIEGO a la «ausencia de un FK» y a los CHECK: no los declara en el schema. Este candado
 * lee el CATÁLOGO de la BD (pg_constraint / pg_enum) y fija lo que el modelo DEBE ser:
 *
 *  (A) reubicadaEnId TIENE un FK self → SolicitudCita: el enlace a la cita NUEVA (las citas no se
 *      borran, por eso aquí un FK es seguro; SetNull como las demás auto-referencias).
 *  (B) reubicadaPorId NO tiene NINGÚN FK: es la prueba DURABLE del art. 19 (quién movió ESTA cita) y
 *      NO puede borrarse con la cuenta del actor. CONTROL POSITIVO: si alguien lo «normaliza» a un FK,
 *      este count pasa de 0 a 1 y el candado se pone ROJO. «Las cuentas se borran, las citas no.»
 *  (C) REUBICADA ∈ EstadoSolicitudCita (estado TERMINAL de la cita movida; NO es CANCELADA).
 *  (D) CITA_PROFESIONAL_REUBICADA ∈ AccionAudit (rastro del HECHO; el QUIÉN consultable vive en el
 *      campo (B), no en el payload del hecho, porque AuditLog SÍ replica a bi_replica y SolicitudCita no).
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

async function countFkSolicitudCita(columna: string): Promise<number> {
    const r = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n
           FROM pg_constraint c
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
          WHERE c.conrelid = '"SolicitudCita"'::regclass AND c.contype = 'f' AND a.attname = $1`,
        columna,
    );
    return Number(r[0]?.n ?? -1);
}

async function enumTieneValor(tipo: string, valor: string): Promise<number> {
    const r = await prisma.$queryRawUnsafe<{ n: number }[]>(
        `SELECT count(*)::int AS n
           FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = $1 AND e.enumlabel = $2`,
        tipo,
        valor,
    );
    return Number(r[0]?.n ?? -1);
}

describe("SPEC-814 · candado estructural del modelo de reubicación de cita", () => {
    it("(A) reubicadaEnId TIENE un FK self a SolicitudCita", async () => {
        expect(await countFkSolicitudCita("reubicadaEnId")).toBe(1);
    });

    it("(B) reubicadaPorId NO tiene FK (durable; un FK lo pondría rojo — control positivo)", async () => {
        expect(await countFkSolicitudCita("reubicadaPorId")).toBe(0);
    });

    it("(C) REUBICADA es un valor de EstadoSolicitudCita", async () => {
        expect(await enumTieneValor("EstadoSolicitudCita", "REUBICADA")).toBe(1);
    });

    it("(D) CITA_PROFESIONAL_REUBICADA es un valor de AccionAudit", async () => {
        expect(await enumTieneValor("AccionAudit", "CITA_PROFESIONAL_REUBICADA")).toBe(1);
    });
});

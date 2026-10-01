/**
 * SPEC-812 (pieza 3) · CANDADO del corrector operativo de parámetros.
 *
 * El corrector de un valor VIVO corre SIN sesión (lo ejecuta el CEO desde el contenedor), así que su
 * actor es NULL a propósito y la responsabilidad del HECHO se registra por `motivo` en el AuditLog —
 * no en un FK de Usuario fabricado. Este candado fija el contrato que vuelve eso honesto:
 *
 *  (A) Contrato de TIPO (lo verifica tsc, NO el runtime): la API `actualizar()` exige actor `string`,
 *      NO `string | null`. Aflojar para el script no puede aflojar para la API: si alguien ensancha el
 *      tipo —para colar el corrector por una ruta HTTP— este archivo NO compila. Se afirma el CONTRATO
 *      (el 3er parámetro ES `string`), no solo la ocurrencia de un error en una línea.
 *  (B) El corrector escribe con actor NULL y `motivo` presente en el AuditLog — camino de escritura
 *      verificado, no solo «la columna es nullable».
 *  (C) `motivo` vacío o de solo espacios es RECHAZADO y NO escribe nada: sin actor, un motivo vacío
 *      cambia «actor fabricado» por «rastro vacío» — el mismo agujero con otra forma.
 *  (D) Control positivo: la API con un usuario real SÍ registra ese usuario como actor (el mecanismo
 *      de actor funciona; el null del corrector es una decisión deliberada, no un actor roto).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { ConfiguracionService } from "./configuracion";
import type { ParametroPatchInput } from "../types/parametro";

// (A) Contrato de tipo — verificado por tsc.
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
// El 3er parámetro de `actualizar()` es EXACTAMENTE `string`. Si se ensancha a `string | null`,
// Equal<...> pasa a `false` y la definición de este alias NO compila:
type _ActorHttpEsStringNoNull = Expect<Equal<Parameters<ConfiguracionService["actualizar"]>[2], string>>;
// Refuerzo (afirma la OCURRENCIA además del contrato): pasar null a la API no compila. Nunca se corre.
function _apiNoAceptaNullComoActor(svc: ConfiguracionService): void {
    // @ts-expect-error — `actualizar` (camino HTTP) exige usuarioId: string; pasar null no compila.
    void svc.actualizar("x", { valor: "y" }, null);
}

const CLAVE = "spec812.corrector.test";
const bodyInt = (valor: string): ParametroPatchInput => ({ valor, tipo: "INTEGER", categoria: "SYSTEM" });

describe("ConfiguracionService · corrector operativo (SPEC-812 pieza 3)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("(A) fija el contrato de tipo: la API exige actor string, no string|null (lo verifica tsc)", () => {
        const _t: _ActorHttpEsStringNoNull = true;
        expect(_t).toBe(true);
        expect(_apiNoAceptaNullComoActor).toBeTypeOf("function");
    });

    it("(B) el corrector escribe con actor NULL y motivo en el AuditLog", async () => {
        const svc = new ConfiguracionService();
        const motivo = "SPEC-812: baja operativa del timeout de Ollama, corrida por el CEO desde el contenedor";
        const dto = await svc.actualizarComoCorrectorOperativo(CLAVE, bodyInt("60000"), motivo);
        expect(dto.valor).toBe("60000");

        const fila = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } });
        expect(fila?.valor).toBe("60000");
        expect(fila?.actualizadoPorId).toBeNull();

        const audits = await prisma.auditLog.findMany({ where: { parametroId: fila!.id } });
        expect(audits).toHaveLength(1);
        expect(audits[0].usuarioId).toBeNull();
        expect(audits[0].accion).toBe("PARAM_UPDATE");
        const meta = audits[0].metadatos as unknown as { motivo?: string; corrector?: boolean } | null;
        expect(meta?.motivo).toBe(motivo);
        expect(meta?.corrector).toBe(true);
    });

    it("(C) rechaza motivo vacío o de solo espacios y NO escribe nada", async () => {
        const svc = new ConfiguracionService();
        await expect(svc.actualizarComoCorrectorOperativo(CLAVE, bodyInt("60000"), "")).rejects.toThrow();
        await expect(svc.actualizarComoCorrectorOperativo(CLAVE, bodyInt("60000"), "   ")).rejects.toThrow();
        // Rechazo ANTES de escribir: ni parámetro ni auditoría.
        expect(await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } })).toBeNull();
        expect(await prisma.auditLog.count()).toBe(0);
    });

    it("(D) control positivo: la API con usuario real registra ese usuario como actor", async () => {
        const admin = await crearUsuario("ADMIN");
        const svc = new ConfiguracionService();
        await svc.actualizar(CLAVE, bodyInt("50000"), admin.id);

        const fila = await prisma.parametroSistema.findUnique({ where: { clave: CLAVE } });
        expect(fila?.actualizadoPorId).toBe(admin.id);
        const audits = await prisma.auditLog.findMany({ where: { parametroId: fila!.id } });
        expect(audits[0].usuarioId).toBe(admin.id);
    });
});

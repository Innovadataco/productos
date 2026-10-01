/**
 * CANDADO · SPEC-827 · el OBJETO de la petición de habeas data, por TIPO.
 *
 * Una `RECTIFICACION`/`SUPRESION` SIN objeto no es accionable y el plazo legal corre igual — es el defecto
 * que 827 existe para cerrar. `CONSULTA` no lleva objeto. El invariante va en DOS capas, y el candado prueba
 * las dos (el CEO lo pidió así: «CHECK + candado de inserción, no solo el superRefine»):
 *
 *  (1) CONDUCTA (service `crearPeticionServicio`): corta con un error LIMPIO antes del error crudo de la base;
 *      persiste las clases que pidió el titular (en `clasesSolicitadas`, el campo de la PETICIÓN — NUNCA en
 *      `clasesDatoAfectadas`, que es la RESOLUCIÓN del operador).
 *  (2) INSERCIÓN (CHECK `objeto_por_tipo`, NOT VALID): vale también contra ESCRITURAS CRUDAS — un insert que
 *      saltee el service no puede dejar una RECTIFICACION/SUPRESION sin objeto ni una CONSULTA con objeto.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearPeticionServicio } from "./peticion-servicio.service";

let n = 0;
const email = (p: string) => `${p}.827.${Date.now()}.${n++}@ejemplo.local`;
const nuevoPadre = () => crearUsuario("PARENT", email("padre"));

/** Campos NOT NULL mínimos para un insert CRUDO válido salvo por lo que probamos (el objeto). */
function filaCruda(tipo: "CONSULTA" | "RECTIFICACION" | "SUPRESION", clasesSolicitadas: ("RELATO_CITA" | "PERFIL")[]) {
    const ahora = new Date();
    return {
        tipo,
        calidad: "TITULAR_CUENTA" as const, // eje_sujeto permite sujetoDelDato null
        plazoDias: tipo === "CONSULTA" ? 10 : 15, // techo legal
        recibidoEn: ahora,
        venceEn: new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000), // vence_gt_recibido
        origen: "APLICACION" as const,
        clasesSolicitadas,
    };
}

describe("SPEC-827 · objeto de la petición por tipo", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    // ─── (1) CONDUCTA · el service ───────────────────────────────────────────────
    it("RECTIFICACION con objeto → crea y PERSISTE las clases pedidas en clasesSolicitadas (no en la resolución)", async () => {
        const padre = await nuevoPadre();
        const { numeroSeguimiento } = await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo: "RECTIFICACION", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: ["RELATO_CITA"] },
        });
        const pqr = await prisma.peticionServicio.findUnique({
            where: { id: numeroSeguimiento },
            include: { solicitudHabeasData: true },
        });
        expect(pqr?.solicitudHabeasData?.clasesSolicitadas).toEqual(["RELATO_CITA"]);
        // el objeto de la PETICIÓN no contamina el de la RESOLUCIÓN del operador (vacío hasta resolver).
        expect(pqr?.solicitudHabeasData?.clasesDatoAfectadas).toEqual([]);
    });

    it("RECTIFICACION SIN objeto → el service corta con error limpio y NO deja constancia", async () => {
        const padre = await nuevoPadre();
        await expect(
            crearPeticionServicio({
                usuarioId: padre.id,
                motivo: "DATOS_PERSONALES",
                habeasData: { tipo: "RECTIFICACION", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: [] },
            }),
        ).rejects.toThrow(/sobre qué datos/i);
        expect(await prisma.solicitudHabeasData.count(), "un rechazo no deja constancia").toBe(0);
    });

    it("SUPRESION SIN objeto → rechazo (misma razón que RECTIFICACION)", async () => {
        const padre = await nuevoPadre();
        await expect(
            crearPeticionServicio({
                usuarioId: padre.id,
                motivo: "DATOS_PERSONALES",
                habeasData: { tipo: "SUPRESION", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: [] },
            }),
        ).rejects.toThrow(/sobre qué datos/i);
        expect(await prisma.solicitudHabeasData.count()).toBe(0);
    });

    it("CONSULTA SIN objeto → crea (no necesita objeto); CONSULTA CON objeto → rechazo", async () => {
        const padre = await nuevoPadre();
        const ok = await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo: "CONSULTA", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: [] },
        });
        const pqr = await prisma.peticionServicio.findUnique({
            where: { id: ok.numeroSeguimiento },
            include: { solicitudHabeasData: true },
        });
        expect(pqr?.solicitudHabeasData?.clasesSolicitadas).toEqual([]);

        await expect(
            crearPeticionServicio({
                usuarioId: padre.id,
                motivo: "DATOS_PERSONALES",
                habeasData: { tipo: "CONSULTA", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: ["RELATO_CITA"] },
            }),
        ).rejects.toThrow(/consulta no lleva/i);
    });

    // ─── (2) INSERCIÓN · el CHECK contra escrituras CRUDAS (saltea el service) ────
    it("CHECK · un insert CRUDO de RECTIFICACION sin objeto lo RECHAZA la base (no solo el service)", async () => {
        await expect(prisma.solicitudHabeasData.create({ data: filaCruda("RECTIFICACION", []) })).rejects.toThrow();
        expect(await prisma.solicitudHabeasData.count(), "la base no dejó entrar la fila sin objeto").toBe(0);
    });

    it("CHECK · un insert CRUDO de CONSULTA CON objeto lo RECHAZA la base", async () => {
        await expect(prisma.solicitudHabeasData.create({ data: filaCruda("CONSULTA", ["RELATO_CITA"]) })).rejects.toThrow();
        expect(await prisma.solicitudHabeasData.count()).toBe(0);
    });

    it("CHECK · el filo del {NULL}: un RECTIFICACION con `{NULL}` (cardinality=1, CERO objeto real) lo RECHAZA la base", async () => {
        // El cliente tipado no deja construir `[null]`; sólo un write CRUDO lo intenta. `cardinality` solo daría
        // 1 (lo dejaría pasar) — el CHECK cuenta no-nulos con `array_remove`, así que el {NULL} también es imposible.
        const id = `827null-${Date.now()}`;
        const ahora = new Date().toISOString();
        const vence = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();
        await expect(
            prisma.$executeRawUnsafe(
                `INSERT INTO "SolicitudHabeasData" ("id","tipo","estado","calidad","plazoDias","recibidoEn","venceEn","origen","clasesSolicitadas")
                 VALUES ('${id}','RECTIFICACION','RECIBIDA','TITULAR_CUENTA',15,'${ahora}'::timestamptz,'${vence}'::timestamptz,'APLICACION', ARRAY[NULL]::"ClaseDatoTitular"[])`,
            ),
        ).rejects.toThrow();
        expect(await prisma.solicitudHabeasData.count(), "el {NULL} no es objeto real: la base lo rechaza").toBe(0);
    });

    it("CONTROL POSITIVO · un insert CRUDO de RECTIFICACION CON objeto SÍ entra (el CHECK no bloquea lo válido)", async () => {
        await prisma.solicitudHabeasData.create({ data: filaCruda("RECTIFICACION", ["PERFIL"]) });
        expect(await prisma.solicitudHabeasData.count()).toBe(1);
    });
});

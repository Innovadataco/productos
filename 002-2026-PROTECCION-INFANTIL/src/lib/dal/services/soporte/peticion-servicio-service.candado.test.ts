/**
 * CANDADO · SPEC-819 (criterio b) · el SERVICIO de la puerta deja la constancia legal, no solo la PQR.
 *
 *   (b) una petición `DATOS_PERSONALES` CREA una fila en `SolicitudHabeasData` (el registro canónico),
 *       enlazada a la PQR — verificado LEYENDO el registro legal por el enlace (no el PeticionServicio solo).
 *   · el `tipo` que eligió el padre se CONSERVA (no se colapsa) y fija el `plazoDias` legal (10/15) desde la
 *     fuente única — la puerta no infiere el plazo.
 *   · «míos» ⇒ sujetoDelDato = null (TITULAR_CUENTA); «de mi hijo» ⇒ sujetoDelDato = el hijoId
 *     (REPRESENTANTE_LEGAL). El hijo DEBE ser de ESTE padre: pedir sobre el hijo de otro se RECHAZA.
 *   · un motivo NO-legal crea SOLO la PQR (cero filas en el registro legal) — la constancia es exclusiva de
 *     habeas data.
 *   · contrato 1:1: DATOS_PERSONALES sin detalle, o detalle en un motivo que no es habeas data → rechazo.
 *
 * Integración (BD de test). NO toca prod.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearPeticionServicio } from "./peticion-servicio.service";

let n = 0;
const email = (p: string) => `${p}.819svc.${Date.now()}.${n++}@ejemplo.local`;

async function nuevoPadre() {
    return crearUsuario("PARENT", email("padre"));
}
async function nuevoHijo(usuarioId: string, nombre = "Ana") {
    return prisma.hijo.create({ data: { usuarioId, nombre, apellidos: "Pérez" } });
}

describe("SPEC-819 · servicio de la Puerta de Soporte", { timeout: 30_000 }, () => {
    beforeEach(async () => resetDatabase());
    afterAll(async () => prisma.$disconnect());

    it("(b) DATOS_PERSONALES «míos» deja fila en SolicitudHabeasData, enlazada, TITULAR_CUENTA, sujeto null", async () => {
        const padre = await nuevoPadre();
        const { numeroSeguimiento } = await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo: "CONSULTA", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: [] },
        });

        // Se lee el REGISTRO LEGAL por el enlace — verificar solo la PQR no probaría la obligación.
        const pqr = await prisma.peticionServicio.findUnique({
            where: { id: numeroSeguimiento },
            include: { solicitudHabeasData: true },
        });
        expect(pqr?.motivo).toBe("DATOS_PERSONALES");
        const sol = pqr?.solicitudHabeasData;
        expect(sol, "DATOS_PERSONALES DEBE dejar fila en SolicitudHabeasData").not.toBeNull();
        expect(sol?.tipo).toBe("CONSULTA");
        expect(sol?.calidad).toBe("TITULAR_CUENTA");
        expect(sol?.sujetoDelDato, "«míos» no nombra sujeto aparte (CHECK eje_sujeto lo permite null)").toBeNull();
        expect(sol?.origen).toBe("APLICACION");
        expect(sol?.plazoDias).toBe(10); // CONSULTA → techo legal 10
        expect(sol!.venceEn.getTime(), "venceEn legal > recibidoEn").toBeGreaterThan(sol!.recibidoEn.getTime());
    });

    it.each([
        ["CONSULTA", 10],
        ["RECTIFICACION", 15],
        ["SUPRESION", 15],
    ] as const)("el tipo %s se CONSERVA y fija plazoDias=%i (no se colapsa al más corto)", async (tipo, dias) => {
        const padre = await nuevoPadre();
        const { numeroSeguimiento } = await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo, sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: tipo === "CONSULTA" ? [] : ["RELATO_CITA"] },
        });
        const pqr = await prisma.peticionServicio.findUnique({ where: { id: numeroSeguimiento }, include: { solicitudHabeasData: true } });
        expect(pqr?.solicitudHabeasData?.tipo).toBe(tipo);
        expect(pqr?.solicitudHabeasData?.plazoDias).toBe(dias);
    });

    it("«de mi hijo» registra el hijoId como sujeto (REPRESENTANTE_LEGAL)", async () => {
        const padre = await nuevoPadre();
        const hijo = await nuevoHijo(padre.id);
        const { numeroSeguimiento } = await crearPeticionServicio({
            usuarioId: padre.id,
            motivo: "DATOS_PERSONALES",
            habeasData: { tipo: "RECTIFICACION", sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId: hijo.id }, clasesSolicitadas: ["RELATO_CITA"] },
        });
        const pqr = await prisma.peticionServicio.findUnique({ where: { id: numeroSeguimiento }, include: { solicitudHabeasData: true } });
        expect(pqr?.solicitudHabeasData?.calidad).toBe("REPRESENTANTE_LEGAL");
        expect(pqr?.solicitudHabeasData?.sujetoDelDato).toBe(hijo.id);
    });

    it("pedir sobre el hijo de OTRO padre se RECHAZA y no deja constancia", async () => {
        const padre = await nuevoPadre();
        const otro = await nuevoPadre();
        const hijoAjeno = await nuevoHijo(otro.id, "Beto");
        await expect(
            crearPeticionServicio({
                usuarioId: padre.id,
                motivo: "DATOS_PERSONALES",
                habeasData: { tipo: "SUPRESION", sujeto: { calidad: "REPRESENTANTE_LEGAL", hijoId: hijoAjeno.id }, clasesSolicitadas: ["RELATO_CITA"] },
            }),
        ).rejects.toThrow(/no encontramos ese hijo/i);
        expect(await prisma.solicitudHabeasData.count(), "un rechazo NO deja constancia").toBe(0);
        expect(await prisma.peticionServicio.count()).toBe(0);
    });

    it("un motivo NO-legal crea SOLO la PQR (cero filas en el registro legal)", async () => {
        const padre = await nuevoPadre();
        const { numeroSeguimiento } = await crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA" });
        const pqr = await prisma.peticionServicio.findUnique({ where: { id: numeroSeguimiento } });
        expect(pqr?.motivo).toBe("CITA");
        expect(pqr?.solicitudHabeasDataId, "una cita no es habeas data: sin enlace").toBeNull();
        expect(await prisma.solicitudHabeasData.count(), "cero constancia legal para un motivo no-legal").toBe(0);
    });

    it("contrato 1:1 motivo↔detalle: DATOS_PERSONALES sin detalle, o detalle en otro motivo → rechazo", async () => {
        const padre = await nuevoPadre();
        await expect(crearPeticionServicio({ usuarioId: padre.id, motivo: "DATOS_PERSONALES" })).rejects.toThrow(/detalle de la solicitud de datos/i);
        await expect(
            crearPeticionServicio({ usuarioId: padre.id, motivo: "CITA", habeasData: { tipo: "CONSULTA", sujeto: { calidad: "TITULAR_CUENTA" }, clasesSolicitadas: [] } }),
        ).rejects.toThrow(/no aplica/i);
        expect(await prisma.peticionServicio.count(), "ningún rechazo creó filas").toBe(0);
    });
});

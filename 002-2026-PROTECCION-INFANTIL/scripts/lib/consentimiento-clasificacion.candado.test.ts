/**
 * SPEC-748a · CANDADO del auditor de consentimientos: «firma sospechosa»
 * DERIVA de la fuente única `esTitularDelDato` — nunca de una lista a mano.
 *
 * Contexto: la lista a mano vieja driftó en LAS DOS direcciones (incluía a
 * SCHOOL_ADMIN —titular desde SPEC-416— y omitía a PROFESIONAL/VERIFICADOR),
 * reportando 50 firmas legítimas de colegios como «internas» (prod 2026-09-29).
 *
 * Control positivo en las DOS direcciones (SCHOOL_ADMIN no → OPERADOR sí) +
 * meta-aserción sobre TODO el enum: si alguien reintroduce una lista a mano que
 * diverja de `esTitularDelDato`, el candado se pone rojo. Puro, sin BD.
 */
import { describe, it, expect } from "vitest";
import { RolUsuario } from "@prisma/client";
import { esTitularDelDato } from "@/lib/routing/roles-titulares";
import {
    clasificarFirmas,
    esFirmaSospechosa,
} from "./consentimiento-clasificacion";

const firma = (rol: string) => ({ usuario: { rol } });

describe("SPEC-748a · clasificación de firmas deriva de esTitularDelDato", () => {
    it("SCHOOL_ADMIN NO se reporta (titular), OPERADOR SÍ (interno) — las dos direcciones", () => {
        const r = clasificarFirmas([firma("SCHOOL_ADMIN"), firma("OPERADOR")]);
        expect(r.deTitulares).toBe(1);
        expect(r.deRolesInternos).toBe(1);
        expect(r.detallesPorRol).toEqual([{ rol: "OPERADOR", firmas: 1 }]);
        expect(esFirmaSospechosa("SCHOOL_ADMIN")).toBe(false);
        expect(esFirmaSospechosa("OPERADOR")).toBe(true);
    });

    it("PROFESIONAL y VERIFICADOR SÍ se reportan (los que la lista vieja omitía); PARENT no", () => {
        expect(esFirmaSospechosa("PROFESIONAL")).toBe(true);
        expect(esFirmaSospechosa("VERIFICADOR")).toBe(true);
        expect(esFirmaSospechosa("PARENT")).toBe(false);
    });

    it("meta-aserción sobre TODO el enum: sospechosa === !esTitularDelDato (no una lista a mano)", () => {
        for (const rol of Object.values(RolUsuario)) {
            expect(esFirmaSospechosa(rol), `rol ${rol}`).toBe(!esTitularDelDato(rol));
        }
    });

    it("los titulares del dato son EXACTAMENTE PARENT y SCHOOL_ADMIN (control positivo sobre el enum)", () => {
        const titulares = Object.values(RolUsuario)
            .filter((r) => !esFirmaSospechosa(r))
            .sort();
        expect(titulares).toEqual(["PARENT", "SCHOOL_ADMIN"]);
    });

    it("partición TOTAL: deTitulares + deRolesInternos === total (ninguna firma se cae del recuento)", () => {
        const todas = Object.values(RolUsuario).flatMap((rol) => [firma(rol), firma(rol)]);
        const r = clasificarFirmas(todas);
        expect(r.deTitulares + r.deRolesInternos).toBe(todas.length);
    });

    it("el desglose cuenta múltiples firmas del mismo rol interno y ordena por rol", () => {
        const r = clasificarFirmas([firma("OPERADOR"), firma("OPERADOR"), firma("ADMIN")]);
        expect(r.deRolesInternos).toBe(3);
        expect(r.deTitulares).toBe(0);
        expect(r.detallesPorRol).toEqual([
            { rol: "ADMIN", firmas: 1 },
            { rol: "OPERADOR", firmas: 2 },
        ]);
    });

    it("lista vacía → todo en cero", () => {
        expect(clasificarFirmas([])).toEqual({
            deTitulares: 0,
            deRolesInternos: 0,
            detallesPorRol: [],
            marcadasComoInvalidas: 0,
        });
    });
});

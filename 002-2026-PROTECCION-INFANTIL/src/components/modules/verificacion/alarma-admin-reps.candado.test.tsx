/**
 * CANDADO · SPEC-813 §5-bis — la ALARMA de admin para los estados REPS 5/7/8, en UNA superficie
 * (`verificacion-profesionales`) con DOS zonas por tipo de trabajo:
 *  · «Revisar» (5 NO_ENCONTRADA prominente + conteo · 8 sin fecha) — hay algo MAL en el registro;
 *  · «Re-verificar» (7) — rutina NUESTRA, callada.
 * El punto (tu preocupación): el 5 grave NO comparte forma con el 7 rutinario, para que el goteo del 7 no
 * lo sepulte. Y ninguno culpa al profesional (el 7 dice «la acción es nuestra», no «renueve usted»).
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import { CargaVerificacionRepsClient } from "./CargaVerificacionRepsClient";
import type { RepsCargaItem } from "@/lib/dal/repositories/perfil-profesional";

afterEach(() => cleanup());

const AHORA = Date.now();
const DIA = 24 * 60 * 60 * 1000;

function item(over: Partial<RepsCargaItem>): RepsCargaItem {
    return {
        id: "p",
        nombreVisible: "Profesional",
        tituloProfesional: "Psicología",
        estadoReps: "VIGENTE",
        vigenteHasta: null,
        modalidades: [],
        verificadoEn: new Date(AHORA - 10 * DIA).toISOString(),
        avisoReps: "AL_DIA",
        zonaAdmin: null,
        ...over,
    };
}

// Estado 5 (NO_ENCONTRADA) → zona Revisar. Estado 7 (re-chequeo viejo) → zona Re-verificar. Estado 8 → Revisar.
const E5 = item({ id: "e5", nombreVisible: "Ana NoEncontrada", estadoReps: "NO_ENCONTRADA", avisoReps: "REVISION_ADMIN", zonaAdmin: "REVISAR" });
const E7 = item({
    id: "e7", nombreVisible: "Beto ReChequeo", estadoReps: "VIGENTE",
    vigenteHasta: new Date(AHORA + 200 * DIA).toISOString(), verificadoEn: new Date(AHORA - 400 * DIA).toISOString(),
    avisoReps: "REVISION_ADMIN", zonaAdmin: "RE_VERIFICAR",
});
const E8 = item({ id: "e8", nombreVisible: "Cami SinFecha", estadoReps: "VIGENTE", vigenteHasta: null, avisoReps: "REVISION_ADMIN", zonaAdmin: "REVISAR" });

describe("SPEC-813 §5-bis · alarma de admin (verificacion-profesionales)", () => {
    it("5 y 8 caen en «Revisar»; 7 cae en «Re-verificar» — ZONAS DISTINTAS (el 5 no queda sepultado)", () => {
        render(<CargaVerificacionRepsClient profesionalesIniciales={[E5, E7, E8]} />);
        const revisar = screen.getByRole("region", { name: "Revisar" });
        const reVerificar = screen.getByRole("region", { name: "Re-verificar" });
        // El 5 grave y el 8 están en Revisar; NO en Re-verificar.
        expect(within(revisar).getByText(/Ana NoEncontrada/)).toBeTruthy();
        expect(within(revisar).getByText(/Cami SinFecha/)).toBeTruthy();
        expect(within(reVerificar).queryByText(/Ana NoEncontrada/)).toBeNull();
        // El 7 está en Re-verificar; NO en Revisar.
        expect(within(reVerificar).getByText(/Beto ReChequeo/)).toBeTruthy();
        expect(within(revisar).queryByText(/Beto ReChequeo/)).toBeNull();
    });

    it("«Revisar» lleva conteo y el 5 dice «no aparece», nunca «renovar/renueve» (no culpa al profesional)", () => {
        render(<CargaVerificacionRepsClient profesionalesIniciales={[E5]} />);
        const revisar = screen.getByRole("region", { name: "Revisar" });
        expect(within(revisar).getByText(/\(1\)/)).toBeTruthy(); // conteo propio
        const t = (revisar.textContent ?? "").toLowerCase();
        expect(t).toContain("no aparece");
        expect(t, "el 5 se exculpa: no es trámite vencido del profesional").toContain("no es un trámite vencido del profesional");
        // Que no lo CULPE: nada de imperativo «renueve/renuévela» dirigido al profesional (el infinitivo
        // «renovar» SÍ aparece, pero negado — «no se le pide renovar» — y eso es correcto).
        expect(t, "al 5 no se le INSTRUYE renovar").not.toMatch(/renu[eé]v/);
    });

    it("«Re-verificar» dice «la acción es nuestra», nunca «renueve usted» (es NUESTRA desactualización)", () => {
        render(<CargaVerificacionRepsClient profesionalesIniciales={[E7]} />);
        const reVerificar = screen.getByRole("region", { name: "Re-verificar" });
        const t = (reVerificar.textContent ?? "").toLowerCase();
        expect(t).toContain("la acción es nuestra");
        expect(t, "no se le pide al profesional «renueve usted»").not.toMatch(/renueve usted|usted.*renov/);
    });

    it("jerarquía: muchos 7 + un 5 → el 5 SIGUE en su zona prominente (el goteo del 7 no lo sepulta)", () => {
        const muchos7 = Array.from({ length: 12 }, (_, i) => ({ ...E7, id: `e7-${i}`, nombreVisible: `ReChequeo ${i}` }));
        render(<CargaVerificacionRepsClient profesionalesIniciales={[...muchos7, E5]} />);
        const revisar = screen.getByRole("region", { name: "Revisar" });
        // El 5 está en «Revisar», separado del goteo de 7 (que está en «Re-verificar»).
        expect(within(revisar).getByText(/Ana NoEncontrada/)).toBeTruthy();
        expect(within(revisar).queryByText(/ReChequeo 0/)).toBeNull();
    });
});

/**
 * CANDADO · SPEC-691 + SPEC-706 · El encabezado de estado muestra la copy correcta por
 * estado, y NUNCA rubí en un estado de cuenta (D-120: el rojo es criticidad de un menor).
 *
 * SPEC-706: este componente dejó de ser pantalla propia («Mi estado» / `/perfil-profesional/
 * verificacion` se retiró) y se REUBICA como ENCABEZADO de la ficha. Es DISPLAY-ONLY: el envío
 * a revisión se movió a la ficha (un solo camino, el PUT del perfil que valida y nombra lo que
 * falta). NINGÚN estado —VENCIDO incluido— pinta ya un botón de enviar/reenviar acá.
 *
 * FORMA-SPEC691 (Diseño): VENCIDO/RECHAZADO en ámbar (piden su acción), SUSPENDIDO en
 * tinta neutra (no hay acción suya). Ajustes del CEO: SUSPENDIDO es solo lectura, con el
 * canal de contacto real; RECHAZADO no se produce (defensivo).
 *
 * Conducta con dato real: se renderiza el componente por estado y se afirma el título,
 * la insignia y —lo que no se puede fingir— que la insignia de un estado de cuenta no
 * lleva la clase de rubí, y que el encabezado no ofrece ninguna acción de envío.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EstadoVerificacionProfesionalClient } from "./EstadoVerificacionProfesionalClient";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

afterEach(() => cleanup());

type Estado = "BORRADOR" | "EN_REVISION" | "ACTIVO" | "RECHAZADO" | "VENCIDO" | "SUSPENDIDO";
function montar(estadoPerfil: Estado, puedeReenviar = false, habilitado = false) {
    render(
        <EstadoVerificacionProfesionalClient
            vista={{ estadoPerfil, puedeReenviar, observaciones: [] }}
            habilitado={habilitado}
        />,
    );
}

describe("SPEC-691 · «Mi estado»: la pantalla por estado (nunca rubí en estado de cuenta)", () => {
    it("VENCIDO: título propio, insignia «Vencida» ÁMBAR (no rubí) y SIN CTA (display-only, SPEC-706)", () => {
        montar("VENCIDO", true);
        expect(screen.getByText("Su verificación venció.")).toBeTruthy();
        const insignia = screen.getByText("Vencida");
        expect(insignia.className).toContain("text-estado-ambar");
        expect(insignia.className, "un estado de cuenta NUNCA va en rubí (D-120)").not.toContain("text-estado-rubi");
        // SPEC-706: el envío se movió a la ficha; el encabezado no pinta botón, ni aun con puedeReenviar.
        expect(screen.queryByRole("button", { name: /Enviar a revisión|Reenviar/ })).toBeNull();
        // Sí dice, en texto, que la salida es reenviar (por la ficha, debajo).
        expect(screen.getByText(/envíela de nuevo a revisión/)).toBeTruthy();
    });

    it("SUSPENDIDO: título propio, insignia NEUTRA (ni rubí ni ámbar), SOLO LECTURA y contacto real", () => {
        montar("SUSPENDIDO", false);
        expect(screen.getByText("Su perfil profesional está suspendido")).toBeTruthy();
        const insignia = screen.getByText("Suspendida");
        expect(insignia.className).not.toContain("text-estado-rubi");
        expect(insignia.className, "SUSPENDIDO no ofrece acción → no ámbar de «acción»").not.toContain("text-estado-ambar");
        // Solo lectura: no hay botón de reenviar.
        expect(screen.queryByRole("button", { name: /Enviar a revisión|Reenviar/ })).toBeNull();
        // El único canal real (mockup): contacto por correo.
        expect(screen.getByText("gerencia@innovadataco.com")).toBeTruthy();
    });

    it("RECHAZADO (defensivo): insignia no-rubí y SIN reenviar (el ciclo no rechaza)", () => {
        montar("RECHAZADO", false);
        const insignia = screen.getByText("No aprobada");
        expect(insignia.className).not.toContain("text-estado-rubi");
        expect(screen.queryByRole("button", { name: /Enviar a revisión|Reenviar/ })).toBeNull();
    });

    it("EN_REVISION: sin CTA de reenviar (está en manos del Verificador)", () => {
        montar("EN_REVISION", false);
        expect(screen.getByText("En revisión")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Enviar a revisión|Reenviar/ })).toBeNull();
    });

    it("WORKER-LAG (ajuste del CEO): ACTIVO con habilitado=false se MUESTRA como VENCIDO", () => {
        montar("ACTIVO", false, /* habilitado */ false);
        // No dice «activo» a quien no puede operar: muestra la pantalla de VENCIDO.
        expect(screen.getByText("Su verificación venció.")).toBeTruthy();
        expect(screen.queryByText("Su perfil está activo")).toBeNull();
        expect(screen.getByText("Vencida").className).toContain("text-estado-ambar");
    });

    it("ACTIVO habilitado → sí muestra «activo» (no se fuerza VENCIDO)", () => {
        montar("ACTIVO", false, /* habilitado */ true);
        expect(screen.getByText("Su perfil está activo")).toBeTruthy();
        expect(screen.queryByText("Su verificación venció.")).toBeNull();
    });

    it("CONTROL POSITIVO: cambiar solo el estado cambia el título de la pantalla", () => {
        montar("VENCIDO", false);
        const vencido = screen.getByText("Su verificación venció.");
        expect(vencido).toBeTruthy();
        cleanup();
        montar("SUSPENDIDO", false);
        expect(screen.queryByText("Su verificación venció.")).toBeNull();
        expect(screen.getByText("Su perfil profesional está suspendido")).toBeTruthy();
    });

    // SPEC-706 · DISPLAY-ONLY: el encabezado NO pinta ninguna acción de envío en NINGÚN estado,
    // ni siquiera con `puedeReenviar=true` (el peor caso: antes VENCIDO+puedeReenviar mostraba el
    // botón). El único camino de envío es la ficha (PUT del perfil). Si alguien re-cablea un botón
    // acá, vuelven a existir DOS caminos de envío con reglas distintas — este candado lo caza.
    it("DISPLAY-ONLY (SPEC-706): ningún estado pinta botón de enviar/reenviar, ni con puedeReenviar=true", () => {
        for (const estado of ["BORRADOR", "EN_REVISION", "ACTIVO", "RECHAZADO", "VENCIDO", "SUSPENDIDO"] as const) {
            montar(estado, /* puedeReenviar */ true, /* habilitado */ false);
            expect(
                screen.queryByRole("button"),
                `«${estado}» pinta un botón en el encabezado display-only`,
            ).toBeNull();
            cleanup();
        }
    });
});

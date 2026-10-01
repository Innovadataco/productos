/**
 * CANDADO · SPEC-790 (T6 · FORMA-SPEC790 v1.2) · la pantalla de carga manual REPS CUMPLE la forma por
 * CONDUCTA (render real), no por copy suelto. Control positivo por MUTACIÓN en cada eje:
 *
 *  §1 · CUATRO resultados distinguibles: los cuatro aparecen y «Vencida» («encontré… vencida») se lee
 *       DISTINTO de «No encontrada» («no aparece») — no son dos rótulos iguales.
 *  §2 · IMPOSIBLE «Vigente» sin fecha: elegir Vigente abre el campo fecha y deja Guardar DESHABILITADO;
 *       elegir otro resultado NO muestra fecha y habilita Guardar. (La UI nunca arma la combinación que la
 *       base rechaza.)
 *  §3 · Modalidades: con Vigente + fecha pero CERO modalidades → Guardar deshabilitado; marcar ≥1 lo
 *       habilita; desmarcar vuelve a deshabilitar (mutación en las dos direcciones).
 *  §4 · Lo que NO hace, visible: las tres frases; NUNCA «verificado por el sistema» ni promesa de
 *       automatización («se actualizará solo», «sincroniza», «automática»).
 *  §5 · Vacío de primera clase: cero verificaciones → mensaje con acción; con una verificación cargada el
 *       mensaje NO aparece (control negativo).
 *  D-120 · cero rubí (escaneo de la fuente): el rojo se reserva a la criticidad de protección del menor.
 *
 * Unit (jsdom). La guardia de ACCESO es del servidor (su propio test de ruta); acá se prueba la FORMA.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CargaVerificacionRepsClient } from "./CargaVerificacionRepsClient";
import type { RepsCargaItem } from "@/lib/dal/repositories/perfil-profesional";

afterEach(() => cleanup());

function item(over: Partial<RepsCargaItem> = {}): RepsCargaItem {
    return {
        id: "p1",
        nombreVisible: "Dra. Prueba",
        tituloProfesional: "Psicología",
        estadoReps: "SIN_VERIFICAR",
        vigenteHasta: null,
        modalidades: [],
        verificadoEn: null,
        ...over,
    };
}

function abrirModal() {
    fireEvent.click(screen.getAllByRole("button", { name: /Cargar verificación/i })[0]);
}
const guardar = () => screen.getByRole("button", { name: /Guardar verificación/i }) as HTMLButtonElement;
const elegir = (dice: RegExp) => fireEvent.click(screen.getByRole("radio", { name: dice }));
const fechaInput = () => screen.getByLabelText(/Vigente hasta/i);

describe("SPEC-790 (T6) · FORMA de la carga manual REPS", () => {
    it("§1 · los CUATRO resultados aparecen y «Vencida» se lee distinto de «No encontrada»", () => {
        render(<CargaVerificacionRepsClient profesionalesIniciales={[item()]} />);
        abrirModal();
        expect(screen.getByRole("radio", { name: /está vigente/i })).toBeTruthy();
        expect(screen.getByRole("radio", { name: /está vencida/i })).toBeTruthy();
        const noEncontrada = screen.getByRole("radio", { name: /no aparece en la fuente/i });
        const sinVerificar = screen.getByRole("radio", { name: /Todavía no la verifiqué/i });
        expect(noEncontrada).toBeTruthy();
        expect(sinVerificar).toBeTruthy();
        // La distinción crítica: «vencida» (la encontré) ≠ «no aparece» (no existe) — distintos textos.
        expect((noEncontrada as HTMLInputElement).getAttribute("value")).toBe("NO_ENCONTRADA");
        expect(screen.queryByRole("radio", { name: /está vencida/i })).not.toBe(noEncontrada);
    });

    it("§2 · «Vigente» abre fecha y deja Guardar deshabilitado; otro resultado no muestra fecha y lo habilita", () => {
        render(<CargaVerificacionRepsClient profesionalesIniciales={[item()]} />);
        abrirModal();
        expect(guardar().disabled).toBe(true); // sin resultado elegido
        // Vencida: no pide fecha, habilita.
        elegir(/está vencida/i);
        expect(screen.queryByLabelText(/Vigente hasta/i)).toBeNull();
        expect(guardar().disabled).toBe(false);
        // Vigente: aparece la fecha y, sin ponerla, Guardar vuelve a deshabilitarse (nunca «vigente sin fecha»).
        elegir(/está vigente/i);
        expect(fechaInput()).toBeTruthy();
        expect(guardar().disabled).toBe(true);
    });

    it("§3 · con Vigente: cero modalidades → deshabilitado; ≥1 → habilitado; desmarcar → deshabilitado", () => {
        render(<CargaVerificacionRepsClient profesionalesIniciales={[item()]} />);
        abrirModal();
        elegir(/está vigente/i);
        fireEvent.change(fechaInput(), { target: { value: "2027-01-01" } });
        expect(guardar().disabled).toBe(true); // fecha sí, modalidades no
        const virtual = screen.getByRole("checkbox", { name: /Virtual/i });
        fireEvent.click(virtual);
        expect(guardar().disabled).toBe(false); // fecha + 1 modalidad
        fireEvent.click(virtual); // desmarcar
        expect(guardar().disabled).toBe(true);
    });

    it("§4 · dice lo que NO hace; nunca «verificado por el sistema» ni promesa de automatización", () => {
        const { container } = render(<CargaVerificacionRepsClient profesionalesIniciales={[item()]} />);
        abrirModal();
        expect(screen.getByText(/no le envía aviso al profesional/i)).toBeTruthy();
        expect(screen.getByText(/no comprueba la habilitación/i)).toBeTruthy();
        expect(screen.getByText(/una corrección es una carga nueva/i)).toBeTruthy();
        const txt = (container.textContent ?? "").toLowerCase();
        // document.body porque el Modal va por portal.
        const all = (document.body.textContent ?? "").toLowerCase();
        for (const prohibida of ["verificado por el sistema", "se actualizará solo", "sincroniza", "automática", "automático"]) {
            expect(all, `no debe prometer «${prohibida}»`).not.toContain(prohibida);
        }
        expect(txt.length).toBeGreaterThan(0);
    });

    it("§5 · vacío de primera clase: cero verificaciones → mensaje con acción; con una cargada → NO aparece", () => {
        // Todos SIN_VERIFICAR (verificadoEn null) → el mensaje de entrada aparece.
        render(<CargaVerificacionRepsClient profesionalesIniciales={[item(), item({ id: "p2", nombreVisible: "Dr. Dos" })]} />);
        expect(screen.getByText(/Todavía no hay verificaciones de habilitación cargadas/i)).toBeTruthy();
        // v1.3 · el efecto se enmarca como la OFERTA, no como «habilitado» (falso amigo, §7).
        expect(screen.getByText(/aparecer en la oferta a las familias/i)).toBeTruthy();
        expect(screen.getAllByText(/Sin verificar/i).length).toBeGreaterThan(0);
        // Control negativo (monta DE NUEVO: `useState` no re-lee props en rerender): con una verificación
        // cargada, el mensaje de vacío desaparece.
        cleanup();
        render(
            <CargaVerificacionRepsClient
                profesionalesIniciales={[item({ estadoReps: "VIGENTE", vigenteHasta: new Date().toISOString(), modalidades: ["PRESENCIAL"], verificadoEn: new Date().toISOString() })]}
            />,
        );
        expect(screen.queryByText(/Todavía no hay verificaciones de habilitación cargadas/i)).toBeNull();
    });

    it("v1.3 · FALSO AMIGO: la copy de la pantalla mueve la OFERTA, nunca «habilita» por la carga (candado del radicado 790)", () => {
        // El radicado de 790 exige que `habilitado` (onboarding interno) y el REPS NO se confundan: ningún
        // camino donde uno se lea como el otro. Esta es la pantalla más visible del mecanismo. La carga de
        // REPS mueve la OFERTA / el directorio; NUNCA «habilita». «habilitación» (el nombre del REPS) es
        // admisible; «habilitado/a» (el efecto de onboarding) NO puede aparecer como resultado de la carga.
        render(<CargaVerificacionRepsClient profesionalesIniciales={[item()]} />);
        expect(screen.getByText(/aparecer en la oferta a las familias/i)).toBeTruthy();
        abrirModal();
        elegir(/está vigente/i); // surface §2/§3 (donde vivía el rótulo de modalidades)
        const visible = document.body.textContent ?? "";
        expect(visible, "la carga no «habilita»: nada de «habilitado(s)/habilitada(s)» en la copy").not.toMatch(/habilitad[oa]s?/i);
    });

    it("D-120 · cero rubí en la superficie (el rojo se reserva a la criticidad de protección del menor)", () => {
        const fuente = readFileSync(path.resolve(__dirname, "CargaVerificacionRepsClient.tsx"), "utf8");
        expect(fuente, "la carga REPS es un estado de CUENTA, no criticidad de menor: sin rubí").not.toMatch(/\brubi\b/);
    });
});

/**
 * CANDADO · SPEC-771 (render, DOS superficies) — con franjas de BORDE plantadas (5am y 9pm), la
 * rejilla las muestra DENTRO del área visible en las tres superficies que comparten
 * `RejillaCalendario`: padre (mis citas), padre (elegir franja) y profesional (agenda/publica).
 *
 * Afirma DENTRO del área visible (`0 ≤ top` y `top+height ≤ altura`), NO «existe en el DOM» — hoy
 * el defecto es justo eso: la cita está en el DOM con `top` negativo y no se ve. La aserción es
 * MUTACIÓN-sensible: con el riel fijo (`H0`) la de 5am vuelve a `top` negativo → ROJO.
 *
 * SPEC-773 normalizó los sembradores: las franjas de borde ya no existen en la base → se PLANTAN
 * acá como props (sin BD). Cubre las dos superficies porque es el MISMO componente: mirar solo la
 * del padre daría cobertura falsa (el profesional tampoco ve sus franjas fuera de ventana).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { diaBogota, instanteDesdeHoraBogota } from "@/lib/fechas/formato-bogota";
import type { CitaParaPadreDto } from "@/lib/profesional/cita/dto";
import type { CalendarioProfesionalDto, BloqueCalendario } from "@/lib/profesional/calendario/calendario.service";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { RejillaMisCitas } from "./RejillaMisCitas";
import { RejillaElegirFranja, type FranjaLibre } from "./RejillaElegirFranja";
import { CalendarioProfesional } from "@/components/modules/profesional/CalendarioProfesional";

const HOY = diaBogota();
const iso = (hhmm: string) => instanteDesdeHoraBogota(HOY, hhmm).toISOString();
// Bordes: una franja/cita a las 5am y otra a las 9pm — fuera del viejo riel fijo 7am–9pm.
const BORDES: Array<[string, string]> = [["05:00", "05:45"], ["21:00", "21:45"]];

afterEach(() => cleanup());

/** Para cada bloque renderizado: cae DENTRO del área visible del riel (no arriba, no debajo). */
function afirmarTodosDentro(container: HTMLElement, selectorBloque: string) {
    const col = container.querySelector<HTMLElement>("[data-col]");
    expect(col, "no se encontró la columna del riel").not.toBeNull();
    const altura = parseFloat(col!.style.height);
    expect(altura).toBeGreaterThan(0);
    const bloques = container.querySelectorAll<HTMLElement>(selectorBloque);
    expect(bloques.length, "no se renderizó ningún bloque de borde").toBeGreaterThan(0);
    for (const b of bloques) {
        const top = parseFloat(b.style.top);
        const height = parseFloat(b.style.height);
        expect(top, "bloque ARRIBA del área visible (top<0): el riel lo esconde").toBeGreaterThanOrEqual(0);
        expect(top + height, "bloque DEBAJO del área visible").toBeLessThanOrEqual(altura + 0.5);
    }
}

function citaBorde(id: string, [hi, hf]: [string, string]): CitaParaPadreDto {
    return {
        id,
        estado: "CONFIRMADA",
        urgencia: "SIN_APURO",
        creadoEn: iso("00:00"),
        venceEn: iso("23:59"),
        pagoAprobadoEn: iso("00:00"),
        montoTotal: 80_000,
        profesional: { id: "p1", nombreVisible: "Dra. Borde", tituloProfesional: "Psicología", ciudad: { id: "co", nombre: "Bogotá" } },
        franja: { inicio: iso(hi), fin: iso(hf), modalidad: "VIRTUAL" },
        solicitudPreviaId: null,
        pagoHeredadoDeId: null,
        expedienteCompartidoId: null,
    };
}

function franjaBorde(id: string, [hi, hf]: [string, string]): FranjaLibre {
    return { id, inicio: iso(hi), fin: iso(hf), modalidad: "VIRTUAL" };
}

function bloqueProf(id: string, [hi, hf]: [string, string]): BloqueCalendario {
    const [h0, m0] = hi.split(":").map(Number);
    const [h1, m1] = hf.split(":").map(Number);
    return { id, fecha: HOY, minInicio: h0 * 60 + m0, minFin: h1 * 60 + m1, inicioISO: iso(hi), finISO: iso(hf), modalidad: "VIRTUAL", estado: "libre" };
}

describe("SPEC-771 · las franjas de borde caen dentro del área visible (render, 2 superficies)", () => {
    it("PADRE · mis citas: una cita de 5am y otra de 9pm se ven (no top negativo, no debajo)", () => {
        const { container } = render(<RejillaMisCitas citas={BORDES.map((b, i) => citaBorde(`c${i}`, b))} />);
        afirmarTodosDentro(container, 'a[href^="/dashboard/padre/citas/"]');
    });

    it("PADRE · elegir franja: una franja publicada de 5am y otra de 9pm se pueden ELEGIR (se ven)", () => {
        const { container } = render(
            <RejillaElegirFranja franjas={BORDES.map((b, i) => franjaBorde(`f${i}`, b))} franjaSelId={null} onSeleccionar={() => {}} />,
        );
        afirmarTodosDentro(container, "[data-col] button[aria-pressed]");
    });

    it("PROFESIONAL · agenda: sus propias franjas de 5am y 9pm se ven (por eso el defecto sobrevivía)", () => {
        const datos: CalendarioProfesionalDto = {
            hoy: HOY,
            bloques: BORDES.map((b, i) => bloqueProf(`b${i}`, b)),
            venceEn: null,
            muro: null,
            diasBloqueados: [],
            atiendeVirtual: true,
            atiendePresencial: false,
            duracionMinutos: 45,
        };
        const { container } = render(<CalendarioProfesional datos={datos} />);
        afirmarTodosDentro(container, "[data-franja]");
    });
});

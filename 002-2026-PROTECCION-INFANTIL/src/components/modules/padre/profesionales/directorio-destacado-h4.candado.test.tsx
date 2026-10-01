/**
 * SPEC-830 · CANDADO H-4 EXTENDIDO (no reescrito: conserva lo viejo y suma).
 *
 * El candado H-4 vigilaba el ORDEN del directorio («da turno a todos» — aleatorio, nadie enterrado). SPEC-830
 * agrega un tratamiento «destacado» a la tarjeta reservable, un mecanismo NUEVO que ese candado no cubría. Se
 * EXTIENDE enumerando (FORMA §6, aprobado por el CEO):
 *
 *  1. [viejo · CONSERVADO] el orden sigue siendo el del servidor — el realce NO reordena ni flota a nadie al
 *     frente. La prueba a nivel de FUNCIÓN (baraja determinística, mismo conjunto de ids) vive —intacta— en
 *     `directorio-shuffle.test.ts`; acá se re-afirma a nivel de RENDER (el cliente no re-ordena por horarios).
 *  2. [nuevo] el DESTACADO deriva ÚNICA Y EXCLUSIVAMENTE de `tieneHorariosDisponibles` — nunca calificación,
 *     antigüedad ni pago. Control positivo: un profesional imponente (mucha experiencia, tarifa alta) pero SIN
 *     horarios NO se destaca; uno sin ningún mérito pero CON horarios SÍ. (Impide que el realce se vuelva un
 *     ranking por la puerta de atrás — la invariante que de verdad importa.)
 *  3. [nuevo] no-destacado ≠ deficiente: la tarjeta sin horarios no se atenúa ni degrada (sin `opacity`/grayscale);
 *     es idéntica a la destacada salvo el anillo de realce. Es la MAYORÍA, no es «peor».
 *  4. [consistencia] el {N} del encabezado == la cantidad de tarjetas destacadas (misma fuente
 *     `tieneHorariosDisponibles`); si el campo volviera a sobrecontar, esta afirmación lo caza en la PANTALLA.
 *
 * No usa BD: mockea el endpoint del directorio (cae en el shard de integración por el glob src/**).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DirectorioProfesionales } from "./DirectorioProfesionales";
import type { PerfilPublicoDTO } from "@/lib/dal/repositories/perfil-profesional";

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

/** DTO público con valores por defecto; `over` fija lo que importa a cada caso. */
function dto(over: Partial<PerfilPublicoDTO> & { id: string; nombreVisible: string }): PerfilPublicoDTO {
    return {
        fotoUrl: null,
        tituloProfesional: "Psicología",
        especialidades: ["infantil"],
        rangoEtario: ["Niñez (6–11)"],
        ciudadId: "c1",
        atiendeVirtual: true,
        atiendePresencial: false,
        aniosExperiencia: 3,
        presentacion: "Perfil de prueba.",
        tarifaConsultaCOP: 120000,
        duracionMinutos: 45,
        emiteFactura: false,
        ciudad: { id: "c1", nombre: "Bogotá", pais: "Colombia" },
        tieneHorariosDisponibles: false,
        ...over,
    };
}

/** Sirve la lista dada (orden del servidor) como la respondería el API; hay inventario (lista poblada). */
function mockLista(items: PerfilPublicoDTO[]) {
    fetchMock.mockImplementation((url: string) => {
        if (String(url).includes("/facetas")) return jsonRes({ ciudades: [], especialidades: [] });
        if (String(url).includes("/api/padre/profesionales")) return jsonRes({ items, hayVerificados: true });
        return jsonRes({});
    });
}

function pintar() {
    return render(<DirectorioProfesionales hrefPerfil="/dashboard/padre/profesionales" precioPrimeraCitaCOP={80000} />);
}

/** Las tarjetas en el orden del DOM (cada una es el `<a>` con el aria-label del perfil). */
function tarjetasDOM(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll('a[aria-label^="Ver perfil de"]'));
}
const nombreDe = (a: HTMLElement) => a.getAttribute("aria-label")!.replace("Ver perfil de ", "");
/** textContent normalizado — el {N} vive dentro de un <b>, así que la frase cruza nodos de texto. */
const textoNorm = (el: HTMLElement) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

describe("SPEC-830 · H-4 extendido · el realce destaca la minoría reservable sin volverse ranking", () => {
    it("(2+3+4) destaca SOLO por horarios (no por mérito) · no atenúa a nadie · {N}==destacados", async () => {
        // Orden del servidor: imponente-sin-horarios, humilde-con-horarios, otro-sin-horarios.
        const ana = dto({ id: "a", nombreVisible: "Ana", aniosExperiencia: 25, tarifaConsultaCOP: 900000, tieneHorariosDisponibles: false });
        const bruno = dto({ id: "b", nombreVisible: "Bruno", aniosExperiencia: 1, tarifaConsultaCOP: null, tieneHorariosDisponibles: true });
        const carla = dto({ id: "c", nombreVisible: "Carla", aniosExperiencia: 12, tieneHorariosDisponibles: false });
        mockLista([ana, bruno, carla]);
        const { container } = pintar();

        await screen.findByText(/con horarios para agendar/i);
        const tarjetas = tarjetasDOM(container);
        expect(tarjetas).toHaveLength(3);

        // (2) destacado ⟺ tieneHorariosDisponibles, INDEPENDIENTE de experiencia/tarifa.
        const destacadoPorNombre = Object.fromEntries(tarjetas.map((a) => [nombreDe(a), a.getAttribute("data-destacado")]));
        expect(destacadoPorNombre).toEqual({ Ana: "false", Bruno: "true", Carla: "false" });

        const esDestacada = (a: HTMLElement) => a.getAttribute("data-destacado") === "true";
        const destacadas = tarjetas.filter(esDestacada);
        const noDestacadas = tarjetas.filter((a) => !esDestacada(a));

        // (3) el realce es peso AÑADIDO al que sí tiene; las demás NO se atenúan y son idénticas salvo el anillo.
        for (const a of tarjetas) {
            expect(a.className, "ninguna tarjeta se atenúa/degrada").not.toMatch(/opacity-|grayscale|saturate-0/);
            expect(a.className, "todas conservan la base de tarjeta").toContain("glass");
        }
        // El anillo de realce acompaña al booleano (conducta↔visual, no pueden divergir).
        expect(destacadas[0]!.className, "la destacada lleva el realce pino").toMatch(/ring-pino/);
        for (const a of noDestacadas) expect(a.className, "la no-destacada NO lleva realce").not.toMatch(/ring-pino/);

        // (4) el {N} del encabezado == cantidad de destacadas (1 acá). La frase cruza el <b>, se lee normalizada.
        expect(destacadas).toHaveLength(1);
        expect(textoNorm(container), "encabezado nombra 1 (singular)").toMatch(/Ahora mismo hay 1 profesional con horarios para agendar/i);
    });

    it("(1) el realce NO reordena: el orden del DOM es el del servidor, con la reservable en medio", async () => {
        const uno = dto({ id: "1", nombreVisible: "Uno", tieneHorariosDisponibles: false });
        const dos = dto({ id: "2", nombreVisible: "Dos", tieneHorariosDisponibles: true }); // la única con horarios, en medio
        const tres = dto({ id: "3", nombreVisible: "Tres", tieneHorariosDisponibles: false });
        mockLista([uno, dos, tres]);
        const { container } = pintar();

        await screen.findByText(/con horarios para agendar/i);
        // Si el realce flotara a los reservables al frente, Dos saldría primero. Debe quedar en el medio.
        expect(tarjetasDOM(container).map(nombreDe)).toEqual(["Uno", "Dos", "Tres"]);
    });

    it("(4·caso dominante) N=0: lista poblada pero ninguna con horarios → encabezado honesto, 0 destacadas", async () => {
        const items = [
            dto({ id: "x", nombreVisible: "Equis", tieneHorariosDisponibles: false }),
            dto({ id: "y", nombreVisible: "Ye", tieneHorariosDisponibles: false }),
        ];
        mockLista(items);
        const { container } = pintar();

        await screen.findByText(/ningún profesional/i);
        const tarjetas = tarjetasDOM(container);
        expect(tarjetas).toHaveLength(2);
        expect(tarjetas.filter((a) => a.getAttribute("data-destacado") === "true"), "0 destacadas cuando N=0").toHaveLength(0);
        // No promete cuándo, y no humilla a la mayoría sin horarios.
        expect(screen.queryByText(/pronto|vuelve|la próxima semana/i)).toBeNull();
        for (const a of tarjetas) expect(a.className).not.toMatch(/opacity-/);
    });

    it("(4) N≥2 concuerda en plural y cuenta exactamente las destacadas", async () => {
        const items = [
            dto({ id: "p", nombreVisible: "Pe", tieneHorariosDisponibles: true }),
            dto({ id: "q", nombreVisible: "Cu", tieneHorariosDisponibles: false }),
            dto({ id: "r", nombreVisible: "Erre", tieneHorariosDisponibles: true }),
        ];
        mockLista(items);
        const { container } = pintar();

        await screen.findByText(/con horarios para agendar/i);
        expect(textoNorm(container), "encabezado nombra 2 (plural)").toMatch(/Ahora mismo hay 2 profesionales con horarios para agendar/i);
        expect(tarjetasDOM(container).filter((a) => a.getAttribute("data-destacado") === "true")).toHaveLength(2);
    });
});

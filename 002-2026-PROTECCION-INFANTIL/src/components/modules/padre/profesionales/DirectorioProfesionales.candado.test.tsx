/**
 * SPEC-656 (I-387) · CANDADO de render del directorio vacío.
 *
 * El defecto: una sola línea («no coincide con los filtros, cambia la ciudad») para
 * DOS vacíos de causa opuesta — sin inventario (hueco NUESTRO) y filtro que no casa
 * (búsqueda del padre). La conducta que se fija: **la SEÑAL DEL TOTAL (`hayVerificados`)
 * voltea la copy**, no `items.length===0` (cero en los dos). Verificado por mutación:
 * si el cliente eligiera por el conteo filtrado, la rama por-filtro pintaría el
 * estructural (o al revés) y un test cae.
 *
 *  - estructural (hayVerificados=false): canales oficiales + «estamos sumando»;
 *    NUNCA «coincide con los filtros» ni los selects de filtro.
 *  - por-filtro (hayVerificados=true, lista vacía): «coincide con estos filtros» +
 *    «Quitar filtros»; NUNCA la 141 protagonista ni la promesa.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DirectorioProfesionales } from "./DirectorioProfesionales";

const fetchMock = vi.fn();
beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

function jsonRes(body: unknown, ok = true) {
    return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

/** Enruta por URL; `hayVerificados` es la señal del total que parte los dos vacíos. */
function mockDirectorio(hayVerificados: boolean) {
    fetchMock.mockImplementation((url: string) => {
        if (String(url).includes("/facetas")) return jsonRes({ ciudades: [], especialidades: [] });
        if (String(url).includes("/api/padre/profesionales")) return jsonRes({ items: [], hayVerificados });
        return jsonRes({});
    });
}

function pintar() {
    return render(<DirectorioProfesionales hrefPerfil="/dashboard/padre/profesionales" precioPrimeraCitaCOP={80000} />);
}

describe("SPEC-656 · render del directorio vacío (la señal del total voltea la copy)", () => {
    it("SIN inventario (hayVerificados=false) → ESTRUCTURAL: canales oficiales, jamás culpar la búsqueda", async () => {
        mockDirectorio(false);
        pintar();
        // Asume el hueco en 1ª persona + ancla la ayuda que existe hoy.
        expect(await screen.findByText(/Todavía estamos sumando psicólogos/i)).toBeTruthy();
        expect(screen.getByText(/Canales oficiales de denuncia/i)).toBeTruthy();
        // NUNCA la copy que culpa la búsqueda, ni los filtros (un select sobre cero).
        expect(screen.queryByText(/coincide con (los|estos) filtros/i)).toBeNull();
        expect(screen.queryByText(/Quitar filtros/i)).toBeNull();
        expect(screen.queryByText("Todas las ciudades")).toBeNull();
    });

    it("CON inventario pero filtro que no casa (hayVerificados=true) → POR FILTRO: ligero, sin 141 ni promesa", async () => {
        mockDirectorio(true);
        pintar();
        expect(await screen.findByText(/coincide con estos filtros/i)).toBeTruthy();
        expect(screen.getByText(/Quitar filtros/i)).toBeTruthy();
        // NUNCA la pantalla de crisis sobre un simple filtro.
        expect(screen.queryByText(/Canales oficiales de denuncia/i)).toBeNull();
        expect(screen.queryByText(/estamos sumando psicólogos/i)).toBeNull();
    });
});

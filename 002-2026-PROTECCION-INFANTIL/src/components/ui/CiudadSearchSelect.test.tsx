import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CiudadSearchSelect, type CiudadOpcion } from "./CiudadSearchSelect";

const BOGOTA: CiudadOpcion = {
    id: "bog",
    nombre: "Bogotá",
    paisId: "co",
    departamentoId: "dc",
    departamento: "Bogotá D.C.",
};

function mockFetch(ciudades: CiudadOpcion[] = [BOGOTA], ok = true) {
    const fetchMock = vi.fn().mockResolvedValue({
        ok,
        json: async () => ({ ciudades }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

describe("CiudadSearchSelect (SPEC-115)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    function escribir(texto: string) {
        fireEvent.change(screen.getByRole("combobox"), { target: { value: texto } });
        act(() => {
            vi.advanceTimersByTime(400);
        });
        vi.useRealTimers();
        vi.useFakeTimers();
    }

    it("busca en el servidor tras el debounce y muestra resultados", async () => {
        const fetchMock = mockFetch();
        render(<CiudadSearchSelect paisId="co" value={null} onSelect={() => {}} />);
        escribir("bog");
        vi.useRealTimers();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0][0])).toContain("/api/ciudades/buscar?");
        expect(String(fetchMock.mock.calls[0][0])).toContain("q=bog");
        expect(String(fetchMock.mock.calls[0][0])).toContain("paisId=co");
        expect(await screen.findByText("Bogotá")).toBeTruthy();
        expect(screen.getByText(/Bogotá D\.C\./)).toBeTruthy();
    });

    it("no busca con menos de 2 caracteres", () => {
        const fetchMock = mockFetch();
        render(<CiudadSearchSelect paisId="co" value={null} onSelect={() => {}} />);
        escribir("b");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("incluye departamentoId en la consulta cuando existe", async () => {
        const fetchMock = mockFetch();
        render(<CiudadSearchSelect paisId="co" departamentoId="dc" value={null} onSelect={() => {}} />);
        escribir("bog");
        expect(String(fetchMock.mock.calls[0][0])).toContain("departamentoId=dc");
    });

    it("al elegir un resultado notifica onSelect con la opción", async () => {
        mockFetch();
        const onSelect = vi.fn();
        render(<CiudadSearchSelect paisId="co" value={null} onSelect={onSelect} />);
        escribir("bog");
        vi.useRealTimers();
        fireEvent.click(await screen.findByText("Bogotá"));
        expect(onSelect).toHaveBeenCalledWith(BOGOTA);
    });

    it("muestra la atribución GeoNames y la opción «Otra ciudad»", async () => {
        mockFetch();
        render(<CiudadSearchSelect paisId="co" value={null} onSelect={() => {}} permitirOtra />);
        escribir("bog");
        vi.useRealTimers();
        expect(await screen.findByText(/GeoNames \(CC-BY 4\.0\)/)).toBeTruthy();
        expect(screen.getByText("Otra ciudad o municipio")).toBeTruthy();
    });

    it("degrada sin bloquear cuando la búsqueda falla (p.ej. 429)", async () => {
        mockFetch([], false);
        render(<CiudadSearchSelect paisId="co" value={null} onSelect={() => {}} />);
        escribir("bog");
        vi.useRealTimers();
        expect(await screen.findByText(/No se pudo buscar ahora/)).toBeTruthy();
    });
});

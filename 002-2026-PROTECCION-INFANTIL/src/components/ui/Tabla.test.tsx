import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Tabla, TablaHead, TablaBody } from "./Tabla";

describe("Tabla", () => {
    it("renderiza contenedor glass, scroll-x y tabla con clases canónicas", () => {
        const { container } = render(
            <Tabla>
                <TablaHead>
                    <tr>
                        <th className="px-4 py-3 font-medium">Nombre</th>
                    </tr>
                </TablaHead>
                <TablaBody>
                    <tr>
                        <td className="px-4 py-3">Valor</td>
                    </tr>
                </TablaBody>
            </Tabla>
        );
        expect(container.querySelector(".glass.rounded-2xl.overflow-hidden")).toBeTruthy();
        expect(container.querySelector(".overflow-x-auto")).toBeTruthy();
        const table = container.querySelector("table");
        expect(table?.className).toContain("w-full text-left text-sm");
        expect(screen.getByText("Nombre")).toBeTruthy();
        expect(screen.getByText("Valor")).toBeTruthy();
    });

    it("omite el contenedor glass con sinContenedor", () => {
        const { container } = render(
            <Tabla sinContenedor>
                <TablaBody>
                    <tr>
                        <td>Solo tabla</td>
                    </tr>
                </TablaBody>
            </Tabla>
        );
        expect(container.querySelector(".glass")).toBeNull();
        expect(container.querySelector("table")).toBeTruthy();
    });

    it("TablaHead soporta variantes relleno y borde", () => {
        const { container } = render(
            <>
                <Tabla sinContenedor>
                    <TablaHead variante="relleno">
                        <tr>
                            <th>Relleno</th>
                        </tr>
                    </TablaHead>
                </Tabla>
                <Tabla sinContenedor>
                    <TablaHead variante="borde">
                        <tr>
                            <th>Borde</th>
                        </tr>
                    </TablaHead>
                </Tabla>
            </>
        );
        const theads = container.querySelectorAll("thead");
        expect(theads[0].className).toContain("bg-tinta/5");
        expect(theads[1].className).toContain("border-b");
    });

    it("TablaBody aplica el divisor canónico", () => {
        const { container } = render(
            <Tabla sinContenedor>
                <TablaBody>
                    <tr>
                        <td>Fila</td>
                    </tr>
                </TablaBody>
            </Tabla>
        );
        expect(container.querySelector("tbody")?.className).toContain("divide-y divide-tinta/10");
    });
});

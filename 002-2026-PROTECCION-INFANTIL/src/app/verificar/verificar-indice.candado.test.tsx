/**
 * SPEC-532 (I-327) · CANDADO: `/verificar` (sin código) EXISTE y es alcanzable.
 * Antes solo había `/verificar/[codigo]`; `/verificar` daba 404 y la verificación
 * del sello quedaba inalcanzable sin conocer la URL. Conducta:
 *  (1) la ruta `/verificar` existe (hay page.tsx → responde 200, no 404);
 *  (2) el índice navega a `/verificar/<codigo>` con el código pegado (y no navega
 *      si está vacío).
 *
 * (La parte (b) —enlazar /verificar y /docs desde el sitio público— espera la
 * ubicación que decida Diseño; su candado de «árbol de render contiene ambos
 * destinos» entra con ese cambio.)
 *
 * Mutación: romper el `router.push('/verificar/…')` → cae (2); borrar page.tsx → cae (1).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import * as fs from "node:fs";
import * as path from "node:path";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import VerificarIndexPage from "./page";

describe("SPEC-532 · índice /verificar alcanzable", () => {
    beforeEach(() => push.mockClear());

    it("(1) la ruta /verificar existe (page.tsx presente → 200, no 404)", () => {
        expect(fs.existsSync(path.resolve(__dirname, "page.tsx"))).toBe(true);
    });

    it("(2) navega a /verificar/<codigo> con el código pegado (encodeado)", () => {
        render(<VerificarIndexPage />);
        fireEvent.change(screen.getByLabelText("Código del informe"), { target: { value: "  ABC 123/x  " } });
        fireEvent.submit(screen.getByRole("button", { name: "Verificar" }).closest("form")!);
        expect(push).toHaveBeenCalledWith(`/verificar/${encodeURIComponent("ABC 123/x")}`);
    });

    it("(2b) no navega si el código está vacío", () => {
        render(<VerificarIndexPage />);
        fireEvent.submit(screen.getByRole("button", { name: "Verificar" }).closest("form")!);
        expect(push).not.toHaveBeenCalled();
    });
});

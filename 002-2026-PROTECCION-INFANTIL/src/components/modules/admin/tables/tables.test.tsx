import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PadresTable } from "./PadresTable";
import { RectoresTable } from "./RectoresTable";
import { OperadoresTable } from "./OperadoresTable";
import { ComiteConvivenciaTable } from "./ComiteConvivenciaTable";
import { ComiteValidacionTable } from "./ComiteValidacionTable";
import { AdminsTable } from "./AdminsTable";
import { PaginationControls } from "./PaginationControls";
import { fechaCorta, formatDuracionHoras, formatDuracionMs } from "./utils";
import type {
    PadreListItemDto,
    RectorListItemDto,
    OperadorListItemConsolidadoDto,
    ComiteConvivenciaListItemDto,
    ComiteValidacionListItemDto,
    AdminListItemDto,
    PaginacionDto,
} from "@/lib/dal/types/usuarios-consolidado";

const pagination: PaginacionDto = { page: 1, pageSize: 25, total: 1, totalPages: 1 };

describe("tablas de usuarios consolidados", () => {
    it("PadresTable renderiza fila con datos completos", () => {
        const items: PadreListItemDto[] = [
            {
                id: "u1",
                email: "padre@example.com",
                nombre: "Pedro Pérez",
                estado: "activo",
                reportesEnviados: 3,
                reportesUltimos30Dias: 1,
                colegiosAsociados: [{ id: "c1", nombre: "Colegio A" }],
                creadoEn: "2026-08-01T10:00:00.000Z",
                ultimaSesion: "2026-08-20T10:00:00.000Z",
            },
        ];
        render(<PadresTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getByText("Pedro Pérez")).toBeTruthy();
        expect(screen.getByText("padre@example.com")).toBeTruthy();
        expect(screen.getByText("Colegio A")).toBeTruthy();
    });

    it("PadresTable maneja nombre nulo y colegios vacíos", () => {
        const items: PadreListItemDto[] = [
            {
                id: "u1",
                email: "padre@example.com",
                nombre: null,
                estado: "inactivo",
                reportesEnviados: 0,
                reportesUltimos30Dias: 0,
                colegiosAsociados: [],
                creadoEn: "2026-08-01T10:00:00.000Z",
                ultimaSesion: null,
            },
        ];
        render(<PadresTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });

    it("RectoresTable renderiza colegio y sin colegio", () => {
        const items: RectorListItemDto[] = [
            { id: "u1", email: "r@example.com", nombre: "Rector A", estado: "activo", colegio: { id: "c1", nombre: "Colegio A" }, alumnos: 10, profesores: 2, cursos: 1, reportesColegio: 5, ultimaSesion: null },
            { id: "u2", email: "r2@example.com", nombre: null, estado: "activo", colegio: null, alumnos: 0, profesores: 0, cursos: 0, reportesColegio: 0, ultimaSesion: null },
        ];
        render(<RectoresTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getByText("Colegio A")).toBeTruthy();
        expect(screen.getByText("Sin colegio asignado")).toBeTruthy();
    });

    it("OperadoresTable muestra porcentaje de uso y colores según umbral", () => {
        const items: OperadorListItemConsolidadoDto[] = [
            { id: "u1", email: "op@example.com", nombre: "Operador A", estado: "activo", cupoMaximo: 10, casosAbiertos: 10, enProceso: 5, cerrados30Dias: 2, tiempoMedioResolucionMs: 3_600_000 },
            { id: "u2", email: "op2@example.com", nombre: "Operador B", estado: "activo", cupoMaximo: 10, casosAbiertos: 7, enProceso: 3, cerrados30Dias: 1, tiempoMedioResolucionMs: null },
            { id: "u3", email: "op3@example.com", nombre: "Operador C", estado: "activo", cupoMaximo: 0, casosAbiertos: 0, enProceso: 0, cerrados30Dias: 0, tiempoMedioResolucionMs: 120_000 },
        ];
        render(<OperadoresTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getByText("100%")).toBeTruthy();
        expect(screen.getByText("70%")).toBeTruthy();
        expect(screen.getByText("0%")).toBeTruthy();
    });

    it("ComiteConvivenciaTable maneja colegio nulo", () => {
        const items: ComiteConvivenciaListItemDto[] = [
            { id: "u1", email: "cc@example.com", nombre: "Comité A", estado: "activo", colegio: null, integrantesActivos: 3, casosEscaladosAbiertos: 2, casosEscaladosResueltos: 5, tiempoMedioResolucionHoras: null },
        ];
        render(<ComiteConvivenciaTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getByText("Sin colegio asignado")).toBeTruthy();
    });

    it("ComiteValidacionTable muestra decisiones o guión", () => {
        const items: ComiteValidacionListItemDto[] = [
            { id: "u1", email: "cv@example.com", nombre: "Validador A", estado: "activo", casosEscaladosPlataforma: 1, casosPendientes: 2, casosResueltos: 3, ultimasDecisiones: [] },
            { id: "u2", email: "cv2@example.com", nombre: "Validador B", estado: "activo", casosEscaladosPlataforma: 0, casosPendientes: 0, casosResueltos: 0, ultimasDecisiones: [{ id: "d1", numero: "R-001", estado: "RESUELTO", creadoEn: "2026-08-01", resueltoEn: "2026-08-02" }] },
        ];
        render(<ComiteValidacionTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("R-001")).toBeTruthy();
    });

    it("AdminsTable renderiza módulos gestionados", () => {
        const items: AdminListItemDto[] = [
            { id: "u1", email: "admin@example.com", nombre: "Admin A", estado: "activo", modulosGestionados: [{ clave: "usuarios", nombre: "Usuarios" }], ultimaSesion: null },
            { id: "u2", email: "admin2@example.com", nombre: null, estado: "inactivo", modulosGestionados: [], ultimaSesion: null },
        ];
        render(<AdminsTable items={items} pagination={pagination} page={1} onPageChange={vi.fn()} />);
        expect(screen.getByText("Usuarios")).toBeTruthy();
        expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    });
});

describe("PaginationControls", () => {
    it("deshabilita anterior en la primera página", () => {
        render(<PaginationControls page={1} totalPages={3} total={75} onPageChange={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(true);
        expect(screen.getByRole("button", { name: "Siguiente" }).hasAttribute("disabled")).toBe(false);
    });

    it("deshabilita siguiente en la última página", () => {
        render(<PaginationControls page={3} totalPages={3} total={75} onPageChange={vi.fn()} />);
        expect(screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(false);
        expect(screen.getByRole("button", { name: "Siguiente" }).hasAttribute("disabled")).toBe(true);
    });

    it("navega al hacer click", () => {
        const onChange = vi.fn();
        render(<PaginationControls page={2} totalPages={3} total={75} onPageChange={onChange} />);
        fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
        expect(onChange).toHaveBeenCalledWith(1);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(onChange).toHaveBeenCalledWith(3);
    });
});

describe("utils de tablas", () => {
    it("fechaCorta formatea o devuelve guión", () => {
        expect(fechaCorta("2026-08-20T10:00:00.000Z")).not.toBe("—");
        expect(fechaCorta(null)).toBe("—");
        expect(fechaCorta(undefined)).toBe("—");
    });

    it("formatDuracionHoras cubre minutos, horas y días", () => {
        expect(formatDuracionHoras(0.5)).toContain("min");
        expect(formatDuracionHoras(2)).toContain("h");
        expect(formatDuracionHoras(48)).toContain("d");
        expect(formatDuracionHoras(null)).toBe("—");
    });

    it("formatDuracionMs cubre días, horas y minutos", () => {
        expect(formatDuracionMs(2 * 24 * 60 * 60 * 1000)).toContain("d");
        expect(formatDuracionMs(2 * 60 * 60 * 1000)).toContain("h");
        expect(formatDuracionMs(5 * 60 * 1000)).toBe("5m");
        expect(formatDuracionMs(null)).toBe("—");
    });
});

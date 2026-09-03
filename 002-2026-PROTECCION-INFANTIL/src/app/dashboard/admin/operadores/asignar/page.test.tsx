/**
 * SPEC-372 (A-74 · P3) — botón "Asignar huérfanos ahora" en /admin/operadores/asignar.
 *
 * Un solo trabajo del componente: que el admin dispare la reconciliación sin
 * esperar el cron cada 15 min. Los tests atan las tres cosas que no pueden
 * cambiar sin darse cuenta:
 *   · dispara `POST /api/admin/operadores/reconciliar-huerfanos` y muestra el
 *     resumen (encontrados/asignados/fallidos);
 *   · después del disparo, refresca el estado de la cola;
 *   · un 403 del servidor se muestra sin romper la lista de operadores.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AdminOperadoresAsignarPage from "./page";

vi.mock("next/navigation", () => ({
    usePathname: () => "/dashboard/admin/operadores/asignar",
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: () => ({ user: { rol: "ADMIN" } }),
}));

vi.mock("@/lib/proxy", () => ({
    // Todos los tabs del subnav son visibles: acá lo único que importa es el botón.
    esDestinoPermitidoPorRol: () => true,
}));

const ESTADO_CON_COLA = {
    sinAsignar: 3,
    operadores: [
        {
            id: "op-1",
            email: "op1@test.local",
            nombre: "Operadora 1",
            esRevisorDeApelaciones: false,
            casosAbiertos: 2,
            cupoMaximo: 10,
            libre: 8,
        },
    ],
    estrategia: "ponderado_carga_inversa",
    cupoDefault: 10,
};

const RESUMEN_OK = { encontrados: 3, asignados: 2, fallidos: 1 };

/**
 * Ruta -> respuesta. La primera coincidencia gana. Los valores dinámicos (un
 * segundo GET tras el POST) se pasan como función que devuelve la respuesta.
 * Formato de clave: "METHOD /prefijo" — método por defecto GET si se omite.
 */
function mockFetchRuteado(mapa: Record<string, unknown | (() => unknown)>) {
    return vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        for (const [clave, valor] of Object.entries(mapa)) {
            const [m, prefijo] = clave.includes(" ") ? clave.split(" ") : ["GET", clave];
            if (m === method && url.includes(prefijo!)) {
                const payload = typeof valor === "function" ? (valor as () => unknown)() : valor;
                return { ok: true, status: 200, json: async () => payload } as Response;
            }
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
}

describe("Botón 'Asignar huérfanos ahora' (SPEC-372 · A-74 · P3)", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.restoreAllMocks());

    it("dispara POST /reconciliar-huerfanos, muestra el resumen y refresca la cola", async () => {
        let llamadasEstado = 0;
        let llamadasReconciliacion = 0;
        mockFetchRuteado({
            "GET /api/admin/operadores/asignacion": () => {
                // Antes del disparo: 3 en cola. Después: 1 (2 asignados).
                llamadasEstado += 1;
                return llamadasEstado === 1 ? ESTADO_CON_COLA : { ...ESTADO_CON_COLA, sinAsignar: 1 };
            },
            "POST /api/admin/operadores/reconciliar-huerfanos": () => {
                llamadasReconciliacion += 1;
                return RESUMEN_OK;
            },
        });

        render(<AdminOperadoresAsignarPage />);
        // La cola inicial carga y muestra el 3 en "Casos sin asignar".
        await waitFor(() => expect(screen.getByText("3")).toBeTruthy());

        const boton = screen.getByRole("button", { name: /Asignar huérfanos ahora/ }) as HTMLButtonElement;
        expect(boton.disabled).toBe(false);

        await act(async () => {
            fireEvent.click(boton);
        });

        await waitFor(() => expect(llamadasReconciliacion).toBe(1));

        // El resumen visible contiene los tres números del RESUMEN_OK — sin
        // depender del formato exacto de la etiqueta, solo de que aparezcan.
        await waitFor(() => {
            const status = screen.getByRole("status");
            expect(status.textContent).toContain("3");
            expect(status.textContent).toContain("2");
            expect(status.textContent).toContain("1");
        });

        // Y refrescó la cola: dos GETs a /asignacion (uno al montar, otro tras
        // el disparo). El "1" resultante convive con el "1" de "Operadores
        // activos", así que verificamos por número de llamadas — fuente única
        // de verdad — en vez de por texto ambiguo.
        expect(llamadasEstado).toBe(2);
    });

    it("si el endpoint devuelve 403, muestra el mensaje del servidor y NO rompe la lista", async () => {
        vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            if (method === "GET" && url.includes("/api/admin/operadores/asignacion")) {
                return { ok: true, status: 200, json: async () => ESTADO_CON_COLA } as Response;
            }
            if (method === "POST" && url.includes("/api/admin/operadores/reconciliar-huerfanos")) {
                return {
                    ok: false,
                    status: 403,
                    json: async () => ({ error: { message: "No autorizado", code: "FORBIDDEN" } }),
                } as Response;
            }
            return { ok: false, status: 404, json: async () => ({}) } as Response;
        });

        render(<AdminOperadoresAsignarPage />);
        await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
        const boton = screen.getByRole("button", { name: /Asignar huérfanos ahora/ });
        await act(async () => {
            fireEvent.click(boton);
        });
        await waitFor(() => {
            expect(screen.getByRole("alert").textContent).toContain("No autorizado");
        });
        // La cola no se rompió: los operadores siguen visibles.
        expect(screen.getByText("Operadora 1")).toBeTruthy();
    });

    it("respeta el parámetro OFF: muestra el aviso de 'deshabilitada por parámetro' cuando el endpoint responde deshabilitado", async () => {
        vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
            const url = String(input);
            const method = init?.method ?? "GET";
            if (method === "GET" && url.includes("/api/admin/operadores/asignacion")) {
                return { ok: true, status: 200, json: async () => ESTADO_CON_COLA } as Response;
            }
            if (method === "POST" && url.includes("/api/admin/operadores/reconciliar-huerfanos")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ encontrados: 0, asignados: 0, fallidos: 0, deshabilitado: true }),
                } as Response;
            }
            return { ok: false, status: 404, json: async () => ({}) } as Response;
        });

        render(<AdminOperadoresAsignarPage />);
        await waitFor(() => expect(screen.getByText("3")).toBeTruthy());
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /Asignar huérfanos ahora/ }));
        });
        await waitFor(() => {
            const status = screen.getByRole("status");
            expect(status.textContent).toContain("deshabilitada");
            expect(status.textContent).toContain("operadores.reconciliacion_enabled");
        });
    });
});

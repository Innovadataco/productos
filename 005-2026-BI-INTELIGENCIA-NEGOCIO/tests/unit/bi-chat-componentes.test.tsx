import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MensajeUsuario } from "@/components/bi/chat/MensajeUsuario";
import { TablaBI } from "@/components/bi/chat/TablaBI";
import { PanelDetalle } from "@/components/bi/chat/PanelDetalle";
import { BannerEstado } from "@/components/bi/chat/BannerEstado";
import { BotonesFeedback } from "@/components/bi/chat/BotonesFeedback";
import { MensajeMotor } from "@/components/bi/chat/MensajeMotor";
import type { RespuestaMotor } from "@/lib/bi/tipos";
import type { UsuarioUI } from "@/lib/bi/tipos-ui";

vi.mock("@/components/bi/chat/GraficoVegaLite", () => ({
    GraficoVegaLite: () => <div data-testid="grafico-vl-mock" />,
}));

const ADMIN: UsuarioUI = { id: "u1", rol: "ADMIN" };
const NO_ADMIN: UsuarioUI = { id: "u2", rol: "SCHOOL_ADMIN" };

afterEach(() => vi.restoreAllMocks());

function respOk(over: Partial<RespuestaMotor> = {}): RespuestaMotor {
    return {
        estado: "OK",
        plantilla: "un-numero",
        respuestaNarrativa: "Hay 42 total.",
        filas: [{ total: 42 }],
        sqlGenerado: "SELECT COUNT(*) AS total FROM bi_reporte_diario LIMIT 1",
        llamadasLlm: 3,
        latenciaMs: 5200,
        cacheHit: false,
        consultaLogId: "log-1",
        votosJurado: [
            { modelo: "qwen2.5:14b", latenciaMs: 1200 },
            { modelo: "gemma2:27b", latenciaMs: 1800 },
        ],
        ...over,
    };
}

describe("MensajeUsuario", () => {
    it("renderiza texto", () => {
        render(
            <MensajeUsuario mensaje={{ tipo: "usuario", id: "u1", texto: "hola", ts: 1 }} />,
        );
        expect(screen.getByText("hola")).toBeDefined();
    });
});

describe("TablaBI", () => {
    it("renderiza 5 filas simples", () => {
        const filas = Array.from({ length: 5 }, (_, i) => ({ c: i, n: i * 2 }));
        render(<TablaBI filas={filas} />);
        expect(screen.getAllByRole("row")).toHaveLength(6); // 1 header + 5
    });

    it("pagina con 100 filas y navegación anterior/siguiente", () => {
        const filas = Array.from({ length: 100 }, (_, i) => ({ n: i }));
        render(<TablaBI filas={filas} porPagina={25} />);
        expect(screen.getByText(/Página 1 de 4/)).toBeDefined();
        fireEvent.click(screen.getByText("Siguiente"));
        expect(screen.getByText(/Página 2 de 4/)).toBeDefined();
    });
});

describe("PanelDetalle", () => {
    it("muestra SQL + votos + latencias + consultaLogId", () => {
        render(<PanelDetalle respuesta={respOk()} />);
        expect(screen.getByText(/SELECT COUNT/)).toBeDefined();
        expect(screen.getByText(/qwen2.5:14b/)).toBeDefined();
        expect(screen.getByText(/gemma2:27b/)).toBeDefined();
        expect(screen.getByText(/log-1/)).toBeDefined();
    });
});

describe("BannerEstado", () => {
    it("OK → badge verde", () => {
        render(<BannerEstado respuesta={respOk()} />);
        expect(screen.getByText("OK")).toBeDefined();
    });

    it("REVISION → banner amarillo con razón", () => {
        render(<BannerEstado respuesta={respOk({ estado: "REVISION", razon: "sin_consenso" })} />);
        expect(screen.getByTestId("banner-revision")).toBeDefined();
        expect(screen.getByText(/sin_consenso/)).toBeDefined();
    });

    it("RECHAZADO → banner rojo con razón", () => {
        render(<BannerEstado respuesta={respOk({ estado: "RECHAZADO", razon: "intencion_destructiva" })} />);
        expect(screen.getByTestId("banner-rechazado")).toBeDefined();
    });
});

describe("BotonesFeedback", () => {
    it("ADMIN → botones visibles", () => {
        render(<BotonesFeedback usuario={ADMIN} consultaLogId="log-1" />);
        expect(screen.getByTestId("botones-feedback")).toBeDefined();
    });

    it("SCHOOL_ADMIN → botones NO visibles", () => {
        const { container } = render(<BotonesFeedback usuario={NO_ADMIN} consultaLogId="log-1" />);
        expect(container.innerHTML).toBe("");
    });

    it("click 👍 → fetch POST /api/bi/aprobar con consultaLogId", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
        render(<BotonesFeedback usuario={ADMIN} consultaLogId="log-9" />);
        fireEvent.click(screen.getByText("👍 Aprobar"));
        // esperar microtask
        await new Promise((r) => setTimeout(r, 0));
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/bi/aprobar",
            expect.objectContaining({
                method: "POST",
                body: expect.stringContaining("log-9"),
            }),
        );
    });
});

describe("MensajeMotor router de plantillas", () => {
    it("un-numero muestra cifra", () => {
        render(<MensajeMotor mensaje={{ tipo: "motor", id: "m", respuesta: respOk(), ts: 1 }} usuario={ADMIN} />);
        expect(screen.getByTestId("plantilla-un-numero")).toBeDefined();
    });

    it("sin-datos muestra narrativa", () => {
        render(
            <MensajeMotor
                mensaje={{
                    tipo: "motor", id: "m", ts: 1,
                    respuesta: respOk({ plantilla: "sin-datos", respuestaNarrativa: "no hay", filas: [] }),
                }}
                usuario={ADMIN}
            />,
        );
        expect(screen.getByTestId("plantilla-sin-datos")).toBeDefined();
    });

    it("tabla muestra TablaBI", () => {
        render(
            <MensajeMotor
                mensaje={{
                    tipo: "motor", id: "m", ts: 1,
                    respuesta: respOk({ plantilla: "tabla", filas: [{ a: 1 }, { a: 2 }] }),
                }}
                usuario={ADMIN}
            />,
        );
        expect(screen.getByTestId("tabla-bi")).toBeDefined();
    });

    it("grafico usa GraficoVegaLite", () => {
        render(
            <MensajeMotor
                mensaje={{
                    tipo: "motor", id: "m", ts: 1,
                    respuesta: respOk({ plantilla: "grafico", graficoSpec: { mark: "bar" } }),
                }}
                usuario={ADMIN}
            />,
        );
        expect(screen.getByTestId("grafico-vl-mock")).toBeDefined();
    });
});

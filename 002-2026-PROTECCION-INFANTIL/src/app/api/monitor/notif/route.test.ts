/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto a): test unitario del endpoint,
 * mockea la métrica (sin BD) — igual que /api/health no depende de auth.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockContarPendientesVencidas } = vi.hoisted(() => ({ mockContarPendientesVencidas: vi.fn() }));

vi.mock("@/lib/notificaciones/metricas", () => ({
    contarPendientesVencidas: mockContarPendientesVencidas,
}));

import { GET } from "./route";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/monitor/notif", () => {
    it("devuelve estado 🟢 y la estructura esperada cuando no hay pendientes vencidas", async () => {
        mockContarPendientesVencidas.mockResolvedValue(0);

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ notif_pendientes_vencidas: 0, umbral_minutos: 15, estado: "🟢" });
        expect(mockContarPendientesVencidas).toHaveBeenCalledWith(15);
    });

    it("devuelve estado 🔴 cuando hay pendientes vencidas", async () => {
        mockContarPendientesVencidas.mockResolvedValue(3);

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.notif_pendientes_vencidas).toBe(3);
        expect(body.estado).toContain("🔴");
        expect(body.estado).toContain("atascado");
    });

    it("devuelve 500 si la métrica lanza", async () => {
        mockContarPendientesVencidas.mockRejectedValue(new Error("BD caída"));

        const res = await GET();

        expect(res.status).toBe(500);
    });
});

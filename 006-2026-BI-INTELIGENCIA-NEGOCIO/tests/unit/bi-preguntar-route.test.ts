// tests/unit/bi-preguntar-route.test.ts · Contrato de POST /api/bi/preguntar
// Producto 006 · BI v2 · Motor NL→SQL (Fase 2)
// Unitarios puros: '@/lib/bi/motor' y '@/lib/auth/sesion' mockeados — sin BD,
// sin Ollama, sin red. El payload de cada caso es el REAL que envía ChatBI
// (T1): body EXACTO { pregunta } → 200 RespuestaMotor tal cual.

import { beforeEach, describe, expect, it, vi } from "vitest";

// Contrato del motor (src/lib/bi/motor.ts, otro agente; se consume tal cual).
interface RespuestaMotor {
    estado: "ok" | "clarificacion" | "rechazada" | "sin_datos" | "error";
    texto: string;
    sql?: string;
    filas?: number;
    fuenteCache?: boolean;
    consultaLogId?: string;
}

const { preguntarMock, leerSesionMock } = vi.hoisted(() => ({
    preguntarMock: vi.fn(),
    leerSesionMock: vi.fn(),
}));

vi.mock("@/lib/bi/motor", () => ({ preguntar: preguntarMock }));
vi.mock("@/lib/auth/sesion", () => ({ leerSesion: leerSesionMock }));

import { POST } from "@/app/api/bi/preguntar/route";

const EMAIL_SESION = "jelkin@innovadataco.com";
const PREGUNTA_REAL = "¿Cuántos reportes hubo en agosto y cuál fue la categoría más frecuente?";

// RespuestaMotor real del motor (la misma forma que renderiza ChatBI).
const RESPUESTA_OK: RespuestaMotor = {
    estado: "ok",
    texto: "Hubo 128 reportes en agosto; la categoría más frecuente fue acoso digital.",
    sql: "SELECT categoria, COUNT(*) AS total FROM mv_fact_reporte_diario WHERE mes = '2026-08' GROUP BY categoria ORDER BY total DESC LIMIT 20",
    filas: 7,
    fuenteCache: false,
    consultaLogId: "clg_01",
};

/** Request real del componente: POST JSON con el payload exacto { pregunta }. */
function requestCon(cuerpo: unknown): Request {
    return new Request("http://localhost:3001/api/bi/preguntar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    leerSesionMock.mockResolvedValue({ email: EMAIL_SESION });
    // Silencia el console.error deliberado del caso 500 (no es un fallo).
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/bi/preguntar · sesión (defensa en profundidad tras el middleware)", () => {
    it("sin sesión → 401 y el motor NO se llama", async () => {
        leerSesionMock.mockResolvedValue(null);
        const res = await POST(requestCon({ pregunta: PREGUNTA_REAL }));
        expect(res.status).toBe(401);
        expect(preguntarMock).not.toHaveBeenCalled();
    });
});

describe("POST /api/bi/preguntar · validación del payload (400 payload_invalido)", () => {
    it.each([
        ["JSON roto", "{ no-json"],
        ["no es objeto (array)", ["¿y esto?"]],
        ["no es objeto (string)", '"¿cuántos reportes?"'],
        ["objeto vacío", {}],
        ["pregunta no string", { pregunta: 42 }],
        ["pregunta vacía", { pregunta: "" }],
        ["pregunta solo espacios", { pregunta: "   " }],
        ["pregunta de 501 chars", { pregunta: "a".repeat(501) }],
        // Ataque histórico de PI: el rol JAMÁS viaja por body → claves extra rechazadas.
        ["clave extra (rol inyectado)", { pregunta: PREGUNTA_REAL, rol: "ADMIN" }],
    ])("%s → 400 y el motor NO se llama", async (_etiqueta, cuerpo) => {
        const res = await POST(requestCon(cuerpo));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "payload_invalido" });
        expect(preguntarMock).not.toHaveBeenCalled();
    });

    it("pregunta de 500 chars exactos → pasa al motor", async () => {
        preguntarMock.mockResolvedValue(RESPUESTA_OK);
        const res = await POST(requestCon({ pregunta: "a".repeat(500) }));
        expect(res.status).toBe(200);
    });
});

describe("POST /api/bi/preguntar · camino feliz", () => {
    it("ok → 200 con la RespuestaMotor TAL CUAL la devolvió el motor", async () => {
        preguntarMock.mockResolvedValue(RESPUESTA_OK);
        const res = await POST(requestCon({ pregunta: PREGUNTA_REAL }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(RESPUESTA_OK);
        expect(preguntarMock).toHaveBeenCalledWith(PREGUNTA_REAL, EMAIL_SESION);
    });

    it("la pregunta se recorta (trim) antes de llamar al motor", async () => {
        preguntarMock.mockResolvedValue(RESPUESTA_OK);
        await POST(requestCon({ pregunta: `  ${PREGUNTA_REAL}  ` }));
        expect(preguntarMock).toHaveBeenCalledWith(PREGUNTA_REAL, EMAIL_SESION);
    });

    it("estados no-ok del motor también pasan tal cual (200)", async () => {
        const aclaracion: RespuestaMotor = {
            estado: "clarificacion",
            texto: "¿De qué período hablamos: este mes, el trimestre o el año?",
        };
        preguntarMock.mockResolvedValue(aclaracion);
        const res = await POST(requestCon({ pregunta: "¿y los reportes?" }));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual(aclaracion);
    });
});

describe("POST /api/bi/preguntar · error inesperado del motor", () => {
    it("el motor lanza → 500 error_motor SIN detalles internos", async () => {
        preguntarMock.mockRejectedValue(new Error("Ollama caído: detalle interno con SQL crudo"));
        const res = await POST(requestCon({ pregunta: PREGUNTA_REAL }));
        expect(res.status).toBe(500);
        const cuerpo = await res.json();
        expect(cuerpo).toEqual({ error: "error_motor" });
        // Nunca filtrar el mensaje crudo del motor al cliente.
        expect(JSON.stringify(cuerpo)).not.toContain("Ollama");
    });
});

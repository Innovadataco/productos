const BASE = process.env.VANNA_BASE_URL || "http://localhost:58001";

export async function vannaHealth(): Promise<{ ok: boolean; modelosDisponibles: string[] }> {
    const res = await fetch(`${BASE}/health`);
    return (await res.json()) as { ok: boolean; modelosDisponibles: string[] };
}

export async function vannaGenerate(pregunta: string, catalogo: object) {
    const res = await fetch(`${BASE}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preguntaNL: pregunta, catalogo }),
    });
    return { status: res.status, body: await res.json() };
}

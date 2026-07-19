import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { ejecutarSandbox, type SandboxOverrides, type SandboxTrace } from "@/lib/ai/sandbox";
import { RolUsuario } from "@prisma/client";

export interface SandboxRequestBody {
    texto: string;
    parametrosOverride?: SandboxOverrides;
    comparar?: boolean;
}

export interface SandboxComparisonResponse {
    comparar: true;
    baseline: SandboxTrace;
    override: SandboxTrace;
    diferencias: {
        estadoCambio: boolean;
        categoriaCambio: boolean;
        confianzaCambio: boolean;
        confianzaDelta: number;
    };
}

function sanitizeOverrides(raw: unknown): SandboxOverrides {
    const overrides: SandboxOverrides = {};
    if (!raw || typeof raw !== "object") return overrides;
    const r = raw as Record<string, unknown>;

    const keys: (keyof Omit<SandboxOverrides, "modelo_clasificacion">)[] = [
        "umbral_revision",
        "n_votos",
        "temperatura_votos",
        "min_score_categoria",
        "rag_top_k",
    ];

    // El override de modelo es string, no numérico
    const modelo = r["modelo_clasificacion"];
    if (typeof modelo === "string" && modelo.trim().length > 0) {
        overrides.modelo_clasificacion = modelo.trim();
    }
    for (const key of keys) {
        const value = r[key];
        if (value === undefined) continue;
        const num = typeof value === "string" ? parseFloat(value) : Number(value);
        if (Number.isFinite(num)) {
            overrides[key] = num;
        }
    }
    return overrides;
}

function validateBody(body: unknown): { ok: false; response: NextResponse } | { ok: true; data: SandboxRequestBody } {
    if (!body || typeof body !== "object") {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "Body inválido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            ),
        };
    }
    const b = body as SandboxRequestBody;
    if (typeof b.texto !== "string" || b.texto.trim().length === 0) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "texto es requerido", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            ),
        };
    }
    if (b.texto.length > 4000) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: { message: "texto máximo 4000 caracteres", code: ERROR_CODES.VALIDATION_ERROR } },
                { status: 400 }
            ),
        };
    }
    return { ok: true, data: { texto: b.texto.trim(), parametrosOverride: sanitizeOverrides(b.parametrosOverride), comparar: !!b.comparar } };
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth(RolUsuario.ADMIN);

        const body = await request.json().catch(() => null);
        const validation = validateBody(body);
        if (!validation.ok) return validation.response;
        const { texto, parametrosOverride, comparar } = validation.data;

        // Rate limit por admin. Modo comparación consume 2 ejecuciones.
        const rate1 = await checkRateLimit(request, "ia_sandbox", { identifier: user.id });
        if (!rate1.allowed) {
            return NextResponse.json(
                { error: { message: "Demasiadas pruebas. Espere antes de continuar.", code: ERROR_CODES.RATE_LIMITED } },
                { status: 429, headers: rate1.headers }
            );
        }

        if (comparar) {
            const rate2 = await checkRateLimit(request, "ia_sandbox", { identifier: user.id });
            if (!rate2.allowed) {
                return NextResponse.json(
                    { error: { message: "Demasiadas pruebas. Espere antes de continuar.", code: ERROR_CODES.RATE_LIMITED } },
                    { status: 429, headers: rate2.headers }
                );
            }
        }

        if (comparar) {
            const [baseline, override] = await Promise.all([
                ejecutarSandbox(texto, {}),
                ejecutarSandbox(texto, parametrosOverride),
            ]);

            const response: SandboxComparisonResponse = {
                comparar: true,
                baseline,
                override,
                diferencias: {
                    estadoCambio: baseline.decision.estado !== override.decision.estado,
                    categoriaCambio: baseline.decision.categoria !== override.decision.categoria,
                    confianzaCambio: baseline.decision.confianza !== override.decision.confianza,
                    confianzaDelta: override.decision.confianza - baseline.decision.confianza,
                },
            };
            return NextResponse.json(response);
        }

        const trace = await ejecutarSandbox(texto, parametrosOverride);
        return NextResponse.json({ comparar: false, trace });
    } catch (error) {
        if (error instanceof AppError) {
            return NextResponse.json(error.toJSON(), { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error("[SANDBOX] Error:", message);
        return NextResponse.json(
            { error: { message: "Error ejecutando sandbox", code: ERROR_CODES.INTERNAL_ERROR } },
            { status: 500 }
        );
    }
}

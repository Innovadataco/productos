import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import { sendReporte } from "@/lib/queue";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";

vi.mock("@/lib/queue", () => ({
    sendReporte: vi.fn().mockResolvedValue({ encolado: true }),
}));

const reporteValido = {
    identificador: "+573001234567",
    plataforma: "whatsapp",
    texto: "Este número contactó a mi hija ofreciendo regalos si enviaba fotos.",
    fechaIncidente: "2026-07-10T14:30:00Z",
    ciudad: "Bogotá",
    pais: "Colombia",
};

describe("POST /api/reportes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("cifra textoOriginal al crear reporte", async () => {
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.textoOriginal).toMatch(/^enc:/);
        // SPEC-130 (BL-4): el texto de trabajo también va cifrado en reposo;
        // el contenido se conserva íntegro al descifrar (la evidencia no se altera).
        expect(reporte?.texto).toMatch(/^enc:/);
        expect(descifrarTextoReporte(reporte!.texto)).toBe(reporteValido.texto);
    });

    // ─── A-70 · B1 · "Datos inválidos" mudo ────────────────────────────────
    // Jelkin escribió el relato completo, el envío falló con 400 y el mensaje
    // no decía QUÉ estaba mal. El servidor siempre sabe el motivo (regla 3 del
    // brief): ahora lo nombra.
    it("A-70 B1c: fecha FUTURA responde 400 nombrando el campo, no 'Datos inválidos'", async () => {
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            fechaIncidente: manana.toISOString(),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message, "el mensaje nombra el campo en palabras del padre").toContain("Fecha y hora del incidente");
        expect(body.error.message, "y explica el motivo").toMatch(/futura/i);
        expect(body.error.message).not.toBe("Datos inválidos");
        expect(body.error.campo, "el cliente puede resaltar el campo exacto").toBe("fechaIncidente");
    });

    it("A-70 B1c: relato demasiado corto también nombra su campo", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("Descripción de lo ocurrido");
        expect(body.error.campo).toBe("texto");
    });

    it("crea un reporte anónimo y retorna 201 con número de seguimiento", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.reporte.numeroSeguimiento).toMatch(/^RPT-[A-Z0-9]{6}$/);
        expect(body.reporte.estado).toBe("PENDIENTE");
    });

    it("registra la señal de fuente anti-abuso (FuenteReporte) en un POST exitoso (I-263)", async () => {
        // Hueco de cobertura que dejó pasar I-263: NINGÚN test del POST verificaba
        // que se cree la FuenteReporte. El throw tragado en la ruta la dejaba sin
        // crear en prod y el CI seguía verde. Ahora se afirma la fila.
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();

        const fuente = await prisma.fuenteReporte.findUnique({ where: { reporteId: body.reporte.id } });
        expect(fuente).not.toBeNull();
        expect(fuente!.ipHash).toBeTruthy();
        expect(fuente!.pesoAplicado).toBeGreaterThan(0);
    });

    it("crea un reporte autenticado vinculado al usuario", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.usuarioId).toBe(user.id);
        expect(reporte?.esAnonimo).toBe(false);
    });

    it("rechaza reporte con texto menor a 20 caracteres", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "corto",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    // Test de EFECTO (I-14, ADR_004): el guarda real es la validación de creación en
    // POST /api/reportes — con el parámetro en N, un texto de N-1 caracteres (trim)
    // se RECHAZA con 400 y uno de N+1 se acepta.
    it("aplica la longitud mínima desde reportes.spam.min_text_length (test de efecto)", async () => {
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
        await prisma.parametroSistema.upsert({
            where: { clave: "reportes.spam.min_text_length" },
            update: { valor: "30" },
            create: {
                clave: "reportes.spam.min_text_length",
                valor: "30",
                tipo: "INTEGER",
                categoria: "SECURITY",
                esPublico: true,
            },
        });

        // N-1 = 29 caracteres → 400 con el valor del parámetro en el mensaje
        const reqCorto = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "a".repeat(29),
        });
        const resCorto = await POST(reqCorto);
        expect(resCorto.status).toBe(400);
        const bodyCorto = await resCorto.json();
        expect(bodyCorto.error.code).toBe("VALIDATION_ERROR");
        expect(bodyCorto.error.message).toContain("30");

        // N+1 = 31 caracteres → 201
        const reqLargo = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "a".repeat(31),
        });
        const resLargo = await POST(reqLargo);
        expect(resLargo.status).toBe(201);
    });

    it("rechaza reporte con fecha futura", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            fechaIncidente: "2030-01-01T00:00:00Z",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rechaza reporte con plataforma inválida", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            plataforma: "plataforma-inexistente",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.message).toContain("Plataforma no válida");
    });

    // SPEC-323 (candado 26): padre autenticado recibe oferta en lugar de 429.
    it("detecta duplicado autenticado dentro de 30 días → oferta de vinculación (200)", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req1 = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res1 = await POST(req1);
        expect(res1.status).toBe(201);
        const body1 = await res1.json();
        const reporteId = body1.reporte.id as string;

        const req2 = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Otro texto descriptivo del mismo incidente reportado.",
        }, token);
        const res = await POST(req2);
        // SPEC-323: oferta, no bloqueo
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.oferta).toBe(true);
        expect(body.reporteExistenteId).toBe(reporteId);
        expect(body.identificador).toBe(reporteValido.identificador);
        // Candado: sigue habiendo exactamente 1 reporte (no se creó el 2º sin vinculación)
        expect(await prisma.reporte.count()).toBe(1);
    });

    it("aplica rate limiting a reportes anónimos", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") {
            // Con rate limiting deshabilitado, el sexto reporte también se acepta
            const ipHeader = { "x-forwarded-for": "1.2.3.4" };
            for (let i = 0; i < 6; i++) {
                const req = new Request("http://localhost:5005/api/reportes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...ipHeader },
                    body: JSON.stringify({ ...reporteValido, identificador: `+57300${i}00000` }),
                });
                const res = await POST(req);
                expect(res.status).toBe(201);
            }
            return;
        }

        const ipHeader = { "x-forwarded-for": "1.2.3.4" };
        for (let i = 0; i < 5; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...ipHeader },
                body: JSON.stringify({ ...reporteValido, identificador: `+57300${i}00000` }),
            });
            const res = await POST(req);
            expect(res.status).toBe(201);
        }

        const req6 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...ipHeader },
            body: JSON.stringify({ ...reporteValido, identificador: "+57300600000" }),
        });
        const res = await POST(req6);
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("reporte real no es marcado como spam por contenido", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Este número contactó a mi hija ofreciendo regalos si enviaba fotos.",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.reporte.estado).toBe("PENDIENTE");
    });

    it("heurística no rechaza reporte por no mencionar ciertas palabras", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Un adulto me escribió insistiendo en quedar a solas. Me sentí muy incómodo.",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.reporte.estado).toBe("PENDIENTE");
    });

    it("actualiza el contador en IdentificadorReportado", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        await POST(req);
        const agregado = await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador: reporteValido.identificador, plataformaId: (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!.id } },
        });
        expect(agregado?.totalReportes).toBe(1);
        expect(agregado?.reportesAnonimos).toBe(1);
    });

    it("marca REVISION_MANUAL al superar rate limit por identificador", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") return;

        const identificador = "+57300IDENTIFICADOR";
        for (let i = 0; i < 10; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.${i}.1` },
                body: JSON.stringify({ ...reporteValido, identificador }),
            });
            const res = await POST(req);
            expect(res.status).toBe(201);
            const body = await res.json();
            expect(body.reporte.estado).toBe("PENDIENTE");
        }

        const req11 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.99.1" },
            body: JSON.stringify({ ...reporteValido, identificador }),
        });
        const res11 = await POST(req11);
        expect(res11.status).toBe(201);
        const body11 = await res11.json();
        expect(body11.reporte.estado).toBe("REVISION_MANUAL");
    });

    it("marca POSIBLE_SPAM al superar umbral de spam por identificador", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") return;

        const identificador = "+57300SPAMTHRESH";
        for (let i = 0; i < 21; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-forwarded-for": `10.1.${i}.1` },
                body: JSON.stringify({ ...reporteValido, identificador }),
            });
            await POST(req);
        }

        const req22 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-forwarded-for": "10.1.99.1" },
            body: JSON.stringify({ ...reporteValido, identificador }),
        });
        const res22 = await POST(req22);
        expect(res22.status).toBe(201);
        const body22 = await res22.json();
        expect(body22.reporte.estado).toBe("POSIBLE_SPAM");
    });

    it("rechaza reportes que superan rate limit por fingerprint", async () => {
        if (process.env.DISABLE_RATE_LIMIT === "true") return;

        // Mismo fingerprint = mismo user-agent, accept-language e IP truncada (/24).
        const headers = {
            "Content-Type": "application/json",
            "x-forwarded-for": "10.2.0.1",
            "user-agent": "TestAgent/1.0",
            "accept-language": "es-CO",
        };
        for (let i = 0; i < 5; i++) {
            const req = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers,
                body: JSON.stringify({ ...reporteValido, identificador: `+57300FP${i}` }),
            });
            const res = await POST(req);
            expect(res.status).toBe(201);
        }

        const req6 = new Request("http://localhost:5005/api/reportes", {
            method: "POST",
            headers,
            body: JSON.stringify({ ...reporteValido, identificador: "+57300FP5" }),
        });
        const res6 = await POST(req6);
        expect(res6.status).toBe(429);
        const body = await res6.json();
        expect(body.error.code).toBe("RATE_LIMITED");
    });

    it("asigna prioridad alta a reportes autenticados y encola con prioridad 10", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.prioridadAlta).toBe(true);
        expect(reporte?.esAnonimo).toBe(false);
        expect(sendReporte).toHaveBeenCalledWith(body.reporte.id, { prioridadAlta: true });
    });

    it("asigna prioridad baja a reportes anónimos sin keyword de alto riesgo", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Este número contactó a mi hija ofreciendo regalos si enviaba fotos.",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.prioridadAlta).toBe(false);
        expect(sendReporte).toHaveBeenCalledWith(body.reporte.id, { prioridadAlta: false });
    });

    it("eleva a prioridad alta reportes anónimos con keyword de alto riesgo", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            texto: "Este número publicó fotos mías y amenazó con doxearme si no le enviaba más material.",
        });
        const res = await POST(req);
        expect(res.status).toBe(201);

        const body = await res.json();
        const reporte = await prisma.reporte.findUnique({ where: { id: body.reporte.id } });
        expect(reporte?.prioridadAlta).toBe(true);
        expect(reporte?.keywordsDetectadas).toContain("doxear");
        expect(sendReporte).toHaveBeenCalledWith(body.reporte.id, { prioridadAlta: true });
    });
});

describe("POST /api/reportes — bypass fingerprint simulador (SPEC-192 I-71)", () => {
    const TEST_SECRET = "test-simulador-abuso-secret-32bytes";
    let originalSimuladorSecret: string | undefined;

    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        originalSimuladorSecret = process.env.SIMULADOR_ABUSO_SECRET;
        process.env.SIMULADOR_ABUSO_SECRET = TEST_SECRET;
    });

    afterEach(() => {
        process.env.SIMULADOR_ABUSO_SECRET = originalSimuladorSecret;
    });

    const baseFingerprintHeaders = {
        "Content-Type": "application/json",
        "user-agent": "SimuladorAbuso/1.0",
        "accept-language": "es-CO",
    };

    it("secret correcto permite superar el límite por fingerprint", async () => {
        const originalDisableRateLimit = process.env.DISABLE_RATE_LIMIT;
        process.env.DISABLE_RATE_LIMIT = "false";
        const secret = TEST_SECRET;

        try {
            for (let i = 0; i < 6; i++) {
                const req = new Request("http://localhost:5005/api/reportes", {
                    method: "POST",
                    headers: {
                        ...baseFingerprintHeaders,
                        "x-forwarded-for": `10.9.0.${i + 1}`,
                        "x-simulacion-secret": secret,
                    },
                    body: JSON.stringify({ ...reporteValido, identificador: `+57300BY${i}` }),
                });
                const res = await POST(req);
                expect(res.status).toBe(201);
            }
        } finally {
            process.env.DISABLE_RATE_LIMIT = originalDisableRateLimit;
        }
    });

    it("sin header el sexto reporte con igual fingerprint es 429", async () => {
        const originalDisableRateLimit = process.env.DISABLE_RATE_LIMIT;
        process.env.DISABLE_RATE_LIMIT = "false";

        try {
            for (let i = 0; i < 5; i++) {
                const req = new Request("http://localhost:5005/api/reportes", {
                    method: "POST",
                    headers: {
                        ...baseFingerprintHeaders,
                        "x-forwarded-for": `10.10.0.${i + 1}`,
                    },
                    body: JSON.stringify({ ...reporteValido, identificador: `+57300NO${i}` }),
                });
                const res = await POST(req);
                expect(res.status).toBe(201);
            }

            const req6 = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: {
                    ...baseFingerprintHeaders,
                    "x-forwarded-for": "10.10.0.6",
                },
                body: JSON.stringify({ ...reporteValido, identificador: "+57300NO5" }),
            });
            const res6 = await POST(req6);
            expect(res6.status).toBe(429);
            const body6 = await res6.json();
            expect(body6.error.code).toBe("RATE_LIMITED");
        } finally {
            process.env.DISABLE_RATE_LIMIT = originalDisableRateLimit;
        }
    });

    it("header falso no bypassa el rate limit por fingerprint", async () => {
        const originalDisableRateLimit = process.env.DISABLE_RATE_LIMIT;
        process.env.DISABLE_RATE_LIMIT = "false";

        try {
            for (let i = 0; i < 5; i++) {
                const req = new Request("http://localhost:5005/api/reportes", {
                    method: "POST",
                    headers: {
                        ...baseFingerprintHeaders,
                        "x-forwarded-for": `10.11.0.${i + 1}`,
                        "x-simulacion-secret": "test-simulador-abuso-secret-32bytes-FALSO",
                    },
                    body: JSON.stringify({ ...reporteValido, identificador: `+57300FA${i}` }),
                });
                const res = await POST(req);
                expect(res.status).toBe(201);
            }

            const req6 = new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: {
                    ...baseFingerprintHeaders,
                    "x-forwarded-for": "10.11.0.6",
                    "x-simulacion-secret": "test-simulador-abuso-secret-32bytes-FALSO",
                },
                body: JSON.stringify({ ...reporteValido, identificador: "+57300FA5" }),
            });
            const res6 = await POST(req6);
            expect(res6.status).toBe(429);
            const body6 = await res6.json();
            expect(body6.error.code).toBe("RATE_LIMITED");
        } finally {
            process.env.DISABLE_RATE_LIMIT = originalDisableRateLimit;
        }
    });
});

describe("POST /api/reportes — vigencia del padre (SPEC-119)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    // SPEC-356 (I-253) · el test anterior afirmaba el BUG: exigía 403 para el
    // padre vencido. La regla dura de Jelkin («proteger a un menor está por
    // encima del cobro») manda sobre SPEC-119, y `guardias.ts` ya eximía la
    // ruta — el handler la contradecía y el padre PERDÍA el relato escrito.
    // Invertido con assert fuerte: no basta el 201, el reporte debe QUEDAR.
    it("SPEC-356: padre VENCIDO reporta con normalidad (201) y el reporte queda guardado", async () => {
        const user = await crearUsuario("PARENT");
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.usuario.update({ where: { id: user.id }, data: { finServicio: ayer } });
        const token = await crearTokenUsuario(user.id, "PARENT");

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res = await POST(req);
        expect(res.status, "el plan vencido NUNCA bloquea un reporte").toBe(201);

        // Assert fuerte: el reporte existe, es de ESE padre y NO quedó anónimo.
        const creados = await prisma.reporte.findMany({ where: { usuarioId: user.id } });
        expect(creados, "el relato del padre vencido se guarda, no se pierde").toHaveLength(1);
        expect(creados[0].esAnonimo).toBe(false);
        expect(creados[0].identificador).toBe(reporteValido.identificador);
    });

    it("padre sin vigencia definida reporta con normalidad (201)", async () => {
        const user = await crearUsuario("PARENT");
        const token = await crearTokenUsuario(user.id, "PARENT");
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido, token);
        const res = await POST(req);
        expect(res.status).toBe(201);
    });

    it("SPEC-438 (I-305): SIN fecha del hecho el servidor rechaza — no rellena", async () => {
        // El defecto: el cliente mandaba `new Date()` cuando el campo venía
        // vacío y el instante del ENVÍO quedaba como hora del HECHO. El
        // servidor tiene que rechazar la ausencia, no aceptar un relleno.
        const { fechaIncidente: _sinFecha, ...sinLaFecha } = reporteValido;
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", sinLaFecha);
        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.campo, "el cliente puede resaltar el campo exacto").toBe("fechaIncidente");
    });

    it("SPEC-438: una hora ESTIMADA queda marcada como aproximada en la base", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", {
            ...reporteValido,
            horaAproximada: true,
        });
        expect((await POST(req)).status).toBe(201);
        const r = await prisma.reporte.findFirst({ orderBy: { creadoEn: "desc" } });
        expect(r?.horaAproximada, "sin la marca, una hora estimada se lee como precisa").toBe(true);
    });

    it("SPEC-438: una hora EXACTA no queda marcada como aproximada", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/reportes", reporteValido);
        expect((await POST(req)).status).toBe(201);
        const r = await prisma.reporte.findFirst({ orderBy: { creadoEn: "desc" } });
        expect(r?.horaAproximada).toBe(false);
    });

});

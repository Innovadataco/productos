/**
 * SPEC-378 · GET /api/admin/inicio/senales — la alarma de la casa.
 *
 * Afirma: (a) sin datos, alertas vacío; (b) los umbrales del seed disparan las
 * señales correctas; (c) el gate por rol y por módulo funciona.
 *
 * SPEC-414 (I-271, I-294) añade, contra la BD de verdad: (d) las colas de
 * trabajo descuentan lo marcado en `demo_marcado` y `?prueba=1` lo devuelve;
 * (e) el conteo de lo sembrado viaja siempre en la respuesta; (f) la consulta
 * del marcador **corre** — antes reventaba por el nombre de tabla y nadie se
 * enteraba porque `allSettled` se comía el error.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearPlataforma } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function autenticarAdmin() {
    const admin = await crearUsuario("ADMIN");
    mockToken = await crearTokenUsuario(admin.id, "ADMIN");
    return admin;
}

async function crearReporteHuerfanoViejo(horasAtras: number) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const creadoEn = new Date(Date.now() - horasAtras * 3600 * 1000);
    return prisma.reporte.create({
        data: {
            identificador: `+57300${Date.now()}${Math.floor(Math.random() * 1000)}`,
            plataformaId: plataforma!.id,
            texto: "reporte huérfano de prueba",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            estado: "REVISION_MANUAL",
            esAnonimo: true,
            operadorId: null,
            creadoEn,
        },
    });
}

function req(params = ""): Request {
    return new Request(`http://localhost:5005/api/admin/inicio/senales${params}`, {
        method: "GET",
        headers: { cookie: `token=${mockToken}` },
    });
}

/** El interruptor puesto: las colas vuelven a contar lo sembrado. */
function reqConPrueba(): Request {
    return req("?prueba=1");
}

describe("GET /api/admin/inicio/senales (SPEC-378)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    });

    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => prisma.$disconnect());

    it("sin datos: la casa está tranquila → alertas vacío", async () => {
        await autenticarAdmin();
        const res = await GET(req());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.alertas).toEqual([]);
        expect(typeof body.latenciaMs).toBe("number");
        expect(typeof body.generadoEn).toBe("string");
    });

    it("N reportes huérfanos ANTIGUOS por encima del umbral → señal media", async () => {
        // Umbral default: 3 · antigüedad: 24 h.
        await autenticarAdmin();
        await crearReporteHuerfanoViejo(48);
        await crearReporteHuerfanoViejo(48);
        await crearReporteHuerfanoViejo(48);

        const res = await GET(req());
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "reportes_huerfanos");
        expect(alerta, "3 huérfanos ≥ umbral 3").toBeDefined();
        expect(alerta.prioridad).toBe("media");
        expect(alerta.texto).toMatch(/sin dueño/i);
        expect(alerta.ruta).toBe("/dashboard/admin/operadores/asignar");
    });

    it("huérfanos RECIENTES (menos de 24 h) NO disparan alerta", async () => {
        await autenticarAdmin();
        await crearReporteHuerfanoViejo(1);
        await crearReporteHuerfanoViejo(1);
        await crearReporteHuerfanoViejo(1);
        const res = await GET(req());
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "reportes_huerfanos")).toBe(false);
    });

    it("un correo FALLIDO con patrón de CUOTA → señal alta 'correos no salen' (una sola ya importa)", async () => {
        await autenticarAdmin();
        await prisma.notificacion.create({
            data: {
                evento: "TEST",
                destinatarioEmail: "test@test.local",
                plantillaClave: "TEST",
                canal: "EMAIL",
                variables: {},
                estado: "FALLIDA",
                ultimoError: "Provider quota exceeded (429)",
            },
        });
        const res = await GET(req());
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "correos_no_salen");
        expect(alerta, "cuota agotada = alta aunque sea un solo correo").toBeDefined();
        expect(alerta.prioridad).toBe("alta");
        expect(alerta.texto).toMatch(/cuota|proveedor/i);
    });

    it("5 correos FALLIDOS sin cuota (default del umbral) → señal media", async () => {
        await autenticarAdmin();
        for (let i = 0; i < 5; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `test${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "SMTP timeout",
                },
            });
        }
        const res = await GET(req());
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "correos_fallidos_volumen");
        expect(alerta).toBeDefined();
        expect(alerta.prioridad).toBe("media");
    });

    it("SPEC-401 (I-283): 10 FALLIDA seguidas en EMAIL (5xx / connection refused) → señal 'proveedor_email_caido' alta", async () => {
        await autenticarAdmin();
        // 10 FALLIDA sin ninguna ENVIADA intercalada — proveedor no acepta nada.
        for (let i = 0; i < 10; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "[connection_refused][502] Provider unreachable",
                },
            });
        }
        const res = await GET(req());
        const body = await res.json();
        const alerta = body.alertas.find((a: { id: string }) => a.id === "proveedor_email_caido");
        expect(alerta, "10 FALLIDA seguidas (no-cuota) = proveedor caído").toBeDefined();
        expect(alerta.prioridad).toBe("alta");
        expect(alerta.texto).toMatch(/proveedor.*caído|caído|no aceptó/i);
    });

    it("SPEC-401 (I-283): 10 FALLIDA seguidas TODAS por cuota (429) → NO dispara 'proveedor_email_caido' (lo cubre 'correos_no_salen')", async () => {
        await autenticarAdmin();
        // Simula el escenario real del 03-09-2026: Resend devuelve 429 daily_quota_exceeded
        // a todo. `correos_no_salen` ya grita eso; no duplicamos ruido.
        for (let i = 0; i < 10; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "[daily_quota_exceeded][429] You have reached your daily sending quota",
                },
            });
        }
        const res = await GET(req());
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "proveedor_email_caido")).toBe(false);
        // Y en cambio SÍ dispara la de cuota (alta).
        const cuota = body.alertas.find((a: { id: string }) => a.id === "correos_no_salen");
        expect(cuota, "cuota agotada = correos_no_salen").toBeDefined();
        expect(cuota.prioridad).toBe("alta");
    });

    it("SPEC-401 (I-283): 9 cuota + 1 no-cuota (última) → SÍ dispara 'proveedor_email_caido' (algo distinto a cuota está fallando)", async () => {
        await autenticarAdmin();
        // La una no-cuota rompe la homogeneidad — algo más que cuota está mal.
        await prisma.notificacion.create({
            data: {
                evento: "TEST",
                destinatarioEmail: "raro@test.local",
                plantillaClave: "TEST",
                canal: "EMAIL",
                variables: {},
                estado: "FALLIDA",
                ultimoError: "[connection_refused][502] Provider unreachable",
            },
        });
        for (let i = 0; i < 9; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "[daily_quota_exceeded][429] Quota reached",
                },
            });
        }
        const res = await GET(req());
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "proveedor_email_caido")).toBe(true);
    });

    it("SPEC-401 (I-283): 9 FALLIDA + 1 ENVIADA intercalada → NO dispara 'proveedor_email_caido'", async () => {
        await autenticarAdmin();
        // La ENVIADA más reciente rompe la racha.
        await prisma.notificacion.create({
            data: {
                evento: "TEST",
                destinatarioEmail: "ok@test.local",
                plantillaClave: "TEST",
                canal: "EMAIL",
                variables: {},
                estado: "ENVIADA",
            },
        });
        for (let i = 0; i < 9; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "algo falló",
                },
            });
        }
        const res = await GET(req());
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "proveedor_email_caido")).toBe(false);
    });

    it("SPEC-401 (I-283): menos de la ventana (5 FALLIDA) → NO dispara 'proveedor_email_caido' (sistema idle)", async () => {
        await autenticarAdmin();
        for (let i = 0; i < 5; i++) {
            await prisma.notificacion.create({
                data: {
                    evento: "TEST",
                    destinatarioEmail: `dest${i}@test.local`,
                    plantillaClave: "TEST",
                    canal: "EMAIL",
                    variables: {},
                    estado: "FALLIDA",
                    ultimoError: "algo falló",
                },
            });
        }
        const res = await GET(req());
        const body = await res.json();
        expect(body.alertas.some((a: { id: string }) => a.id === "proveedor_email_caido")).toBe(false);
    });

    it("las alertas se ordenan: prioridad ALTA primero, luego MEDIA (empate por id)", async () => {
        await autenticarAdmin();
        // Cuota (alta)
        await prisma.notificacion.create({
            data: {
                evento: "T",
                destinatarioEmail: "x@x",
                plantillaClave: "T",
                canal: "EMAIL",
                variables: {},
                estado: "FALLIDA",
                ultimoError: "quota exceeded",
            },
        });
        // Huérfanos (media)
        for (let i = 0; i < 3; i++) await crearReporteHuerfanoViejo(48);

        const res = await GET(req());
        const body = await res.json();
        expect(body.alertas.length).toBeGreaterThanOrEqual(2);
        const [primera] = body.alertas;
        expect(primera.prioridad).toBe("alta");
    });

    it("sin token → 401", async () => {
        const res = await GET(req());
        expect(res.status).toBe(401);
    });

    it("PARENT (rol equivocado) → 401/403", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET(req());
        expect([401, 403]).toContain(res.status);
    });
});

/**
 * SPEC-414 · el corte CARGA / SALUD contra la base de verdad.
 *
 * Estos tests son la contraprueba de I-294: si la consulta del marcador
 * volviera a apuntar a una tabla que no existe, la señal se caería y —con el
 * arreglo puesto— aparecería en `degradadas`. Sin el arreglo simplemente
 * desaparecía, y el test que solo mirara `alertas` habría pasado en verde.
 */
describe("GET /api/admin/inicio/senales · SPEC-414 (I-271, I-294)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
    });

    afterEach(() => vi.restoreAllMocks());

    async function marcarComoSembrado(entidad: string, entidadId: string) {
        await prisma.demoMarcado.create({ data: { entidad, entidadId } });
    }

    it("CARGA: los reportes huérfanos SEMBRADOS no cuentan como trabajo pendiente", async () => {
        await autenticarAdmin();
        // Umbral default 3: sembramos 5, marcamos 4 → quedan 1 real, por debajo.
        const reportes = [];
        for (let i = 0; i < 5; i++) reportes.push(await crearReporteHuerfanoViejo(48));
        for (const r of reportes.slice(0, 4)) await marcarComoSembrado("Reporte", r.id);

        const res = await GET(req());
        const body = await res.json();
        expect(body.degradadas, "ninguna señal debió reventar").toEqual([]);
        expect(body.alertas.find((a: { id: string }) => a.id === "reportes_huerfanos")).toBeUndefined();
        expect(body.incluyeSembrados).toBe(false);
        expect(body.sembrados.total).toBe(4);
    });

    it("con ?prueba=1 los mismos datos SÍ disparan la señal", async () => {
        await autenticarAdmin();
        const reportes = [];
        for (let i = 0; i < 5; i++) reportes.push(await crearReporteHuerfanoViejo(48));
        for (const r of reportes.slice(0, 4)) await marcarComoSembrado("Reporte", r.id);

        const res = await GET(reqConPrueba());
        const body = await res.json();
        expect(body.incluyeSembrados).toBe(true);
        const senal = body.alertas.find((a: { id: string }) => a.id === "reportes_huerfanos");
        expect(senal, "con el interruptor puesto la cola vuelve a estar llena").toBeDefined();
        expect(senal.texto).toContain("5 reportes");
    });

    it("el conteo de lo sembrado viaja SIEMPRE — nada queda oculto", async () => {
        await autenticarAdmin();
        const reportes = [];
        for (let i = 0; i < 5; i++) reportes.push(await crearReporteHuerfanoViejo(48));
        for (const r of reportes.slice(0, 4)) await marcarComoSembrado("Reporte", r.id);

        for (const pedido of [req(), reqConPrueba()]) {
            const body = await (await GET(pedido)).json();
            expect(body.sembrados.total).toBe(4);
            expect(body.sembrados.porSenal).toContainEqual({ id: "reportes_huerfanos", sembrados: 4 });
        }
    });

    it("el total NO se infla: un reporte en dos colas se cuenta UNA vez", async () => {
        // Los 4 reportes marcados son huérfanos Y están en REVISION_MANUAL, así
        // que aportan a dos descuentos distintos. El desglose lo refleja; el
        // total no, porque cuenta filas, no descuentos. Sumar `porSenal` daría 8
        // y le mentiría al administrador sobre cuánto humo hay.
        await autenticarAdmin();
        const reportes = [];
        for (let i = 0; i < 5; i++) reportes.push(await crearReporteHuerfanoViejo(48));
        for (const r of reportes.slice(0, 4)) await marcarComoSembrado("Reporte", r.id);

        const body = await (await GET(req())).json();
        const suma = body.sembrados.porSenal.reduce((a: number, p: { sembrados: number }) => a + p.sembrados, 0);
        expect(suma, "el desglose sí solapa entre colas").toBeGreaterThan(4);
        expect(body.sembrados.total, "el total cuenta filas distintas").toBe(4);
    });

    it("I-294 · la consulta del marcador CORRE: sin filas marcadas, cero degradadas y cero descontado", async () => {
        // Antes del arreglo esta consulta reventaba SIEMPRE (tabla "DemoMarcado"
        // inexistente) y el rechazo se perdía. Si vuelve a pasar, `degradadas`
        // deja de estar vacío y este test cae.
        await autenticarAdmin();
        await crearReporteHuerfanoViejo(48);
        const body = await (await GET(req())).json();
        expect(body.degradadas).toEqual([]);
        expect(body.sembrados.total).toBe(0);
    });

    it("SALUD: una señal de salud NO descuenta lo sembrado (la falla es real igual)", async () => {
        await autenticarAdmin();
        const body = await (await GET(req())).json();
        // Ninguna señal de SALUD aporta al conteo de sembrados: ese conteo es
        // exclusivo de las colas de trabajo.
        const idsSalud = ["correos_fallidos", "proveedor_email", "analisis_racha", "jurado_reducido", "infra"];
        for (const id of idsSalud) {
            expect(body.sembrados.porSenal.find((p: { id: string }) => p.id === id)).toBeUndefined();
        }
    });
});

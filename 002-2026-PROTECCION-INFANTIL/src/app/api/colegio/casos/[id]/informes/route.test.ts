/**
 * SPEC-351 (T033 + FR-004-bis) · POST/GET /api/colegio/casos/[id]/informes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearColegioConAdmin,
    crearPlataforma,
    crearCurso,
    crearEstudiante,
    crearIdentificadorEstudiante,
} from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            if ((name === "token" || name === "__Host-token") && mockToken) {
                return { name, value: mockToken };
            }
            return undefined;
        },
    }),
}));

const TEXTO_REPORTE = "contenido secreto del reporte que JAMAS entra al informe";
const EMAIL_DENUNCIANTE = "denunciante-firmado@example.com";

async function seedCaso() {
    const { colegio, admin } = await crearColegioConAdmin();
    // El rector necesita nombre + documento para firmar (FR de la spec).
    await prisma.usuario.update({
        where: { id: admin.id },
        data: { nombre: "Rectora", apellidos: "Fernández", documentoNumero: "52123456" },
    });
    const plataforma = await crearPlataforma("roblox", "Roblox", "juego");
    const curso = await crearCurso(colegio.id, { nombre: "9°-A", grado: "9" });
    const estudiante = await crearEstudiante(curso.id, colegio.id);
    const identificador = await crearIdentificadorEstudiante(estudiante.id, {
        tipo: "usuario",
        valor: `nick-inf-${Date.now()}`,
        plataformaId: plataforma.id,
    });
    const denunciante = await prisma.usuario.create({
        data: { email: EMAIL_DENUNCIANTE, passwordHash: "x", rol: "PARENT", estado: "activo" },
    });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: identificador.valor,
            plataformaId: plataforma.id,
            texto: TEXTO_REPORTE,
            fechaIncidente: new Date("2026-08-30T21:15:00-05:00"),
            ciudad: "Bogotá",
            pais: "CO",
            estado: "CLASIFICADO",
            esAnonimo: false,
            usuarioId: denunciante.id,
        },
    });
    await prisma.clasificacionIA.create({
        data: { reporteId: reporte.id, categoria: "CIBERACOSO", confianza: 0.9, modeloUsado: "t", latenciaMs: 5 },
    });
    const alerta = await prisma.alertaColegio.create({
        data: {
            colegioId: colegio.id,
            reporteId: reporte.id,
            tipoSujeto: "ESTUDIANTE",
            identificadorEstudianteId: identificador.id,
            estado: "escalada",
            prioridad: "alta",
            vencimientoSla: new Date(Date.now() + 48 * 3600 * 1000),
        },
    });
    const caso = await prisma.seguimientoCaso.create({ data: { colegioId: colegio.id, alertaId: alerta.id } });
    await prisma.notaSeguimiento.create({
        data: { seguimientoId: caso.id, colegioId: colegio.id, texto: "Se citó a la familia del estudiante", autorId: admin.id },
    });
    return { colegio, admin, caso };
}

function req(method: "GET" | "POST", id: string, body?: unknown): Request {
    return new Request(`http://localhost:5005/api/colegio/casos/${id}/informes`, {
        method,
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

describe("POST /api/colegio/casos/[id]/informes (SPEC-351)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("403 para PARENT", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await POST(req("POST", "x", { secciones: ["hechos"] }), { params: Promise.resolve({ id: "x" }) });
        expect(res.status).toBe(403);
    });

    it("404 para SCHOOL_ADMIN de OTRO colegio", async () => {
        const { caso } = await seedCaso();
        const { admin: ajeno } = await crearColegioConAdmin();
        mockToken = await crearTokenUsuario(ajeno.id, "SCHOOL_ADMIN");
        const res = await POST(req("POST", caso.id, { secciones: ["hechos"] }), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(404);
    });

    it("genera 201 con PDF + correlativo INF-<año>-0001 + fila inmutable + aviso sin escudo", async () => {
        const { admin, caso } = await seedCaso();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(req("POST", caso.id, { secciones: ["hechos", "actuacion"] }), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(201);
        expect(res.headers.get("Content-Type")).toBe("application/pdf");
        expect(res.headers.get("X-Informe-Correlativo")).toMatch(/^INF-\d{4}-0001$/);
        expect(res.headers.get("X-Aviso-Escudo")).toBe("sin-escudo");

        const buffer = Buffer.from(await res.arrayBuffer());
        expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");

        const fila = await prisma.informeCaso.findFirst({ where: { casoId: caso.id } });
        expect(fila).not.toBeNull();
        expect(fila!.numeroCorrelativo).toBe(1);
        expect(fila!.firmadoPorNombre).toBe("Rectora Fernández");
        expect(res.headers.get("X-Informe-Hash")).toBe(fila!.pdfHash);
    });

    it("FR-004-bis · el armado del informe NUNCA incluye texto del reporte ni identidad del denunciante", async () => {
        const { admin, caso } = await seedCaso();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        // Interceptar el INPUT que la ruta arma para el PDF (contract-by-construction:
        // el grep binario del PDF no sirve por glifos embebidos — regla A-68).
        const mod = await import("@/lib/caso/pdf-informe-caso");
        let inputCapturado: unknown = null;
        const spy = vi.spyOn(mod, "generarPdfInformeCaso");
        spy.mockImplementationOnce(async (input) => {
            inputCapturado = input;
            return (await spy.getMockImplementation() === undefined ? Buffer.from("%PDF-fake") : Buffer.from("%PDF-fake"));
        });

        await POST(req("POST", caso.id, { secciones: ["hechos", "actuacion"] }), { params: Promise.resolve({ id: caso.id }) });
        spy.mockRestore();

        expect(inputCapturado).not.toBeNull();
        const s = JSON.stringify(inputCapturado);
        expect(s, "texto del reporte no entra al PDF").not.toContain(TEXTO_REPORTE);
        expect(s, "email del denunciante no entra al PDF").not.toContain(EMAIL_DENUNCIANTE);
        // La bitácora propia del colegio SÍ va (texto del colegio, no del denunciante)
        expect(s).toContain("Se citó a la familia del estudiante");
    });

    it("sin documento del rector → 400 con mensaje claro", async () => {
        const { admin, caso } = await seedCaso();
        await prisma.usuario.update({ where: { id: admin.id }, data: { documentoNumero: null } });
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        const res = await POST(req("POST", caso.id, { secciones: ["hechos"] }), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(400);
    });

    // ── SPEC-373 · I-266 · colegio vencido NO puede EMITIR ───────────────────
    // El sello (SPEC-234) es una promesa de vigencia futura: el rector firma un
    // documento que un tercero podrá verificar mañana. Emitirlo desde un colegio
    // con la ventana vencida rompe esa promesa. Antes de este SPEC no había
    // guard — solo `verifyAuth` — y un colegio vencido firmaba con normalidad
    // (INF-2026-0002 emitido en el hallazgo de Calidad).
    it("I-266: colegio VENCIDO → 403 con mensaje claro, y NO se creó InformeCaso", async () => {
        const { colegio, admin, caso } = await seedCaso();
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.colegio.update({ where: { id: colegio.id }, data: { finServicio: ayer } });
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");

        const res = await POST(req("POST", caso.id, { secciones: ["hechos"] }), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.message.toLowerCase()).toContain("vencido");
        // Assert fuerte: el 403 no puede ser cosmético — nada debió quedar en la BD.
        const filas = await prisma.informeCaso.count({ where: { casoId: caso.id } });
        expect(filas, "colegio vencido no crea filas de informe").toBe(0);
    });
});

// ── SPEC-373 · I-266 · la LECTURA nunca se bloquea por vigencia ─────────────
// Candado del CEO: quien verifica un informe ya emitido es un tercero ajeno al
// cobro del colegio; bloquearlo rompe la promesa. Este test cubre el GET del
// historial (lectura autenticada) — el endpoint público `/verificar-pdf/[hash]`
// no importa por rol y ya no tiene guard, así que no requiere test acá.
describe("SPEC-373 · I-266 · lectura de informes con colegio VENCIDO", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("colegio VENCIDO puede seguir LEYENDO el historial de informes ya emitidos (GET 200)", async () => {
        const { colegio, admin, caso } = await seedCaso();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        // Emitir un informe MIENTRAS estamos vigentes (el post-emisión no requiere vigencia para leerlo).
        const emitir = await POST(req("POST", caso.id, { secciones: ["hechos"] }), { params: Promise.resolve({ id: caso.id }) });
        expect(emitir.status).toBe(201);

        // Ahora el colegio vence.
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 1);
        await prisma.colegio.update({ where: { id: colegio.id }, data: { finServicio: ayer } });

        const res = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status, "leer el historial no se bloquea por vigencia").toBe(200);
        const body = await res.json();
        expect(body.informes.length).toBeGreaterThanOrEqual(1);
    });
});

describe("GET /api/colegio/casos/[id]/informes (SPEC-351 · historial)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("lista los informes en orden descendente", async () => {
        const { admin, caso } = await seedCaso();
        mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
        await POST(req("POST", caso.id, { secciones: ["hechos"] }), { params: Promise.resolve({ id: caso.id }) });
        await POST(req("POST", caso.id, { secciones: ["hechos"] }), { params: Promise.resolve({ id: caso.id }) });

        const res = await GET(req("GET", caso.id), { params: Promise.resolve({ id: caso.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.informes).toHaveLength(2);
        expect(body.informes[0].correlativo).toMatch(/-0002$/);
        expect(body.informes[1].correlativo).toMatch(/-0001$/);
    });
});

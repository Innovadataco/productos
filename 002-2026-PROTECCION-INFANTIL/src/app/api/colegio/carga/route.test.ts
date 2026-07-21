import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as GETPlantilla } from "./plantilla/route";
import { POST as POSTValidar } from "./validar/route";
import { POST as POSTConfirmar } from "./confirmar/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearTokenUsuario,
    crearColegioConAdmin,
    crearUsuario,
    crearPlataforma,
} from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function csvBuffer(csv: string): ArrayBuffer {
    return new TextEncoder().encode(csv).buffer as ArrayBuffer;
}

function buildMultipartRequest(
    url: string,
    fields: { name: string; filename?: string; contentType?: string; value: string }[],
    token?: string
): Request {
    const boundary = `formdata${Date.now()}${Math.random().toString(36).slice(2)}`;
    const lines: string[] = [];
    for (const field of fields) {
        lines.push(`--${boundary}`);
        const disposition = field.filename
            ? `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"`
            : `Content-Disposition: form-data; name="${field.name}"`;
        lines.push(disposition);
        if (field.contentType) lines.push(`Content-Type: ${field.contentType}`);
        lines.push("");
        lines.push(field.value);
    }
    lines.push(`--${boundary}--`);
    const body = lines.join("\r\n");
    const headers: Record<string, string> = { "Content-Type": `multipart/form-data; boundary=${boundary}` };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { method: "POST", headers, body });
}

function request(method: string, url: string, body: unknown, token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    let bodyInit: BodyInit | null = null;
    if (body instanceof FormData) {
        bodyInit = body;
    } else if (body !== null && body !== undefined) {
        headers["Content-Type"] = "application/json";
        bodyInit = JSON.stringify(body);
    }
    return new Request(url, {
        method,
        headers,
        body: bodyInit,
    });
}

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

const COLUMNAS = [
    "nombre_curso",
    "grado",
    "anio_lectivo",
    "nombre_alumno",
    "tipo_identificador",
    "valor_identificador",
    "etiqueta_relacion",
    "plataforma",
];

const CSV_VALIDO = [
    COLUMNAS.join(","),
    "6A,Sexto,2026,María Gómez,telefono,+573001234567,ALUMNO,",
    "6A,Sexto,2026,Carlos Ruiz,email,carlos@example.com,PADRE,",
].join("\n");

const CSV_INVALIDO = [
    COLUMNAS.join(","),
    "6A,Sexto,2026,,telefono,+573001234567,ALUMNO,",
].join("\n");

describe("/api/colegio/carga", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    describe("GET /plantilla", () => {
        it("SCHOOL_ADMIN descarga plantilla CSV", async () => {
            await setupSchoolAdmin();
            const res = await GETPlantilla(request("GET", "http://localhost:5005/api/colegio/carga/plantilla", undefined, mockToken));
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain("text/csv");
            const text = await res.text();
            expect(text).toContain("nombre_curso");
            expect(text).toContain("María Gómez");
        });

        it("ADMIN no puede descargar plantilla", async () => {
            const admin = await crearUsuario("ADMIN");
            mockToken = await crearTokenUsuario(admin.id, "ADMIN");
            const res = await GETPlantilla(request("GET", "http://localhost:5005/api/colegio/carga/plantilla", undefined, mockToken));
            expect(res.status).toBe(403);
        });
    });

    describe("POST /validar", () => {
        it("SCHOOL_ADMIN valida CSV válido y recibe token", async () => {
            await setupSchoolAdmin();
            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );

            const res = await POSTValidar(req);
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.valido).toBe(true);
            expect(json.totalFilas).toBe(2);
            expect(json.filasValidas).toBe(2);
            expect(json.errores).toHaveLength(0);
            expect(json.tokenConfirmacion).toBeTruthy();
            expect(json.resumen.cursos).toBe(1);
            expect(json.resumen.alumnos).toBe(2);
            expect(json.resumen.identificadores).toBe(2);
        });

        it("SCHOOL_ADMIN recibe errores de fila sin token", async () => {
            await setupSchoolAdmin();
            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_INVALIDO }],
                mockToken
            );

            const res = await POSTValidar(req);
            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.valido).toBe(false);
            expect(json.errores).toHaveLength(1);
            expect(json.errores[0].campos).toContain("nombre_alumno");
            expect(json.tokenConfirmacion).toBeNull();
        });

        it("rechaza archivo con extensión no soportada", async () => {
            await setupSchoolAdmin();
            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.pdf", contentType: "application/pdf", value: "contenido" }],
                mockToken
            );

            const res = await POSTValidar(req);
            expect(res.status).toBe(400);
        });

        it("rechaza archivo que excede tope de filas", async () => {
            await setupSchoolAdmin();
            const lineas = [COLUMNAS.join(",")];
            for (let i = 0; i < 501; i++) {
                lineas.push(`6A,Sexto,2026,Alumno ${i},telefono,+57300${i},ALUMNO,`);
            }
            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: lineas.join("\n") }],
                mockToken
            );

            const res = await POSTValidar(req);
            expect(res.status).toBe(400);
            const json = await res.json();
            expect(json.error.message).toContain("límite");
        });

        it("ADMIN no puede validar", async () => {
            const admin = await crearUsuario("ADMIN");
            mockToken = await crearTokenUsuario(admin.id, "ADMIN");
            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );

            const res = await POSTValidar(req);
            expect(res.status).toBe(403);
        });
    });

    describe("POST /confirmar", () => {
        it("SCHOOL_ADMIN confirma carga válida", async () => {
            await setupSchoolAdmin();
            const reqValidar = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );

            const validarRes = await POSTValidar(reqValidar);
            const validarJson = await validarRes.json();

            const confirmarRes = await POSTConfirmar(
                request("POST", "http://localhost:5005/api/colegio/carga/confirmar", { tokenConfirmacion: validarJson.tokenConfirmacion }, mockToken)
            );
            expect(confirmarRes.status).toBe(201);
            const confirmarJson = await confirmarRes.json();
            expect(confirmarJson.resumen.cursosCreados).toBe(1);
            expect(confirmarJson.resumen.alumnosCreados).toBe(2);
            expect(confirmarJson.resumen.identificadoresCreados).toBe(2);

            const audit = await prisma.auditLog.findFirst({
                where: { accion: "COLEGIO_CARGA_MASIVA" },
            });
            expect(audit).not.toBeNull();
        });

        it("confirmar con token inválido devuelve 400", async () => {
            await setupSchoolAdmin();
            const res = await POSTConfirmar(
                request("POST", "http://localhost:5005/api/colegio/carga/confirmar", { tokenConfirmacion: "invalid-token" }, mockToken)
            );
            expect(res.status).toBe(400);
        });

        it("confirmar con token de otro colegio devuelve 403", async () => {
            const { admin: admin1 } = await setupSchoolAdmin();
            const reqValidar = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );

            const validarRes = await POSTValidar(reqValidar);
            const validarJson = await validarRes.json();

            const { admin: admin2 } = await crearColegioConAdmin();
            mockToken = await crearTokenUsuario(admin2.id, "SCHOOL_ADMIN");

            const res = await POSTConfirmar(
                request("POST", "http://localhost:5005/api/colegio/carga/confirmar", { tokenConfirmacion: validarJson.tokenConfirmacion }, mockToken)
            );
            expect(res.status).toBe(403);
        });

        it("segunda confirmación es idempotente", async () => {
            const { colegio } = await setupSchoolAdmin();
            const reqValidar = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );

            const validarRes = await POSTValidar(reqValidar);
            const validarJson = await validarRes.json();

            await POSTConfirmar(
                request("POST", "http://localhost:5005/api/colegio/carga/confirmar", { tokenConfirmacion: validarJson.tokenConfirmacion }, mockToken)
            );
            const res2 = await POSTConfirmar(
                request("POST", "http://localhost:5005/api/colegio/carga/confirmar", { tokenConfirmacion: validarJson.tokenConfirmacion }, mockToken)
            );
            expect(res2.status).toBe(201);
            const json2 = await res2.json();
            expect(json2.resumen.cursosReutilizados).toBe(1);
            expect(json2.resumen.alumnosReutilizados).toBe(2);
            expect(json2.resumen.identificadoresReutilizados).toBe(2);
            expect(json2.resumen.alumnosCreados).toBe(0);

            const alumnos = await prisma.alumno.findMany({ where: { colegioId: colegio.id } });
            expect(alumnos).toHaveLength(2);
        });
    });

    describe("aislamiento y permisos", () => {
        it("SCHOOL_ADMIN con colegio vencido no puede validar", async () => {
            const { admin, colegio } = await setupSchoolAdmin();
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            await prisma.colegio.update({ where: { id: colegio.id }, data: { finServicio: ayer } });

            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );
            const res = await POSTValidar(req);
            expect(res.status).toBe(403);
        });

        it("PARENT no puede validar", async () => {
            const parent = await crearUsuario("PARENT");
            mockToken = await crearTokenUsuario(parent.id, "PARENT");
            const req = buildMultipartRequest(
                "http://localhost:5005/api/colegio/carga/validar",
                [{ name: "archivo", filename: "carga.csv", contentType: "text/csv", value: CSV_VALIDO }],
                mockToken
            );
            const res = await POSTValidar(req);
            expect(res.status).toBe(403);
        });
    });
});

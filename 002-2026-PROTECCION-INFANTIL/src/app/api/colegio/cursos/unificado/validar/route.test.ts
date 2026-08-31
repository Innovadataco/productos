import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST as POSTValidar } from "./route";
import { GET as GETPlantilla } from "../plantilla/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearTokenUsuario, crearColegioConAdmin, crearPlataforma } from "@/lib/reporte-test-utils";

/**
 * SPEC-146 (T003, FR-003/FR-008) — dry-run del wizard: reusa parser+validator,
 * NO persiste nada (ni sesión roster), identificador opcional, columnas de
 * acudiente, y plantilla descargable con esas columnas.
 */

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function buildMultipartRequest(url: string, csv: string | null, token?: string): Request {
    const boundary = `formdata${Date.now()}${Math.random().toString(36).slice(2)}`;
    const lines: string[] = [];
    if (csv !== null) {
        lines.push(`--${boundary}`);
        lines.push('Content-Disposition: form-data; name="archivo"; filename="lista.csv"');
        lines.push("Content-Type: text/csv");
        lines.push("");
        lines.push(csv);
    }
    lines.push(`--${boundary}--`);
    const headers: Record<string, string> = { "Content-Type": `multipart/form-data; boundary=${boundary}` };
    if (token) headers.cookie = `token=${token}`;
    return new Request(url, { method: "POST", headers, body: lines.join("\r\n") });
}

const URL_VALIDAR = "http://localhost:5005/api/colegio/cursos/unificado/validar";
const URL_PLANTILLA = "http://localhost:5005/api/colegio/cursos/unificado/plantilla";

const COLUMNAS = [
    "nombre_curso",
    "grado",
    "anio_lectivo",
    "nombre_alumno",
    "apellidos_alumno",
    // SPEC-320 (§2.2-bis): documento del alumno obligatorio en la plantilla.
    "documento_tipo_alumno",
    "documento_numero_alumno",
    "tipo_identificador",
    "valor_identificador",
    "etiqueta_relacion",
    "plataforma",
    "acudiente_nombre",
    "acudiente_relacion",
    "acudiente_telefono",
    "acudiente_email",
];

// 5 filas: 3 con identificador (una con acudiente completo), 1 SIN identificador
// (válida en el wizard), 1 sin apellidos (problema). Todas con documento (§2.2-bis).
const CSV_MIXTO = [
    COLUMNAS.join(","),
    "6A,Sexto,2026,María,Gómez,TI,D1,telefono,+573001234567,ESTUDIANTE,WhatsApp,Laura Gómez,Madre,+573101112131,laura@example.com",
    "6A,Sexto,2026,Carlos,Ruiz,TI,D2,email,carlos@example.com,PADRE,,,,,",
    "6A,Sexto,2026,Ana,Torres,TI,D3,nick,gamer777,ESTUDIANTE,,,,,",
    "6A,Sexto,2026,Luis,Pérez,TI,D4,,,,,,,,",
    "6A,Sexto,2026,SinApellido,,TI,D5,telefono,+573005554444,ESTUDIANTE,,,,,",
].join("\n");

async function setupSchoolAdmin() {
    const { admin, colegio } = await crearColegioConAdmin();
    mockToken = await crearTokenUsuario(admin.id, "SCHOOL_ADMIN");
    return { admin, colegio };
}

async function conteoPersistencia(colegioId: string) {
    const [cursos, estudiantes, identificadores, sesiones] = await Promise.all([
        prisma.curso.count({ where: { colegioId } }),
        prisma.estudiante.count({ where: { colegioId } }),
        prisma.identificadorEstudiante.count({ where: { estudiante: { colegioId } } }),
        prisma.cargaRosterSesion.count(),
    ]);
    return { cursos, estudiantes, identificadores, sesiones };
}

describe("/api/colegio/cursos/unificado/validar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("dry-run: devuelve filas válidas + problemas y NO persiste nada (ni sesión roster)", async () => {
        const { colegio } = await setupSchoolAdmin();
        await crearPlataforma("whatsapp", "WhatsApp");
        const antes = await conteoPersistencia(colegio.id);

        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, CSV_MIXTO, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.filasValidas).toHaveLength(4);
        expect(json.problemas).toHaveLength(1);
        expect(json.problemas[0].fila).toBe(6);
        expect(json.problemas[0].mensaje).toContain("Falta el apellido del estudiante");
        expect(json.resumen).toEqual({ estudiantes: 4, identificadores: 3, conProblemas: 1, total: 5 });

        // La fila sin identificador es válida (diferencia con el pipeline viejo).
        const luis = json.filasValidas.find((f: { estudiante: { nombre: string } }) => f.estudiante.nombre === "Luis");
        expect(luis.identificador).toBeNull();

        // La plataforma se resolvió y el acudiente llegó normalizado.
        const maria = json.filasValidas.find((f: { estudiante: { nombre: string } }) => f.estudiante.nombre === "María");
        expect(maria.identificador.tipo).toBe("telefono");
        expect(maria.acudiente).toEqual({
            nombre: "Laura Gómez",
            relacion: "Madre",
            telefono: "+573101112131",
            email: "laura@example.com",
        });

        // Nada se persistió: cero cursos/estudiantes/identificadores/sesiones nuevas.
        expect(await conteoPersistencia(colegio.id)).toEqual(antes);
    });

    it("marca la fila con acudiente incompleto (falta el nombre) con mensaje humano", async () => {
        await setupSchoolAdmin();
        const csv = [
            COLUMNAS.join(","),
            "6A,Sexto,2026,María,Gómez,TI,D129,,,,,,Madre,,",
        ].join("\n");

        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, csv, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.filasValidas).toHaveLength(0);
        expect(json.problemas).toHaveLength(1);
        expect(json.problemas[0].campos).toContain("acudiente_nombre");
        expect(json.problemas[0].mensaje).toBe("Falta el nombre del acudiente");
    });

    it("marca el email del acudiente que no parece email", async () => {
        await setupSchoolAdmin();
        const csv = [
            COLUMNAS.join(","),
            "6A,Sexto,2026,María,Gómez,TI,D145,,,,,Laura Gómez,Madre,,juan.perez",
        ].join("\n");

        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, csv, mockToken));
        const json = await res.json();
        expect(json.problemas).toHaveLength(1);
        expect(json.problemas[0].mensaje).toContain("no parece ser un email");
    });

    it("marca el estudiante repetido sin identificador", async () => {
        await setupSchoolAdmin();
        const csv = [
            COLUMNAS.join(","),
            "6A,Sexto,2026,María,Gómez,TI,D158,,,,,,,,",
            "6A,Sexto,2026,María,Gómez,TI,D158,,,,,,,,",
        ].join("\n");

        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, csv, mockToken));
        const json = await res.json();
        expect(json.filasValidas).toHaveLength(1);
        expect(json.problemas).toHaveLength(1);
        expect(json.problemas[0].mensaje).toContain("repetido");
    });

    it("400 con mensaje humano cuando faltan encabezados", async () => {
        await setupSchoolAdmin();
        const csv = ["nombre_curso,nombre_alumno", "6A,María"].join("\n");

        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, csv, mockToken));
        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error.message).toContain("Columna requerida faltante");
    });

    it("400 cuando no llega el archivo", async () => {
        await setupSchoolAdmin();
        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, null, mockToken));
        expect(res.status).toBe(400);
    });

    it("acepta plantillas viejas sin columnas de acudiente", async () => {
        await setupSchoolAdmin();
        // Base + documento (§2.2-bis), SIN las columnas de acudiente.
        const csv = [
            COLUMNAS.slice(0, 11).join(","),
            "6A,Sexto,2026,María,Gómez,TI,D189,telefono,+573001234567,ESTUDIANTE,",
        ].join("\n");

        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, csv, mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.filasValidas).toHaveLength(1);
        expect(json.filasValidas[0].acudiente).toBeNull();
    });

    it("rechaza sin autenticación", async () => {
        const res = await POSTValidar(buildMultipartRequest(URL_VALIDAR, CSV_MIXTO));
        expect(res.status).toBe(401);
    });
});

describe("/api/colegio/cursos/unificado/plantilla", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("descarga la plantilla con las columnas de acudiente", async () => {
        await setupSchoolAdmin();
        const res = await GETPlantilla(
            new Request(URL_PLANTILLA, { headers: { cookie: `token=${mockToken}` } })
        );
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/csv");
        expect(res.headers.get("content-disposition")).toContain("plantilla-lista-estudiantes.csv");
        const text = await res.text();
        expect(text).toContain("acudiente_nombre");
        expect(text).toContain("acudiente_relacion");
        expect(text).toContain("acudiente_telefono");
        expect(text).toContain("acudiente_email");
        expect(text).toContain("apellidos_alumno");
    });
});

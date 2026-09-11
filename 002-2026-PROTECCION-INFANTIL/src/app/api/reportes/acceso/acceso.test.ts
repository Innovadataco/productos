import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ScoreGravedad } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";
import { sellarTextoNuevo } from "@/lib/reporte-texto-contenido";
import { conActor } from "@/lib/auditoria-lectura/actor";
import { descifrarCampoReporte } from "@/lib/dal/services/descifrar-contenido";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearRequestAutenticado,
} from "@/lib/reporte-test-utils";
import { POST as POST_SOLICITAR } from "@/app/api/padre/expedientes/[id]/solicitar-acceso/route";
import { GET as GET_ACCESOS } from "@/app/api/padre/expedientes/[id]/accesos/route";
import { POST as POST_CANJEAR } from "./canjar/route";
import { GET as GET_VER } from "./ver/route";
import { GET as GET_DETALLE_ADMIN } from "@/app/api/admin/reportes-revision/[id]/route";
import { GET as GET_ACCESOS_TEXTO } from "@/app/api/admin/reportes/[id]/accesos-texto/route";

// Textos SEMILLA por evento: `texto` (trabajo, lo ÚNICO que puede salir por el pase)
// vs `textoOriginal` (evidencia interna, jamás por esta vía). Valores distintos y
// reconocibles para que el candado texto-only pueda afirmar la NO-fuga del original.
const TEXTO_EVENTO_REPORTE = "TRABAJO · evento de origen reporte";
const ORIGINAL_EVENTO_REPORTE = "ORIGINAL-SECRETO · evento de origen reporte (no debe salir)";
const TEXTO_EVENTO_MANUAL = "TRABAJO · anotado por la familia";
const ORIGINAL_EVENTO_MANUAL = "ORIGINAL-SECRETO · anotado por la familia (no debe salir)";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

async function crearReporteDePrueba(usuarioId?: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return crearReporteFixture(prisma, {
        data: {
            identificador: `+57300AC${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            plataformaId: plataforma!.id,
            texto: "Relato de prueba del flujo de código temporal",
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: !usuarioId,
            ...(usuarioId ? { usuarioId } : {}),
            estado: "REVISION_MANUAL",
        },
    });
}

async function autenticar(rol: "PARENT" | "PROFESIONAL" | "ADMIN" | "OPERADOR") {
    const usuario = await crearUsuario(rol);
    activeToken = await crearTokenUsuario(usuario.id, rol);
    return usuario;
}

/**
 * SPEC-610: un EXPEDIENTE del padre con DOS eventos — uno de origen REPORTE (con
 * clasificación → lleva chip de gravedad, D-130) y uno MANUAL (sin `reporteId`,
 * «Anotado por la familia» → sin chip). Cada evento tiene su PROPIO contenido
 * cifrado (1:1), con `texto` (trabajo) distinto de `textoOriginal` (evidencia)
 * para poder afirmar que la vía del pase NUNCA devuelve el original.
 */
async function crearExpedienteDePrueba(padreId: string, opciones: { gravedad?: ScoreGravedad } = {}) {
    const plataforma = await prisma.plataforma.findUniqueOrThrow({ where: { clave: "whatsapp" } });
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300EXP${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
            fechaApertura: new Date("2026-09-01T09:00:00Z"),
            estado: "ACTIVO",
            scoreGravedadActual: opciones.gravedad ?? "AMARILLO",
        },
    });
    // Evento 1 · origen REPORTE: FK a un Reporte real + su PROPIO contenido cifrado
    // (el evento nunca comparte fila de contenido con su reporte, S-D · D-117).
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: expediente.identificadorReportado,
            plataformaId: plataforma.id,
            texto: "Relato del reporte (fuente del evento 1)",
            fechaIncidente: new Date("2026-09-01T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: padreId,
            estado: "REVISION_MANUAL",
        },
    });
    const contenidoReporte = await prisma.$transaction((tx) =>
        sellarTextoNuevo(tx, { texto: TEXTO_EVENTO_REPORTE, textoOriginal: ORIGINAL_EVENTO_REPORTE })
    );
    const eventoReporte = await prisma.eventoExpediente.create({
        data: {
            expedienteId: expediente.id,
            ordenSecuencial: 1,
            reporteId: reporte.id,
            contenidoId: contenidoReporte.contenidoId,
            categoriaDetectada: "CONTACTO_INSISTENTE",
            confianzaClasificacion: 0.9,
            fechaEvento: new Date("2026-09-01T10:05:00Z"),
        },
    });
    // Evento 2 · MANUAL: sin `reporteId` ni clasificación (D-130).
    const contenidoManual = await prisma.$transaction((tx) =>
        sellarTextoNuevo(tx, { texto: TEXTO_EVENTO_MANUAL, textoOriginal: ORIGINAL_EVENTO_MANUAL })
    );
    const eventoManual = await prisma.eventoExpediente.create({
        data: {
            expedienteId: expediente.id,
            ordenSecuencial: 2,
            contenidoId: contenidoManual.contenidoId,
            // «Envenenamos» la categoría de un evento MANUAL: en la práctica un manual
            // no se clasifica, pero sembrar un valor no-nulo hace que el candado D-130
            // (categoria === null) sea PORTANTE — prueba que el servicio la anula por ser
            // manual, no que la fila viniera vacía de casualidad.
            categoriaDetectada: "CATEGORIA-FANTASMA-NO-DEBE-SALIR",
            fechaEvento: new Date("2026-09-02T08:00:00Z"),
        },
    });
    return { expediente, eventoReporte, eventoManual };
}

/** Un evento tal como llega en el JSON de `/ver` (la fecha viaja serializada). */
interface EventoVer {
    eventoId: string;
    fecha: string;
    texto: string;
    esManual: boolean;
    categoria: string | null;
}

/** Solicita (como el padre autenticado) y canjea (como profesional) → token de sesión. */
async function abrirSesionSobre(expedienteId: string): Promise<string> {
    const resSol = await POST_SOLICITAR(
        crearRequestAutenticado("POST", `http://localhost/api/padre/expedientes/${expedienteId}/solicitar-acceso`, {}),
        { params: Promise.resolve({ id: expedienteId }) }
    );
    const { codigo } = await resSol.json();
    await autenticar("PROFESIONAL");
    const resCanje = await POST_CANJEAR(
        crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
    );
    const { tokenSesion } = await resCanje.json();
    return tokenSesion as string;
}

function requestVer(tokenSesion: string): Request {
    return new Request(`http://localhost/api/reportes/acceso/ver?token=${tokenSesion}`, {
        headers: { cookie: `token=${activeToken}` },
    });
}

describe("SPEC-610 (I-372) · el pase abre el EXPEDIENTE, no un reporte suelto", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    it("solicitar: el padre dueño del expediente recibe un pase de 8 caracteres, hasheado en reposo", async () => {
        const padre = await autenticar("PARENT");
        const { expediente } = await crearExpedienteDePrueba(padre.id);

        const res = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/padre/expedientes/${expediente.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: expediente.id }) }
        );
        expect(res.status).toBe(201);
        const data = await res.json();
        expect(data.codigo).toMatch(/^[A-Z2-9]{8}$/);
        expect(new Date(data.vigenteHasta).getTime()).toBeGreaterThan(Date.now());

        const paseDb = await prisma.codigoAccesoContenido.findFirstOrThrow({ where: { expedienteId: expediente.id } });
        expect(paseDb.codigoHash).not.toContain(data.codigo);
        expect(paseDb.codigoHash).toMatch(/^[0-9a-f]{64}$/);
        // Ninguna columna guarda el pase en claro.
        expect(JSON.stringify(paseDb)).not.toContain(data.codigo);

        // AuditLog del ciclo de vida (con hash, sin pase en claro) — sujeto = Expediente.
        const audit = await prisma.auditLog.findFirstOrThrow({ where: { accion: "CODIGO_ACCESO_SOLICITADO" } });
        expect(audit.usuarioId).toBe(padre.id);
        expect(audit.recursoId).toBe(expediente.id);
    });

    it("solicitar: expediente ajeno → 404 (sin revelar existencia ni titularidad)", async () => {
        await autenticar("PARENT");
        const otroPadre = await crearUsuario("PARENT");
        const { expediente: ajeno } = await crearExpedienteDePrueba(otroPadre.id);

        const res = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/padre/expedientes/${ajeno.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: ajeno.id }) }
        );
        expect(res.status).toBe(404);
        expect(await prisma.codigoAccesoContenido.count()).toBe(0);
    });

    it("solicitar: una nueva solicitud expira el pase activo anterior", async () => {
        const padre = await autenticar("PARENT");
        const { expediente } = await crearExpedienteDePrueba(padre.id);

        const r1 = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/padre/expedientes/${expediente.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: expediente.id }) }
        );
        const codigo1 = (await r1.json()).codigo as string;

        await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/padre/expedientes/${expediente.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: expediente.id }) }
        );

        // El pase anterior quedó expirado: canjearlo da 410.
        await autenticar("PROFESIONAL");
        const resCanje = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo: codigo1 })
        );
        expect(resCanje.status).toBe(410);
    });

    it("canjar: el profesional abre la sesión de 15 min y recibe el expedienteId; un solo canje (409)", async () => {
        const padre = await autenticar("PARENT");
        const { expediente } = await crearExpedienteDePrueba(padre.id);
        const resSol = await POST_SOLICITAR(
            crearRequestAutenticado("POST", `http://localhost/api/padre/expedientes/${expediente.id}/solicitar-acceso`, {}),
            { params: Promise.resolve({ id: expediente.id }) }
        );
        const { codigo } = await resSol.json();

        const profesional = await autenticar("PROFESIONAL");
        const resCanje = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
        );
        expect(resCanje.status).toBe(200);
        const sesion = await resCanje.json();
        expect(sesion.tokenSesion).toMatch(/^[0-9a-f-]{36}$/);
        // El canje devuelve el EXPEDIENTE (no un reporte): el pase abre el caso entero.
        expect(sesion.expedienteId).toBe(expediente.id);
        expect(sesion).not.toHaveProperty("reporteId");
        expect(new Date(sesion.expiraEn).getTime() - Date.now()).toBeLessThanOrEqual(15 * 60 * 1000);

        // AuditLog del canje con AMBOS responsables.
        const audit = await prisma.auditLog.findFirstOrThrow({ where: { accion: "CODIGO_ACCESO_CANJEADO" } });
        expect(audit.usuarioId).toBe(profesional.id);

        // Reintento con el mismo pase → 409 (un solo canje).
        activeToken = null;
        await autenticar("PROFESIONAL");
        const resReintento = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo })
        );
        expect(resReintento.status).toBe(409);
    });

    it("canjar: pase inexistente → 404; rol no autorizado (OPERADOR) → 403", async () => {
        await autenticar("PROFESIONAL");
        const res404 = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo: "ZZZZ9999" })
        );
        expect(res404.status).toBe(404);

        activeToken = null;
        await autenticar("OPERADOR");
        const res403 = await POST_CANJEAR(
            crearRequestAutenticado("POST", "http://localhost/api/reportes/acceso/canjar", { codigo: "ZZZZ9999" })
        );
        expect(res403.status).toBe(403);
    });

    it("ver: la sesión devuelve TODOS los eventos del expediente y audita como actor EXTERNO", async () => {
        const padre = await autenticar("PARENT");
        const { expediente, eventoReporte, eventoManual } = await crearExpedienteDePrueba(padre.id);
        const tokenSesion = await abrirSesionSobre(expediente.id);

        const resVer = await GET_VER(requestVer(tokenSesion));
        expect(resVer.status).toBe(200);
        const data = await resVer.json();
        const eventos = data.eventos as EventoVer[];
        // Los DOS eventos del expediente (D-123: el pase abre el caso, no un relato).
        expect(eventos.map((e) => e.eventoId).sort()).toEqual([eventoReporte.id, eventoManual.id].sort());
        expect(data.gravedad).toBe("AMARILLO");

        // Una fila de auditoría EXTERNO por evento leído.
        const auditorias = await prisma.lecturaReporte.findMany({ where: { codigoAccesoId: { not: null } } });
        expect(auditorias.length).toBe(2);
        expect(auditorias.every((a) => a.tipoActor === "EXTERNO")).toBe(true);
    });

    it("ver: sesión vencida → 410 con mensaje claro; token inválido → 400", async () => {
        const padre = await autenticar("PARENT");
        const { expediente } = await crearExpedienteDePrueba(padre.id);
        const tokenSesion = await abrirSesionSobre(expediente.id);

        // Vencer la sesión directamente en la fila.
        await prisma.codigoAccesoContenido.updateMany({
            where: { expedienteId: expediente.id },
            data: { sesionExpiraEn: new Date(Date.now() - 1000) },
        });
        const resVencida = await GET_VER(requestVer(tokenSesion));
        expect(resVencida.status).toBe(410);

        const resTokenInvalido = await GET_VER(
            new Request("http://localhost/api/reportes/acceso/ver?token=no-es-uuid", {
                headers: { cookie: `token=${activeToken}` },
            })
        );
        expect(resTokenInvalido.status).toBe(400);
    });
});

describe("SPEC-610 · candados del pase (I-372 · gates del CEO)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    // GATE 1 · el alcance de lo que abre el pase se DERIVA DEL TOKEN, nunca del cliente.
    // El endpoint /ver no acepta expediente ni evento: solo el token de sesión. Este
    // candado prueba la consecuencia observable — el pase de un expediente jamás trae
    // los eventos de otro. Mutar leerExpedienteConSesion para leer todos los eventos
    // (ignorando registro.expediente) lo pone rojo.
    it("GATE alcance: el pase de un expediente NO abre los eventos de otro", async () => {
        const padreX = await autenticar("PARENT");
        const x = await crearExpedienteDePrueba(padreX.id);
        const padreY = await crearUsuario("PARENT");
        const y = await crearExpedienteDePrueba(padreY.id);

        // activeToken sigue siendo padreX → puede solicitar sobre SU expediente.
        const tokenSesion = await abrirSesionSobre(x.expediente.id);
        const data = await (await GET_VER(requestVer(tokenSesion))).json();
        const ids = (data.eventos as EventoVer[]).map((e) => e.eventoId);

        expect(ids.sort()).toEqual([x.eventoReporte.id, x.eventoManual.id].sort());
        expect(ids).not.toContain(y.eventoReporte.id);
        expect(ids).not.toContain(y.eventoManual.id);
    });

    // GATE 2 · UNA fila de LecturaReporte por EVENTO leído (por su eventoId), no una por
    // sesión ni una por campo. Mutar el servicio para auditar una sola vez por sesión —
    // o para descifrar además "textoOriginal" (dos filas por evento) — lo pone rojo.
    it("GATE auditoría: una fila por evento leído, ligada a su eventoId y al pase", async () => {
        const padre = await autenticar("PARENT");
        const { expediente, eventoReporte, eventoManual } = await crearExpedienteDePrueba(padre.id);
        const tokenSesion = await abrirSesionSobre(expediente.id);
        await GET_VER(requestVer(tokenSesion));

        const pase = await prisma.codigoAccesoContenido.findFirstOrThrow({ where: { expedienteId: expediente.id } });
        const filas = await prisma.lecturaReporte.findMany({ where: { codigoAccesoId: pase.id } });

        expect(filas.length).toBe(2);
        expect(filas.map((f) => f.eventoId).sort()).toEqual([eventoReporte.id, eventoManual.id].sort());
        expect(filas.every((f) => f.tipoActor === "EXTERNO")).toBe(true);
        expect(filas.every((f) => f.campo === "texto")).toBe(true);
        // Ninguna fila de esta sesión audita el original.
        expect(filas.some((f) => f.campo === "textoOriginal")).toBe(false);
    });

    // GATE 3 · un lector EXTERNO NO puede descifrar sin dejar rastro. La única vía que
    // salta la auditoría (`registrarLectura:false`, pensada para RENDER interno) DEBE
    // lanzar si el actor es EXTERNO. Quitar esa guarda en descifrar-contenido.ts hace
    // que la lectura muda resuelva con texto y CERO filas → este candado se pone rojo.
    it("GATE evasión: EXTERNO con registrarLectura:false LANZA (no hay lectura muda)", async () => {
        await autenticar("PARENT"); // resetea BD vía beforeEach; actor no interviene acá
        const contenido = await prisma.$transaction((tx) =>
            sellarTextoNuevo(tx, { texto: "trabajo", textoOriginal: "original-secreto" })
        );

        await expect(
            conActor({ tipoActor: "EXTERNO" }, () =>
                descifrarCampoReporte(contenido.contenidoId, "texto", { registrarLectura: false })
            )
        ).rejects.toThrow(/auditor/i);
        // La evasión no dejó ni texto ni rastro: cero filas.
        expect(await prisma.lecturaReporte.count()).toBe(0);

        // Control positivo: EXTERNO SÍ puede leer — dejando SU fila.
        const texto = await conActor({ tipoActor: "EXTERNO" }, () =>
            descifrarCampoReporte(contenido.contenidoId, "texto")
        );
        expect(texto).toBe("trabajo");
        expect(await prisma.lecturaReporte.count()).toBe(1);
    });

    // GATE 4 · por el pase sale SOLO `texto` (trabajo), JAMÁS `textoOriginal` (evidencia).
    // Cada evento se sembró con original distinto y reconocible: si el servicio leyera el
    // original, aparecería en el JSON. Mutar "texto" → "textoOriginal" lo pone rojo.
    it("GATE texto-only: la vía del pase nunca devuelve el textoOriginal", async () => {
        const padre = await autenticar("PARENT");
        const { expediente } = await crearExpedienteDePrueba(padre.id);
        const tokenSesion = await abrirSesionSobre(expediente.id);

        const data = await (await GET_VER(requestVer(tokenSesion))).json();
        const eventos = data.eventos as EventoVer[];
        const textos = eventos.map((e) => e.texto);
        expect(textos).toContain(TEXTO_EVENTO_REPORTE);
        expect(textos).toContain(TEXTO_EVENTO_MANUAL);
        for (const ev of eventos) expect(ev).not.toHaveProperty("textoOriginal");

        const crudo = JSON.stringify(data);
        expect(crudo).not.toContain(ORIGINAL_EVENTO_REPORTE);
        expect(crudo).not.toContain(ORIGINAL_EVENTO_MANUAL);
        // Y la auditoría tampoco registra lectura del original por esta vía.
        expect(await prisma.lecturaReporte.count({ where: { campo: "textoOriginal" } })).toBe(0);
    });

    // GATE 5 (contrato de datos D-130) · el evento MANUAL no lleva clasificación (sin chip
    // de gravedad en la UI); el de origen REPORTE sí. Mutar el servicio para copiar la
    // categoría a los manuales — o marcarlos no-manuales — lo pone rojo. El candado del
    // CHIP en sí vive en el render del profesional.
    it("GATE D-130: el evento manual no trae categoría; el de reporte sí", async () => {
        const padre = await autenticar("PARENT");
        const { expediente, eventoReporte, eventoManual } = await crearExpedienteDePrueba(padre.id);
        const tokenSesion = await abrirSesionSobre(expediente.id);

        const data = await (await GET_VER(requestVer(tokenSesion))).json();
        const eventos = data.eventos as EventoVer[];
        const manual = eventos.find((e) => e.eventoId === eventoManual.id);
        const deReporte = eventos.find((e) => e.eventoId === eventoReporte.id);

        expect(manual?.esManual).toBe(true);
        expect(manual?.categoria).toBeNull();
        expect(deReporte?.esManual).toBe(false);
        expect(deReporte?.categoria).toBe("CONTACTO_INSISTENTE");
    });
});

describe("SPEC-610 · «quién ha leído el expediente» (/accesos, lado del padre)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    function requestAccesos(expedienteId: string): Request {
        return new Request(`http://localhost/api/padre/expedientes/${expedienteId}/accesos`, {
            headers: { cookie: `token=${activeToken}` },
        });
    }

    it("el padre dueño ve quién canjeó su pase, con metadatos y SIN contenido", async () => {
        const padre = await autenticar("PARENT");
        const tokenPadre = activeToken;
        const { expediente } = await crearExpedienteDePrueba(padre.id);

        // Un profesional canjea el pase y LEE el expediente (crea las filas de auditoría).
        const tokenSesion = await abrirSesionSobre(expediente.id);
        await GET_VER(requestVer(tokenSesion));

        // De vuelta como el padre dueño.
        activeToken = tokenPadre;
        const res = await GET_ACCESOS(requestAccesos(expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0].rol).toBe("PROFESIONAL");
        // Leyó los DOS eventos del expediente.
        expect(data.items[0].eventosLeidos).toBe(2);
        // Metadatos, jamás el relato: ni el texto de trabajo ni el original salen por acá.
        const crudo = JSON.stringify(data);
        expect(crudo).not.toContain(TEXTO_EVENTO_REPORTE);
        expect(crudo).not.toContain(TEXTO_EVENTO_MANUAL);
        expect(crudo).not.toContain(ORIGINAL_EVENTO_REPORTE);
        expect(crudo).not.toContain(ORIGINAL_EVENTO_MANUAL);
    });

    // GATE de titularidad: el historial de accesos es de CADA padre sobre SU expediente.
    // Quitar el `obtenerExpedientePorId(id, user.id)` del endpoint (o dejar de scopar por
    // titular) haría que un padre viera los accesos del expediente de otro → 200 en vez de 404.
    it("GATE titularidad: un padre NO ve los accesos del expediente de otro (404)", async () => {
        const padreDueno = await autenticar("PARENT");
        const { expediente } = await crearExpedienteDePrueba(padreDueno.id);
        await abrirSesionSobre(expediente.id); // deja un acceso real en el expediente ajeno

        // Otro padre autenticado pide los accesos del expediente ajeno.
        await autenticar("PARENT");
        const res = await GET_ACCESOS(requestAccesos(expediente.id), {
            params: Promise.resolve({ id: expediente.id }),
        });
        expect(res.status).toBe(404);
    });
});

describe("SPEC-592/594 · render del detalle admin y notificaciones al padre", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
    });

    async function sembrarReglaTextoLeido() {
        await prisma.notificacionPlantilla.create({
            data: {
                clave: "padre.reporte.texto_leido.email",
                canal: "EMAIL",
                asunto: "Aviso de lectura",
                cuerpoMarkdown: "Lectura del {{campo}} de tu reporte sobre {{identificador}}.",
                variablesSchema: {},
            },
        });
        await prisma.notificacionRegla.create({
            data: {
                evento: "padre.reporte.texto_leido",
                rol: "PARENT",
                offset: "+0m",
                canal: "EMAIL",
                plantillaClave: "padre.reporte.texto_leido.email",
            },
        });
    }

    it("SPEC-592: el GET del detalle admin es un RENDER — ni audita ni notifica", async () => {
        await sembrarReglaTextoLeido();
        const padre = await crearUsuario("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        await autenticar("ADMIN");

        const res = await GET_DETALLE_ADMIN(
            new Request(`http://localhost/api/admin/reportes-revision/${reporte.id}`, {
                headers: { cookie: `token=${activeToken}` },
            }),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.reporte.texto).toBe("Relato de prueba del flujo de código temporal");

        // El render no es una acción de lectura: cero filas de auditoría…
        expect(await prisma.lecturaReporte.count({ where: { reporteId: reporte.id } })).toBe(0);
        // …y cero notificaciones al padre (SPEC-594: rol interno lee → cero correos).
        expect(await prisma.notificacion.count({ where: { evento: "padre.reporte.texto_leido" } })).toBe(0);
    });

    it("SPEC-594: la corrección (acción interna) tampoco notifica al padre", async () => {
        await sembrarReglaTextoLeido();
        const padre = await crearUsuario("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        const admin = await autenticar("ADMIN");
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.8,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "test:spec-594",
                latenciaMs: 1,
            },
        });

        const { POST: POST_CORRECCIONES } = await import("@/app/api/admin/correcciones/route");
        const res = await POST_CORRECCIONES(
            crearRequestAutenticado("POST", "http://localhost/api/admin/correcciones", {
                reporteId: reporte.id,
                categoriaCorregida: "EXTORSION",
                comentario: "Corrección de prueba SPEC-594",
            })
        );
        expect(res.status).toBe(200);

        // Antes del fix el padre recibía DOS correos idénticos (una por cada
        // campo descifrado: texto + textoOriginal). Ahora: ninguno.
        expect(await prisma.notificacion.count({ where: { evento: "padre.reporte.texto_leido" } })).toBe(0);
        // La auditoría interna sigue viva (quién leyó qué campo y cuándo).
        const auditorias = await prisma.lecturaReporte.findMany({ where: { reporteId: reporte.id } });
        expect(auditorias.length).toBeGreaterThan(0);
        expect(auditorias.every((a) => a.usuarioId === admin.id)).toBe(true);
    });

    it("accesos-texto: el historial es visible para el operador con permiso sobre el caso", async () => {
        const padre = await crearUsuario("PARENT");
        const reporte = await crearReporteDePrueba(padre.id);
        // El operador autenticado DEBE ser el asignado al caso (puedeGestionarReporte).
        const operador = await autenticar("OPERADOR");
        await prisma.reporte.update({ where: { id: reporte.id }, data: { operadorId: operador.id } });

        // SPEC-592: el RENDER del detalle ya no audita; la fila de historial nace de
        // una acción explícita de lectura (acá: revelar el original, módulo otorgado
        // por resetDatabase).
        const { POST: POST_REVELAR } = await import("@/app/api/admin/reportes/[id]/revelar-original/route");
        const resRevelar = await POST_REVELAR(
            crearRequestAutenticado("POST", `http://localhost/api/admin/reportes/${reporte.id}/revelar-original`, {}),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(resRevelar.status).toBe(200);

        const res = await GET_ACCESOS_TEXTO(
            new Request(`http://localhost/api/admin/reportes/${reporte.id}/accesos-texto`, {
                headers: { cookie: `token=${activeToken}` },
            }),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.items).toHaveLength(1);
        expect(data.items[0].campo).toBe("textoOriginal");
        expect(data.items[0].tipoActor).toBe("PLATAFORMA");
    });
});

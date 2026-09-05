/**
 * SPEC-114 · Journey operador y comité — la revisión humana por el camino real:
 * admin crea ambos roles por la API → el operador ve su bandeja, confirma un caso y
 * escala otro → el comité lo recibe, se lo asigna y resuelve. Cierra en BD (§9):
 * transición registrada, corrección persistida, AuditLog.
 * SPEC-133 (fase 4): anonimización (PATCH del admin + validación del operador
 * asignado, los DOS caminos reales de salida de REQUIERE_ANONIMIZACION) →
 * apelaciones del comité (bandeja → tomar → resolver ACEPTADA con ocultamiento).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo } from "../seed-ciclo";
import { entrarComo, verificarAuditLog, HOME_POR_ROL, salirYExigirSesionMuerta } from "../helpers";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";
import { encryptParameter } from "@/lib/param-encryption";
import { descifrarTextoReporte } from "@/lib/texto-reporte-cifrado";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

// SPEC-133: la evidencia de apelación sembrada se cifra en disco (tmpdir por corrida,
// patrón de apelaciones/route.test.ts); la clave cae al fallback solo si el entorno no la trae.
const storageDirApelaciones = mkdtempSync(path.join(tmpdir(), "apelaciones-e2e-oc-"));
process.env.APELACIONES_STORAGE_DIR = storageDirApelaciones;
process.env.PARAM_ENCRYPTION_KEY = process.env.PARAM_ENCRYPTION_KEY || "a".repeat(32);

async function crearUsuarioInterno(adminToken: string, email: string, nombre: string, rol: "OPERADOR" | "COMITE_VALIDACION") {
    jar.set("token", { name: "token", value: adminToken });
    jar.set("__Host-token", { name: "__Host-token", value: adminToken });
    const { POST: operadoresPOST } = await import("@/app/api/admin/operadores/route");
    const res = await operadoresPOST(
        new Request("http://localhost:5005/api/admin/operadores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, nombre, rol }),
        })
    );
    expect(res.status, `el admin debe poder crear ${rol}`).toBe(201);
    const body = (await res.json()) as { operador: { id: string }; passwordTemporal: string };
    return { id: body.operador.id, email, password: body.passwordTemporal };
}

async function crearCasoRevision(operadorId: string, tag: string) {
    const datos = datosCiclo(CICLO);
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const reporte = await prisma.reporte.create({
        data: {
            identificador: datos.identificadorComun,
            plataformaId: plataforma!.id,
            texto: `${datos.textoBase} (caso ${tag})`,
            fechaIncidente: new Date("2026-07-20T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-C${CICLO}-${tag.toUpperCase()}`,
            estado: "REVISION_MANUAL",
            operadorId,
        },
    });
    await prisma.clasificacionIA.create({
        data: {
            reporteId: reporte.id,
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.55,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b",
            latenciaMs: 1000,
            categoriasSecundarias: [],
        },
    });
    return reporte;
}

async function sesionDe(usuario: { id: string; email: string; password: string }, rol: "OPERADOR" | "COMITE_VALIDACION") {
    const { POST: loginPOST } = await import("@/app/api/auth/login/route");
    const resLogin = await loginPOST(
        new Request("http://localhost:5005/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: usuario.email, password: usuario.password }),
        })
    );
    expect(resLogin.status, `login de ${rol} con su contraseña temporal`).toBe(200);
    const token = await crearTokenUsuario(usuario.id, rol);
    jar.set("token", { name: "token", value: token });
    jar.set("__Host-token", { name: "__Host-token", value: token });
    return { usuarioId: usuario.id, email: usuario.email, rol, token };
}

describe(`SPEC-114 · operador y comité (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    afterAll(() => {
        rmSync(storageDirApelaciones, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    });

    it("el operador ve su bandeja y confirma un caso (con §9)", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-oc@test.local`, "ClaveE2E-2026");
        const operador = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-op1@test.local`, "Operador E2E", "OPERADOR");
        const caso = await crearCasoRevision(operador.id, "conf");
        const sesion = await sesionDe(operador, "OPERADOR");

        // Bandeja del operador: el caso asignado aparece
        const { GET: bandejaGET } = await import("@/app/api/admin/reportes-revision/route");
        const bandeja = await bandejaGET(new Request("http://localhost:5005/api/admin/reportes-revision?page=1&pageSize=10"));
        expect(bandeja.status).toBe(200);
        const cuerpo = (await bandeja.json()) as { items?: { id: string }[]; reportes?: { id: string }[] };
        const ids = (cuerpo.items ?? cuerpo.reportes ?? []).map((r) => r.id);
        expect(ids, "el caso asignado debe aparecer en la bandeja del operador").toContain(caso.id);

        // Confirmar el caso por el camino real
        const { POST: confirmarPOST } = await import("@/app/api/admin/reportes-revision/[id]/confirmar/route");
        const res = await confirmarPOST(
            new Request(`http://localhost:5005/api/admin/reportes-revision/${caso.id}/confirmar`, { method: "POST" }),
            { params: Promise.resolve({ id: caso.id }) }
        );
        expect(res.status, "el operador asignado debe poder confirmar su caso").toBe(200);

        // §9: estado final, transición, corrección y auditoría persistidos
        const enBd = await prisma.reporte.findUnique({ where: { id: caso.id } });
        expect(enBd!.estado, "§9: el caso confirmado pasa a CLASIFICADO").toBe("CLASIFICADO");
        const transicion = await prisma.transicionReporte.findFirst({ where: { reporteId: caso.id, estadoNuevo: "CLASIFICADO" } });
        expect(transicion, "§9: la transición debe quedar registrada").toBeTruthy();
        const correccion = await prisma.correccionAdmin.findFirst({ where: { clasificacion: { reporteId: caso.id } } });
        expect(correccion?.confirmada, "§9: la confirmación debe persistirse").toBe(true);
        await verificarAuditLog("CASO_CONFIRMADO", caso.id);

        await salirYExigirSesionMuerta(sesion, HOME_POR_ROL.OPERADOR);
    });

    it("el operador escala y el comité asigna y resuelve (con §9)", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-oc2@test.local`, "ClaveE2E-2026");
        const operador = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-op2@test.local`, "Operador E2E", "OPERADOR");
        const comite = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-comite@test.local`, "Comité E2E", "COMITE_VALIDACION");
        const caso = await crearCasoRevision(operador.id, "esca");

        // El operador asignado escala el caso al comité
        await sesionDe(operador, "OPERADOR");
        const { POST: escalarPOST } = await import("@/app/api/admin/reportes/[id]/escalar/route");
        const resEscalar = await escalarPOST(
            new Request(`http://localhost:5005/api/admin/reportes/${caso.id}/escalar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: "Caso limítrofe que requiere validación del comité" }),
            }),
            { params: Promise.resolve({ id: caso.id }) }
        );
        expect(resEscalar.status, "el operador asignado debe poder escalar").toBe(201);
        const { solicitudId } = (await resEscalar.json()) as { solicitudId: string };
        await verificarAuditLog("CASO_ESCALADO", caso.id);

        // El comité ve la solicitud pendiente en su bandeja
        await sesionDe(comite, "COMITE_VALIDACION");
        const { GET: pendientesGET } = await import("@/app/api/admin/comite/pendientes/route");
        const pendientes = await pendientesGET(new Request("http://localhost:5005/api/admin/comite/pendientes"));
        expect(pendientes.status).toBe(200);
        const cuerpoPend = (await pendientes.json()) as { solicitudes?: { id: string }[]; items?: { id: string }[] };
        const idsPend = (cuerpoPend.solicitudes ?? cuerpoPend.items ?? []).map((s) => s.id);
        expect(idsPend, "la solicitud escalada debe aparecer en la bandeja del comité").toContain(solicitudId);

        // Se la auto-asigna y resuelve
        const { POST: asignarPOST } = await import("@/app/api/admin/comite/[id]/asignar/route");
        const resAsignar = await asignarPOST(
            new Request(`http://localhost:5005/api/admin/comite/${solicitudId}/asignar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ id: solicitudId }) }
        );
        expect(resAsignar.status, "el comité debe poder asignarse la solicitud").toBe(200);

        const { POST: resolverPOST } = await import("@/app/api/admin/comite/[id]/resolver/route");
        const resResolver = await resolverPOST(
            new Request(`http://localhost:5005/api/admin/comite/${solicitudId}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categoria: "EXTORSION", resolucion: "La conducta corresponde a extorsión, no a contacto insistente" }),
            }),
            { params: Promise.resolve({ id: solicitudId }) }
        );
        expect(resResolver.status, "el comité asignado debe poder resolver").toBe(200);

        // §9: corrección persistida, estado final y solicitud cerrada
        const enBd = await prisma.reporte.findUnique({ where: { id: caso.id } });
        expect(enBd!.estado, "§9: el caso resuelto por el comité pasa a CORREGIDO").toBe("CORREGIDO");
        const correccion = await prisma.correccionAdmin.findFirst({ where: { clasificacion: { reporteId: caso.id } } });
        expect(correccion?.categoriaCorregida, "§9: la categoría corregida debe persistirse").toBe("EXTORSION");
        const solicitud = await prisma.solicitudComite.findUnique({ where: { id: solicitudId } });
        expect(solicitud!.estado, "§9: la solicitud queda resuelta").toBe("RESUELTA");
        const transicion = await prisma.transicionReporte.findFirst({ where: { reporteId: caso.id, estadoNuevo: "CORREGIDO" } });
        expect(transicion, "§9: la transición del comité debe quedar registrada").toBeTruthy();
    });

    it("anonimización: el admin reescribe el texto (PATCH) y el operador asignado valida otro caso (§9 en BD)", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-anon@test.local`, "ClaveE2E-2026");
        const operador = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-op-anon@test.local`, "Operador Anon E2E", "OPERADOR");
        const datos = datosCiclo(CICLO);
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // Siembra directa (sin Ollama): el pipeline ya marcó REQUIERE_ANONIMIZACION,
        // con el original cifrado y la copia de trabajo anonimizada por la IA.
        const sembrarCasoAnonimizacion = async (tag: string, operadorId: string | null) => {
            const original = `${datos.textoBase} (caso ${tag}, con nombre propio: María Pérez)`;
            const reporte = await prisma.reporte.create({
                data: {
                    identificador: datos.identificadorPocos,
                    plataformaId: plataforma.id,
                    texto: `Caso ${tag}: un adulto insiste en pedir fotos a [MENOR] ofreciéndole dinero.`,
                    textoOriginal: encryptParameter(original),
                    fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: `RPT-C${CICLO}-ANON-${tag.toUpperCase()}`,
                    estado: "REQUIERE_ANONIMIZACION",
                    operadorId,
                },
            });
            return { reporte, original };
        };

        // Camino 1 (contrato real): la reescritura manual es PATCH y SOLO admin
        const casoAdmin = await sembrarCasoAnonimizacion("admin", null);
        jar.set("token", { name: "token", value: admin.token });
        jar.set("__Host-token", { name: "__Host-token", value: admin.token });
        const { PATCH: anonimizarPATCH } = await import("@/app/api/admin/reportes/[id]/anonimizar/route");
        const textoAnonimizado = "Un adulto insiste en pedir fotos íntimas a [MENOR] ofreciéndole dinero a cambio.";
        const resAnon = await anonimizarPATCH(
            new Request(`http://localhost:5005/api/admin/reportes/${casoAdmin.reporte.id}/anonimizar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ textoAnonimizado }),
            }),
            { params: Promise.resolve({ id: casoAdmin.reporte.id }) }
        );
        expect(resAnon.status, "el admin debe poder anonimizar (PATCH)").toBe(200);

        // §9 camino 1: estado final, texto de trabajo = anonimizado, original intacto, transición y auditoría
        const bdAdmin = (await prisma.reporte.findUnique({ where: { id: casoAdmin.reporte.id } }))!;
        expect(bdAdmin.estado, "§9: el caso anonimizado pasa a CLASIFICADO").toBe("CLASIFICADO");
        expect(descifrarTextoReporte(bdAdmin.texto), "§9: el texto de trabajo queda anonimizado").toBe(textoAnonimizado);
        expect(descifrarTextoReporte(bdAdmin.textoOriginal!), "§9: el original se preserva intacto (evidencia)").toBe(casoAdmin.original);
        const transicionAdmin = await prisma.transicionReporte.findFirst({
            where: { reporteId: casoAdmin.reporte.id, estadoNuevo: "CLASIFICADO" },
        });
        expect(transicionAdmin, "§9: la transición debe quedar registrada").toBeTruthy();
        await verificarAuditLog("PARAM_UPDATE", casoAdmin.reporte.id);

        // Camino 2 (contrato real): el operador ASIGNADO valida la anonimización del pipeline
        const casoOperador = await sembrarCasoAnonimizacion("oper", operador.id);
        await sesionDe(operador, "OPERADOR");
        const { POST: validarPOST } = await import("@/app/api/admin/reportes/[id]/validar-anonimizacion/route");
        const resValidar = await validarPOST(
            new Request(`http://localhost:5005/api/admin/reportes/${casoOperador.reporte.id}/validar-anonimizacion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valida: true, observaciones: "La anonimización cubre todo el PII detectado" }),
            }),
            { params: Promise.resolve({ id: casoOperador.reporte.id }) }
        );
        expect(resValidar.status, "el operador asignado debe poder validar la anonimización").toBe(200);

        // §9 camino 2: estado final + traza de quién validó + transición + auditoría
        const bdOperador = (await prisma.reporte.findUnique({ where: { id: casoOperador.reporte.id } }))!;
        expect(bdOperador.estado, "§9: el caso validado pasa a CLASIFICADO").toBe("CLASIFICADO");
        expect(bdOperador.anonimizacionValidadaPorId, "§9: queda quién validó").toBe(operador.id);
        expect(bdOperador.anonimizacionValidadaEn, "§9: queda cuándo validó").not.toBeNull();
        const transicionOperador = await prisma.transicionReporte.findFirst({
            where: { reporteId: casoOperador.reporte.id, estadoNuevo: "CLASIFICADO" },
        });
        expect(transicionOperador, "§9: la transición debe quedar registrada").toBeTruthy();
        await verificarAuditLog("ANONIMIZACION_VALIDADA", casoOperador.reporte.id);
    });

    it("apelaciones del comité: bandeja → tomar → resolver ACEPTADA con ocultamiento (§9 en BD)", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-apel@test.local`, "ClaveE2E-2026");
        const comite = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-comite-apel@test.local`, "Comité Apel E2E", "COMITE_VALIDACION");
        const { crearUsuario } = await import("@/lib/reporte-test-utils");
        const apelante = await crearUsuario("PARENT", `e2e-c${CICLO}-apelante@test.local`, "ClaveE2E-2026");
        const datos = datosCiclo(CICLO);
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const identificador = datos.identificadorVarios;

        // Identificador visible públicamente: la decisión del comité debe apagarlo (efecto colateral)
        await prisma.identificadorReportado.create({
            data: {
                identificador,
                plataformaId: plataforma.id,
                totalReportes: 5,
                reportesAutenticados: 5,
                reportesAprobados: 5,
                autenticadosAprobados: 5,
                esVisiblePublicamente: true,
            },
        });
        // Apelación RECIBIDA con su evidencia cifrada (fixture real del repo)
        const { crearApelacionConDocumento } = await import("@/lib/apelacion-test-utils");
        const { apelacion } = await crearApelacionConDocumento({
            usuarioId: apelante.id,
            identificador,
            plataformaId: plataforma.id,
            estado: "RECIBIDA",
        });

        await sesionDe(comite, "COMITE_VALIDACION");

        // La bandeja del comité muestra el caso recibido
        const { GET: bandejaGET } = await import("@/app/api/admin/comite/apelaciones/route");
        const resBandeja = await bandejaGET(new Request("http://localhost:5005/api/admin/comite/apelaciones?estado=RECIBIDA&page=1&pageSize=10"));
        expect(resBandeja.status, "el comité debe poder ver su bandeja de apelaciones").toBe(200);
        const bandeja = (await resBandeja.json()) as { items: { id: string; estado: string }[] };
        expect(
            bandeja.items.some((a) => a.id === apelacion.id && a.estado === "RECIBIDA"),
            "la apelación recibida debe aparecer en la bandeja del comité"
        ).toBe(true);

        // Tomar el caso: RECIBIDA → EN_REVISION asignado a sí mismo
        const { POST: tomarPOST } = await import("@/app/api/admin/comite/apelaciones/[id]/tomar/route");
        const resTomar = await tomarPOST(
            new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}/tomar`, { method: "POST" }),
            { params: Promise.resolve({ id: apelacion.id }) }
        );
        expect(resTomar.status, "el comité debe poder tomar el caso").toBe(200);

        // §9: la toma queda trazada en el propio caso
        const enRevision = (await prisma.apelacion.findUnique({ where: { id: apelacion.id } }))!;
        expect(enRevision.estado, "§9: el caso pasa a EN_REVISION").toBe("EN_REVISION");
        expect(enRevision.comiteId, "§9: queda asignado al miembro que lo tomó").toBe(comite.id);
        expect(enRevision.asignadoEn, "§9: queda cuándo se tomó").not.toBeNull();

        // Resolver ACEPTADA con ocultamiento del identificador
        const { POST: resolverPOST } = await import("@/app/api/admin/comite/apelaciones/[id]/resolver/route");
        const resResolver = await resolverPOST(
            new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    decision: "ACEPTADA",
                    motivacion: "El titular acreditó la titularidad de la línea; los reportes no corresponden.",
                    quitarVisibilidad: true,
                }),
            }),
            { params: Promise.resolve({ id: apelacion.id }) }
        );
        expect(resResolver.status, "el miembro asignado debe poder resolver").toBe(200);

        // §9: resolución persistida con el integrante correcto
        const resuelta = (await prisma.apelacion.findUnique({ where: { id: apelacion.id } }))!;
        expect(resuelta.estado, "§9: el caso queda ACEPTADA").toBe("ACEPTADA");
        expect(resuelta.decision).toBe("ACEPTADA");
        expect(resuelta.resueltoPorId, "§9: queda quién resolvió").toBe(comite.id);
        expect(resuelta.resueltoEn, "§9: queda cuándo resolvió").not.toBeNull();
        expect(resuelta.motivacionResolucion, "§9: la motivación queda escrita").toContain("titularidad");
        expect(resuelta.quitoVisibilidad, "§9: la decisión registra el ocultamiento").toBe(true);

        // §9 efecto colateral: la visibilidad pública del identificador queda apagada por el comité
        const agregado = (await prisma.identificadorReportado.findUnique({
            where: { identificador_plataformaId: { identificador, plataformaId: plataforma.id } },
        }))!;
        expect(agregado.ocultoPorComiteEn, "§9: la marca del comité queda en el agregado").not.toBeNull();
        expect(agregado.esVisiblePublicamente, "§9: el recálculo apaga la visibilidad pública").toBe(false);
        await verificarAuditLog("APELACION_RESUELTA", apelacion.id);
    });
});

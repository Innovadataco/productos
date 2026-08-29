/**
 * SPEC-133 (fase 6) · Negativos de seguridad a nivel HANDLER — el proxy es grueso
 * (deja pasar al área); el 403/404 fino vive en los handlers. Patrón SPEC-114.
 *
 * CONDICIÓN O-1: estos tests DEBEN poder fallar. Si alguno destapa un hueco real
 * (datos ajenos servidos con 200, rol que entra donde no debe), NO se arregla el
 * handler NI se debilita la aserción: el test correcto queda en it.todo con la
 * radicación O-1 y se reporta con evidencia.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo } from "../seed-ciclo";
import { entrarComo } from "../helpers";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

function sesionEnJar(token: string) {
    jar.set("token", { name: "token", value: token });
    jar.set("__Host-token", { name: "__Host-token", value: token });
}

/** Alta real de un rol interno por la API de admin (patrón del journey operador-comité). */
async function crearUsuarioInterno(adminToken: string, email: string, nombre: string, rol: "OPERADOR" | "COMITE_VALIDACION") {
    sesionEnJar(adminToken);
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

/** Login REAL del rol interno con su contraseña temporal y sesión en el jar. */
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
    sesionEnJar(token);
    return { usuarioId: usuario.id, email: usuario.email, rol, token };
}

describe(`SPEC-133 · negativos a nivel handler (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    it("OPERADOR no entra a APIs admin-only (403 fino en el handler, sin efecto en BD)", async () => {
        const operador = await entrarComo("OPERADOR", `e2e-c${CICLO}-neg-op@test.local`, "ClaveE2E-2026");
        sesionEnJar(operador.token);

        const { POST: operadoresPOST } = await import("@/app/api/admin/operadores/route");
        const resCrear = await operadoresPOST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: `e2e-c${CICLO}-neg-op-intruso@test.local`, nombre: "Intruso", rol: "OPERADOR" }),
            })
        );
        expect(resCrear.status, "POST /api/admin/operadores es admin-only").toBe(403);

        const { PATCH: parametroPATCH } = await import("@/app/api/config/parametros/[clave]/route");
        const resParam = await parametroPATCH(
            new Request("http://localhost:5005/api/config/parametros/visibility.report_threshold", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: "99" }),
            }),
            { params: Promise.resolve({ clave: "visibility.report_threshold" }) }
        );
        expect(resParam.status, "PATCH /api/config/parametros/[clave] es admin-only").toBe(403);

        const { GET: integrantesGET } = await import("@/app/api/admin/comite/integrantes/route");
        const resIntegrantes = await integrantesGET(new Request("http://localhost:5005/api/admin/comite/integrantes"));
        expect(resIntegrantes.status, "GET /api/admin/comite/integrantes es admin-only").toBe(403);

        const { POST: colegiosPOST } = await import("@/app/api/admin/colegios/route");
        const resColegios = await colegiosPOST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
        );
        expect(resColegios.status, "POST /api/admin/colegios es admin-only").toBe(403);

        const { GET: auditLogsGET } = await import("@/app/api/admin/audit-logs/route");
        const resAudit = await auditLogsGET(new Request("http://localhost:5005/api/admin/audit-logs?page=1&pageSize=5"));
        expect(resAudit.status, "GET /api/admin/audit-logs es admin-only").toBe(403);

        // §9 negativo: los intentos rechazados no alteraron nada
        const param = (await prisma.parametroSistema.findUnique({ where: { clave: "visibility.report_threshold" } }))!;
        expect(param.valor, "§9: el parámetro sigue intacto").toBe("3");
        const intruso = await prisma.usuario.findUnique({ where: { email: `e2e-c${CICLO}-neg-op-intruso@test.local` } });
        expect(intruso, "§9: el operador intruso no fue creado").toBeNull();
    });

    it("COMITE_VALIDACION no entra a APIs admin-only (403 fino en el handler)", async () => {
        const comite = await entrarComo("COMITE_VALIDACION", `e2e-c${CICLO}-neg-com@test.local`, "ClaveE2E-2026");
        sesionEnJar(comite.token);

        const { POST: operadoresPOST } = await import("@/app/api/admin/operadores/route");
        const resCrear = await operadoresPOST(
            new Request("http://localhost:5005/api/admin/operadores", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: `e2e-c${CICLO}-neg-com-intruso@test.local`, nombre: "Intruso", rol: "OPERADOR" }),
            })
        );
        expect(resCrear.status, "POST /api/admin/operadores es admin-only").toBe(403);

        const { PATCH: parametroPATCH } = await import("@/app/api/config/parametros/[clave]/route");
        const resParam = await parametroPATCH(
            new Request("http://localhost:5005/api/config/parametros/visibility.report_threshold", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: "99" }),
            }),
            { params: Promise.resolve({ clave: "visibility.report_threshold" }) }
        );
        expect(resParam.status, "PATCH /api/config/parametros/[clave] es admin-only").toBe(403);

        const { GET: auditLogsGET } = await import("@/app/api/admin/audit-logs/route");
        const resAudit = await auditLogsGET(new Request("http://localhost:5005/api/admin/audit-logs?page=1&pageSize=5"));
        expect(resAudit.status, "GET /api/admin/audit-logs es admin-only").toBe(403);

        const { POST: colegiosPOST } = await import("@/app/api/admin/colegios/route");
        const resColegios = await colegiosPOST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
        );
        expect(resColegios.status, "POST /api/admin/colegios es admin-only").toBe(403);

        // §9 negativo
        const param = (await prisma.parametroSistema.findUnique({ where: { clave: "visibility.report_threshold" } }))!;
        expect(param.valor, "§9: el parámetro sigue intacto").toBe("3");
    });

    it("PARENT no entra a las APIs del colegio (403 fino en el handler)", async () => {
        const padre = await entrarComo("PARENT", `e2e-c${CICLO}-neg-padre@test.local`, "ClaveE2E-2026");
        sesionEnJar(padre.token);

        const { GET: cursosGET } = await import("@/app/api/colegio/cursos/route");
        const resCursos = await cursosGET(new Request("http://localhost:5005/api/colegio/cursos"));
        expect(resCursos.status, "GET /api/colegio/cursos es solo SCHOOL_ADMIN").toBe(403);

        const { GET: alertasGET } = await import("@/app/api/colegio/alertas/route");
        const resAlertas = await alertasGET(new Request("http://localhost:5005/api/colegio/alertas"));
        expect(resAlertas.status, "GET /api/colegio/alertas es solo SCHOOL_ADMIN").toBe(403);

        const { GET: estadisticasGET } = await import("@/app/api/colegio/estadisticas/route");
        const resStats = await estadisticasGET(new Request("http://localhost:5005/api/colegio/estadisticas"));
        expect(resStats.status, "GET /api/colegio/estadisticas es solo SCHOOL_ADMIN").toBe(403);
    });

    it("cross-parent: el padre B no lee el detalle del reporte del padre A (403, sin datos)", async () => {
        const datos = datosCiclo(CICLO);
        const padreA = await entrarComo("PARENT", `e2e-c${CICLO}-neg-pa@test.local`, "ClaveE2E-2026");
        sesionEnJar(padreA.token);

        // A reporta autenticado por el camino real
        const { POST: reportesPOST } = await import("@/app/api/reportes/route");
        const resReporte = await reportesPOST(
            new Request("http://localhost:5005/api/reportes", {
                method: "POST",
                headers: { "Content-Type": "application/json", cookie: `token=${padreA.token}` },
                body: JSON.stringify({
                    identificador: datos.identificadorComun,
                    plataforma: "whatsapp",
                    texto: `${datos.textoBase} (reporte privado del padre A)`,
                    fechaIncidente: "2026-07-21T10:00:00Z",
                    ciudad: "Bogotá",
                    pais: "Colombia",
                }),
            })
        );
        expect(resReporte.status).toBe(201);
        const { reporte } = (await resReporte.json()) as { reporte: { id: string } };

        // B intenta leer el detalle privado de A
        const padreB = await entrarComo("PARENT", `e2e-c${CICLO}-neg-pb@test.local`, "ClaveE2E-2026");
        sesionEnJar(padreB.token);
        const { GET: detalleGET } = await import("@/app/api/reportes/mis-reportes/[id]/route");
        const resAjeno = await detalleGET(new Request(`http://localhost:5005/api/reportes/mis-reportes/${reporte.id}`), {
            params: Promise.resolve({ id: reporte.id }),
        });
        expect(resAjeno.status, "el detalle privado es solo del dueño").toBe(403);
        const cuerpoAjeno = await resAjeno.text();
        expect(cuerpoAjeno, "la respuesta NO filtra el identificador del reporte ajeno").not.toContain(datos.identificadorComun);
    });

    it("asignación estricta: operador y comité no gestionan casos asignados a otro (403, sin efecto)", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-neg-admin@test.local`, "ClaveE2E-2026");
        const op1 = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-neg-op1@test.local`, "Operador Uno E2E", "OPERADOR");
        const op2 = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-neg-op2@test.local`, "Operador Dos E2E", "OPERADOR");
        const comite1 = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-neg-com1@test.local`, "Comité Uno E2E", "COMITE_VALIDACION");
        const comite2 = await crearUsuarioInterno(admin.token, `e2e-c${CICLO}-neg-com2@test.local`, "Comité Dos E2E", "COMITE_VALIDACION");
        const datos = datosCiclo(CICLO);
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // Caso de revisión asignado a op1 (estado del motor sembrado, sin Ollama)
        const caso = await prisma.reporte.create({
            data: {
                identificador: datos.identificadorComun,
                plataformaId: plataforma.id,
                texto: `${datos.textoBase} (caso asignación estricta)`,
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: `RPT-C${CICLO}-ASIG`,
                estado: "REVISION_MANUAL",
                operadorId: op1.id,
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: caso.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.55,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "rubrica:gemma2:27b",
                latenciaMs: 1000,
                categoriasSecundarias: [],
            },
        });

        // op2 (NO asignado) intenta confirmar el caso de op1 → 403
        await sesionDe(op2, "OPERADOR");
        const { POST: confirmarPOST } = await import("@/app/api/admin/reportes-revision/[id]/confirmar/route");
        const resConfirmar = await confirmarPOST(
            new Request(`http://localhost:5005/api/admin/reportes-revision/${caso.id}/confirmar`, { method: "POST" }),
            { params: Promise.resolve({ id: caso.id }) }
        );
        expect(resConfirmar.status, "confirmar es solo del operador asignado").toBe(403);
        const casoIntacto = (await prisma.reporte.findUnique({ where: { id: caso.id } }))!;
        expect(casoIntacto.estado, "§9: el intento rechazado no movió el caso").toBe("REVISION_MANUAL");

        // Escalación real de op1 → comite1 se asigna → comite2 intenta resolver → 403
        await sesionDe(op1, "OPERADOR");
        const { POST: escalarPOST } = await import("@/app/api/admin/reportes/[id]/escalar/route");
        const resEscalar = await escalarPOST(
            new Request(`http://localhost:5005/api/admin/reportes/${caso.id}/escalar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: "Caso limítrofe para el comité (negativo E2E)" }),
            }),
            { params: Promise.resolve({ id: caso.id }) }
        );
        expect(resEscalar.status).toBe(201);
        const { solicitudId } = (await resEscalar.json()) as { solicitudId: string };

        await sesionDe(comite1, "COMITE_VALIDACION");
        const { POST: asignarPOST } = await import("@/app/api/admin/comite/[id]/asignar/route");
        const resAsignar = await asignarPOST(
            new Request(`http://localhost:5005/api/admin/comite/${solicitudId}/asignar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            }),
            { params: Promise.resolve({ id: solicitudId }) }
        );
        expect(resAsignar.status).toBe(200);

        await sesionDe(comite2, "COMITE_VALIDACION");
        const { POST: resolverSolicitudPOST } = await import("@/app/api/admin/comite/[id]/resolver/route");
        const resResolverAjena = await resolverSolicitudPOST(
            new Request(`http://localhost:5005/api/admin/comite/${solicitudId}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ categoria: "OTRO", resolucion: "Intento de resolver una solicitud ajena" }),
            }),
            { params: Promise.resolve({ id: solicitudId }) }
        );
        expect(resResolverAjena.status, "resolver es solo del miembro asignado").toBe(403);
        const solicitudIntacta = (await prisma.solicitudComite.findUnique({ where: { id: solicitudId } }))!;
        expect(solicitudIntacta.estado, "§9: la solicitud sigue asignada a comite1").toBe("ASIGNADA");
        expect(solicitudIntacta.comiteId).toBe(comite1.id);

        // Apelación EN_REVISION tomada por comite1 → comite2 intenta resolverla → 403
        const { crearUsuario } = await import("@/lib/reporte-test-utils");
        const apelante = await crearUsuario("PARENT", `e2e-c${CICLO}-neg-apelante@test.local`, "ClaveE2E-2026");
        const apelacion = await prisma.apelacion.create({
            data: {
                numero: `APL-E2E-C${CICLO}-NEG`,
                usuarioId: apelante.id,
                identificador: datos.identificadorVarios,
                plataformaId: plataforma.id,
                motivo: "Soy el titular y los reportes no corresponden (negativo E2E).",
                estado: "EN_REVISION",
                comiteId: comite1.id,
                asignadoEn: new Date(),
                plazoRespuestaEn: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            },
        });
        const { POST: resolverApelacionPOST } = await import("@/app/api/admin/comite/apelaciones/[id]/resolver/route");
        const resResolverApelacion = await resolverApelacionPOST(
            new Request(`http://localhost:5005/api/admin/comite/apelaciones/${apelacion.id}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision: "RECHAZADA", motivacion: "Intento de resolver una apelación ajena" }),
            }),
            { params: Promise.resolve({ id: apelacion.id }) }
        );
        expect(resResolverApelacion.status, "resolver la apelación es solo del miembro asignado").toBe(403);
        const apelacionIntacta = (await prisma.apelacion.findUnique({ where: { id: apelacion.id } }))!;
        expect(apelacionIntacta.estado, "§9: la apelación sigue EN_REVISION").toBe("EN_REVISION");
        expect(apelacionIntacta.comiteId).toBe(comite1.id);
        expect(apelacionIntacta.resueltoEn, "§9: sin resolución").toBeNull();
    });

    it("multi-tenant: el colegio A no ve ni toca nada del colegio B (404 por propiedad, datos de B intactos)", async () => {
        const sesionA = await entrarComo("SCHOOL_ADMIN", "", "");
        const sesionB = await entrarComo("SCHOOL_ADMIN", "", "");
        const colegioBId = (await prisma.usuario.findUnique({ where: { id: sesionB.usuarioId } }))!.colegioId!;

        // Siembra en B: curso + alumno + identificador + reporte visible + alerta
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const cursoB = await prisma.curso.create({
            data: { colegioId: colegioBId, nombre: `Curso B E2E C${CICLO}`, grado: "5", anioLectivo: "2026" },
        });
        const estudianteB = await prisma.estudiante.create({
            data: { cursoId: cursoB.id, colegioId: colegioBId, nombre: `Alumno B E2E C${CICLO}` },
        });
        const identificadorB = await prisma.identificadorEstudiante.create({
            data: {
                estudianteId: estudianteB.id,
                tipo: "telefono",
                valor: `+5732088800${CICLO}1`,
                plataformaId: plataforma.id,
                etiquetaRelacion: "ESTUDIANTE",
            },
        });
        const reporteB = await prisma.reporte.create({
            data: {
                identificador: identificadorB.valor,
                plataformaId: plataforma.id,
                texto: `Reporte visible para la alerta del colegio B (ciclo ${CICLO}).`,
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: `RPT-C${CICLO}-TENANT-B`,
                estado: "CLASIFICADO",
            },
        });
        const alertaB = await prisma.alertaColegio.create({
            data: {
                colegioId: colegioBId,
                reporteId: reporteB.id,
                identificadorEstudianteId: identificadorB.id,
                estado: "nueva",
                prioridad: "media",
                vencimientoSla: new Date(Date.now() + 48 * 60 * 60 * 1000),
            },
        });

        // Todo lo que sigue es la sesión del colegio A
        sesionEnJar(sesionA.token);

        // Listados: no se cuela nada de B
        const { GET: cursosGET } = await import("@/app/api/colegio/cursos/route");
        const resCursos = await cursosGET(new Request("http://localhost:5005/api/colegio/cursos"));
        expect(resCursos.status).toBe(200);
        const { cursos } = (await resCursos.json()) as { cursos: { id: string }[] };
        expect(cursos.some((c) => c.id === cursoB.id), "el curso de B no debe aparecer en el listado de A").toBe(false);

        const { GET: alertasGET } = await import("@/app/api/colegio/alertas/route");
        const resAlertas = await alertasGET(new Request("http://localhost:5005/api/colegio/alertas"));
        expect(resAlertas.status).toBe(200);
        const { items } = (await resAlertas.json()) as { items: { id: string }[] };
        expect(items.some((a) => a.id === alertaB.id), "la alerta de B no debe aparecer en el listado de A").toBe(false);

        const { GET: estadisticasGET } = await import("@/app/api/colegio/estadisticas/route");
        const resStats = await estadisticasGET(new Request("http://localhost:5005/api/colegio/estadisticas"));
        expect(resStats.status).toBe(200);
        const statsTexto = JSON.stringify(await resStats.json());
        expect(statsTexto, "las estadísticas de A no incluyen el curso de B").not.toContain(cursoB.nombre);
        expect(statsTexto, "las estadísticas de A no incluyen el identificador de B").not.toContain(identificadorB.valor);

        // Detalle y mutación sobre recursos de B: 404 por filtro de propiedad
        const { GET: cursoGET, PATCH: cursoPATCH } = await import("@/app/api/colegio/cursos/[id]/route");
        const resCursoAjeno = await cursoGET(new Request(`http://localhost:5005/api/colegio/cursos/${cursoB.id}`), {
            params: Promise.resolve({ id: cursoB.id }),
        });
        expect(resCursoAjeno.status, "GET curso de B → 404 (no filtrar ni existencia)").toBe(404);
        const resCursoPatch = await cursoPATCH(
            new Request(`http://localhost:5005/api/colegio/cursos/${cursoB.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: "Curso secuestrado" }),
            }),
            { params: Promise.resolve({ id: cursoB.id }) }
        );
        expect(resCursoPatch.status, "PATCH curso de B → 404").toBe(404);

        const { PATCH: cursoEstadoPATCH } = await import("@/app/api/colegio/cursos/[id]/estado/route");
        const resCursoEstado = await cursoEstadoPATCH(
            new Request(`http://localhost:5005/api/colegio/cursos/${cursoB.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                // Contrato real: el body es el enum crudo ("activo"|"inactivo"), no un objeto
                body: JSON.stringify("inactivo"),
            }),
            { params: Promise.resolve({ id: cursoB.id }) }
        );
        expect(resCursoEstado.status, "PATCH estado del curso de B → 404").toBe(404);

        const { GET: estudianteGET, PATCH: estudiantePATCH } = await import("@/app/api/colegio/alumnos/[id]/route");
        const resAlumnoAjeno = await estudianteGET(new Request(`http://localhost:5005/api/colegio/alumnos/${estudianteB.id}`), {
            params: Promise.resolve({ id: estudianteB.id }),
        });
        expect(resAlumnoAjeno.status, "GET alumno de B → 404").toBe(404);
        const resAlumnoPatch = await estudiantePATCH(
            new Request(`http://localhost:5005/api/colegio/alumnos/${estudianteB.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: "Alumno secuestrado", apellidos: "X" }),
            }),
            { params: Promise.resolve({ id: estudianteB.id }) }
        );
        expect(resAlumnoPatch.status, "PATCH alumno de B → 404").toBe(404);

        const { PATCH: alertaEstadoPATCH } = await import("@/app/api/colegio/alertas/[id]/estado/route");
        const resAlertaAjena = await alertaEstadoPATCH(
            new Request(`http://localhost:5005/api/colegio/alertas/${alertaB.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: "gestionada" }),
            }),
            { params: Promise.resolve({ id: alertaB.id }) }
        );
        expect(resAlertaAjena.status, "PATCH alerta de B → 404").toBe(404);

        // §9 negativo: los datos de B quedaron intactos tras los intentos de A
        const cursoBTras = (await prisma.curso.findUnique({ where: { id: cursoB.id } }))!;
        expect(cursoBTras.nombre, "§9: el curso de B no fue modificado").toBe(cursoB.nombre);
        expect(cursoBTras.estado, "§9: el curso de B sigue activo").toBe("activo");
        const estudianteBTras = (await prisma.estudiante.findUnique({ where: { id: estudianteB.id } }))!;
        expect(estudianteBTras.nombre, "§9: el alumno de B no fue modificado").toBe(estudianteB.nombre);
        const alertaBTras = (await prisma.alertaColegio.findUnique({ where: { id: alertaB.id } }))!;
        expect(alertaBTras.estado, "§9: la alerta de B sigue nueva").toBe("nueva");
    });
});

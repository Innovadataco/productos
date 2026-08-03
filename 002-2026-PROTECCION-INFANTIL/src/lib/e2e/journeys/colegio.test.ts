/**
 * SPEC-114 · Journey colegio — el camino institucional completo:
 * admin crea el colegio DE VERDAD (POST /api/admin/colegios) → llega la contraseña
 * temporal → primer ingreso con cambio obligatorio (C-9/I-35) → el panel carga →
 * gestiona cursos y alumnos → sale con la sesión muerta. Cierra en BD (§9).
 * SPEC-133 (fase 3): carga masiva de alumnos (plantilla → validar con roster
 * server-side SPEC-132 → confirmar) → alertas del colegio (listar + cambiar estado) →
 * auditoría del colegio (solo COLEGIO_* del propio colegio). Todo cierra en BD (§9).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase } from "../seed-ciclo";
import { entrarComo, viaProxy, esperarPasoLibre, esperarBloqueo, salirYExigirSesionMuerta, verificarHashBcrypt, verificarAuditLog, HOME_POR_ROL } from "../helpers";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";
import { POST as loginPOST } from "@/app/api/auth/login/route";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

/** Request multipart/form-data con el archivo CSV de carga (patrón de carga/route.test.ts). */
function crearRequestCargaCsv(csv: string): Request {
    const boundary = `----cargae2e${Math.random().toString(36).slice(2)}`;
    const body = [
        `--${boundary}`,
        "Content-Disposition: form-data; name=\"archivo\"; filename=\"carga-e2e.csv\"",
        "Content-Type: text/csv",
        "",
        csv,
        `--${boundary}--`,
        "",
    ].join("\r\n");
    return new Request("http://localhost:5005/api/colegio/carga/validar", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body,
    });
}

describe(`SPEC-114 · colegio (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    it("alta real por el admin → contraseña temporal → cambio obligatorio → panel (con §9)", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-admin-col@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: admin.token });
        jar.set("__Host-token", { name: "__Host-token", value: admin.token });

        // El admin crea el colegio por el camino real (no por seed directo)
        const pais = await prisma.pais.findUnique({ where: { codigo: "CO" } });
        const ciudad = await prisma.ciudad.findFirst({ where: { paisId: pais!.id } });
        const emailColegio = `e2e-c${CICLO}-colegio@test.local`;
        const inicio = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const { POST: crearColegioPOST } = await import("@/app/api/admin/colegios/route");
        const resCrear = await crearColegioPOST(
            new Request("http://localhost:5005/api/admin/colegios", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nombre: `Colegio E2E Ciclo ${CICLO}`,
                    paisId: pais!.id,
                    ciudadId: ciudad!.id,
                    representanteLegalNombre: "Rector E2E",
                    representanteLegalIdentificacion: "CC-12345",
                    representanteLegalEmail: emailColegio,
                    inicioServicio: inicio.toISOString(),
                    finServicio: new Date(inicio.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                    tipoPeriodo: "ANUAL",
                    adminEmail: emailColegio,
                    adminNombre: "Admin Colegio E2E",
                }),
            })
        );
        expect(resCrear.status, "el admin debe poder crear un colegio").toBe(201);
        const creado = (await resCrear.json()) as {
            colegio: { id: string; admin: { id: string; debeCambiarPassword: boolean } };
            passwordTemporal: string;
        };
        expect(creado.passwordTemporal, "el alta entrega una contraseña temporal").toBeTruthy();
        expect(creado.colegio.admin.debeCambiarPassword).toBe(true);

        // §9: el usuario colegio persiste con hash bcrypt y bandera de cambio obligatorio
        const usuarioColegio = await prisma.usuario.findUnique({ where: { email: emailColegio } });
        expect(usuarioColegio).toBeTruthy();
        expect(usuarioColegio!.rol).toBe("SCHOOL_ADMIN");
        verificarHashBcrypt(usuarioColegio!.passwordHash, creado.passwordTemporal);
        await verificarAuditLog("COLEGIO_CREADO", creado.colegio.id);

        // Primer ingreso REAL con la contraseña temporal
        const resLogin = await loginPOST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailColegio, password: creado.passwordTemporal }),
            })
        );
        expect(resLogin.status, "el primer ingreso con la contraseña temporal debe funcionar").toBe(200);
        const hashAntes = (await prisma.usuario.findUnique({ where: { id: usuarioColegio!.id } }))!.passwordHash;

        // Cambio obligatorio de contraseña por el camino real: el proxy debe dejar
        // llegar al endpoint (I-35: sin esa ruta el colegio queda atrapado en la pantalla)
        const tokenColegio = await crearTokenUsuario(usuarioColegio!.id, "SCHOOL_ADMIN");
        jar.set("token", { name: "token", value: tokenColegio });
        jar.set("__Host-token", { name: "__Host-token", value: tokenColegio });
        const sesionColegio = { usuarioId: usuarioColegio!.id, email: emailColegio, rol: "SCHOOL_ADMIN" as const, token: tokenColegio };
        esperarPasoLibre(
            await viaProxy(sesionColegio, "/api/auth/cambiar-password", "POST"),
            "el colegio alcanza el endpoint de cambio obligatorio (I-35)"
        );
        const { POST: cambiarPOST } = await import("@/app/api/auth/cambiar-password/route");
        const resCambio = await cambiarPOST(
            new Request("http://localhost:5005/api/auth/cambiar-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ passwordActual: creado.passwordTemporal, passwordNueva: "ClaveColegioE2E-2027" }),
            })
        );
        expect(resCambio.status, "el cambio obligatorio debe ser alcanzable (I-35)").toBe(200);

        // §9: hash cambió y la bandera quedó limpia
        const despues = (await prisma.usuario.findUnique({ where: { id: usuarioColegio!.id } }))!;
        expect(despues.passwordHash, "§9: el hash debe cambiar tras el primer ingreso").not.toBe(hashAntes);
        expect(despues.debeCambiarPassword, "§9: la bandera queda limpia").toBe(false);

        // El panel del colegio carga por el camino del proxy (y el área admin sigue vedada)
        const sesion = { usuarioId: usuarioColegio!.id, email: emailColegio, rol: "SCHOOL_ADMIN" as const, token: tokenColegio };
        esperarPasoLibre(await viaProxy(sesion, HOME_POR_ROL.SCHOOL_ADMIN), "el colegio entra a su panel");
        esperarBloqueo(await viaProxy(sesion, "/dashboard/admin"), "el colegio NO entra al área admin");
    });

    it("gestiona cursos y alumnos por el camino real y sale con la sesión muerta (con §9)", async () => {
        const sesion = await entrarComo("SCHOOL_ADMIN", "", "");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });

        // Crear un curso por la API real del colegio
        const { POST: cursosPOST, GET: cursosGET } = await import("@/app/api/colegio/cursos/route");
        const resCurso = await cursosPOST(
            new Request("http://localhost:5005/api/colegio/cursos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: `Quinto ${CICLO}-A`, grado: "5", anioLectivo: "2026" }),
            })
        );
        expect(resCurso.status, "el colegio debe poder crear un curso").toBe(201);
        const { curso } = (await resCurso.json()) as { curso: { id: string } };
        await verificarAuditLog("COLEGIO_CURSO_CREADO", curso.id);

        // Agregar un alumno al curso
        const { POST: alumnosPOST, GET: alumnosGET } = await import("@/app/api/colegio/cursos/[id]/alumnos/route");
        const resEstudiante = await alumnosPOST(
            new Request(`http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: `Alumno E2E Ciclo ${CICLO}`, apellidos: "E2E" }),
            }),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(resEstudiante.status, "el colegio debe poder agregar un alumno").toBe(201);
        const { alumno } = (await resEstudiante.json()) as { alumno: { id: string } };
        await verificarAuditLog("COLEGIO_ALUMNO_CREADO", alumno.id);

        // El curso y el alumno se listan de vuelta
        const listaCursos = await cursosGET(new Request("http://localhost:5005/api/colegio/cursos"));
        expect(listaCursos.status).toBe(200);
        const listaEstudiantes = await alumnosGET(new Request(`http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`), {
            params: Promise.resolve({ id: curso.id }),
        });
        expect(listaEstudiantes.status).toBe(200);
        const { alumnos } = (await listaEstudiantes.json()) as { alumnos: { id: string }[] };
        expect(alumnos.some((a) => a.id === alumno.id)).toBe(true);

        // Estadísticas del colegio cargan
        const { GET: estadisticasGET } = await import("@/app/api/colegio/estadisticas/route");
        const resStats = await estadisticasGET(new Request("http://localhost:5005/api/colegio/estadisticas"));
        expect(resStats.status, "las estadísticas del colegio deben cargar").toBe(200);

        // Salir: la sesión muere de verdad (I-35b)
        await salirYExigirSesionMuerta(sesion, HOME_POR_ROL.SCHOOL_ADMIN);
    });

    it("carga masiva: plantilla → validar (roster server-side SPEC-132) → confirmar (§9 alumnos en BD)", async () => {
        const sesion = await entrarComo("SCHOOL_ADMIN", "", "");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const colegioId = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!.colegioId!;

        // 1) La plantilla se descarga por el camino real
        const { GET: plantillaGET } = await import("@/app/api/colegio/carga/plantilla/route");
        const resPlantilla = await plantillaGET(new Request("http://localhost:5005/api/colegio/carga/plantilla"));
        expect(resPlantilla.status, "el colegio debe poder descargar la plantilla").toBe(200);
        expect(await resPlantilla.text()).toContain("nombre_curso");

        // 2) Validar un CSV real (dos alumnos en un curso nuevo)
        const csv = [
            "nombre_curso,grado,anio_lectivo,nombre_alumno,apellidos_alumno,tipo_identificador,valor_identificador,etiqueta_relacion,plataforma",
            `E2E Grupo ${CICLO}-A,Sexto,2026,Alumno Uno,E2E C${CICLO},telefono,+5731055500${CICLO}1,ESTUDIANTE,WhatsApp`,
            `E2E Grupo ${CICLO}-A,Sexto,2026,Alumno Dos,E2E C${CICLO},email,alumno-dos-e2e-c${CICLO}@test.local,PADRE,`,
        ].join("\n");
        const { POST: validarPOST } = await import("@/app/api/colegio/carga/validar/route");
        const resValidar = await validarPOST(crearRequestCargaCsv(csv));
        expect(resValidar.status, "validar el CSV debe funcionar").toBe(200);
        const validacion = (await resValidar.json()) as {
            valido: boolean;
            filasValidas: number;
            tokenConfirmacion: string | null;
        };
        expect(validacion.valido).toBe(true);
        expect(validacion.filasValidas).toBe(2);
        expect(validacion.tokenConfirmacion, "la validación entrega un token de confirmación").toBeTruthy();

        // §9 intermedio (SPEC-132): el roster quedó persistido server-side, no en el token
        const sesionRoster = await prisma.cargaRosterSesion.findFirst({ where: { colegioId } });
        expect(sesionRoster, "SPEC-132: el roster se persiste server-side").not.toBeNull();

        // 3) Confirmar con el token de la validación
        const { POST: confirmarPOST } = await import("@/app/api/colegio/carga/confirmar/route");
        const resConfirmar = await confirmarPOST(
            new Request("http://localhost:5005/api/colegio/carga/confirmar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokenConfirmacion: validacion.tokenConfirmacion }),
            })
        );
        expect(resConfirmar.status, "confirmar la carga debe funcionar").toBe(201);

        // §9: curso + alumnos + identificadores ligados al colegio; sesión consumida (single-use); auditoría
        const cursos = await prisma.curso.findMany({ where: { colegioId } });
        expect(cursos, "§9: la carga crea el curso").toHaveLength(1);
        const alumnos = await prisma.estudiante.findMany({ where: { colegioId }, include: { identificadores: true } });
        expect(alumnos, "§9: la carga crea los dos alumnos").toHaveLength(2);
        expect(alumnos.every((a) => a.cursoId === cursos[0].id), "§9: los alumnos quedan en el curso creado").toBe(true);
        expect(alumnos.flatMap((a) => a.identificadores), "§9: cada alumno conserva su identificador").toHaveLength(2);
        expect(
            await prisma.cargaRosterSesion.findUnique({ where: { id: sesionRoster!.id } }),
            "§9: la sesión de roster se consume con la confirmación (single-use)"
        ).toBeNull();
        const audit = await prisma.auditLog.findFirst({ where: { accion: "COLEGIO_CARGA_MASIVA", colegioId } });
        expect(audit, "§9: la carga masiva queda auditada").not.toBeNull();
    });

    it("alertas del colegio: lista la alerta y cambia su estado por el camino real (§9 en BD)", async () => {
        const sesion = await entrarComo("SCHOOL_ADMIN", "", "");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const colegioId = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!.colegioId!;

        // Siembra directa (sin worker ni Ollama): alumno con identificador + reporte visible + alerta "nueva"
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const curso = await prisma.curso.create({
            data: { colegioId, nombre: `Alertas ${CICLO}-A`, grado: "5", anioLectivo: "2026" },
        });
        const alumno = await prisma.estudiante.create({
            data: { cursoId: curso.id, colegioId, nombre: `Alumno Alerta E2E C${CICLO}` },
        });
        const identificador = await prisma.identificadorEstudiante.create({
            data: {
                estudianteId: alumno.id,
                tipo: "telefono",
                valor: `+5732077700${CICLO}1`,
                plataformaId: plataforma.id,
                etiquetaRelacion: "ESTUDIANTE",
            },
        });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: identificador.valor,
                plataformaId: plataforma.id,
                texto: `Reporte visible para la alerta del colegio (ciclo ${CICLO}).`,
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: `RPT-AL-C${CICLO}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                estado: "CLASIFICADO",
            },
        });
        const alerta = await prisma.alertaColegio.create({
            data: { colegioId, reporteId: reporte.id, identificadorEstudianteId: identificador.id, estado: "nueva" },
        });

        // El listado muestra la alerta con sus campos no sensibles
        const { GET: alertasGET } = await import("@/app/api/colegio/alertas/route");
        const resLista = await alertasGET(new Request("http://localhost:5005/api/colegio/alertas"));
        expect(resLista.status, "el colegio debe poder listar sus alertas").toBe(200);
        const { alertas } = (await resLista.json()) as {
            alertas: { id: string; identificador: string; estadoAlerta: string }[];
        };
        const listada = alertas.find((a) => a.id === alerta.id);
        expect(listada, "la alerta sembrada debe aparecer en el listado").toBeTruthy();
        expect(listada!.estadoAlerta).toBe("nueva");
        expect(listada!.identificador).toBe(identificador.valor);

        // Cambio de estado por el camino real
        const { PATCH: estadoPATCH } = await import("@/app/api/colegio/alertas/[id]/estado/route");
        const resEstado = await estadoPATCH(
            new Request(`http://localhost:5005/api/colegio/alertas/${alerta.id}/estado`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: "vista" }),
            }),
            { params: Promise.resolve({ id: alerta.id }) }
        );
        expect(resEstado.status, "el colegio debe poder cambiar el estado de su alerta").toBe(200);

        // §9: el estado cambió en BD y quedó auditado
        const enBd = await prisma.alertaColegio.findUnique({ where: { id: alerta.id } });
        expect(enBd!.estado, "§9: la alerta queda en estado vista").toBe("vista");
        await verificarAuditLog("COLEGIO_ALERTA_ESTADO", alerta.id);
    });

    it("auditoría del colegio: lista solo sus acciones COLEGIO_* con actor legible (§9 aislamiento)", async () => {
        const sesion = await entrarComo("SCHOOL_ADMIN", "", "");
        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const usuario = (await prisma.usuario.findUnique({ where: { id: sesion.usuarioId } }))!;
        const colegioId = usuario.colegioId!;

        // Siembra: acción propia COLEGIO_*, acción propia NO COLEGIO_* y acción de OTRO colegio
        await prisma.auditLog.create({
            data: {
                accion: "COLEGIO_CURSO_CREADO",
                tipoRecurso: "Curso",
                recursoId: `curso-aud-e2e-c${CICLO}`,
                usuarioId: sesion.usuarioId,
                colegioId,
                ipAddress: "test",
                userAgent: "test",
            },
        });
        await prisma.auditLog.create({
            data: {
                accion: "LOGIN",
                tipoRecurso: "Usuario",
                recursoId: sesion.usuarioId,
                usuarioId: sesion.usuarioId,
                colegioId,
                ipAddress: "test",
                userAgent: "test",
            },
        });
        const { crearColegioConAdmin } = await import("@/lib/reporte-test-utils");
        const { colegio: otroColegio } = await crearColegioConAdmin();
        await prisma.auditLog.create({
            data: {
                accion: "COLEGIO_CARGA_MASIVA",
                tipoRecurso: "CargaMasivaAlumnos",
                colegioId: otroColegio.id,
                ipAddress: "test",
                userAgent: "test",
            },
        });

        const { GET: auditoriaGET } = await import("@/app/api/colegio/auditoria/route");
        const res = await auditoriaGET(new Request("http://localhost:5005/api/colegio/auditoria?page=1&pageSize=50"));
        expect(res.status, "el colegio debe poder consultar su auditoría").toBe(200);
        const body = (await res.json()) as {
            items: { accion: string; colegioId: string | null; usuario?: { nombre: string; email: string } | null }[];
            pagination: { total: number };
        };

        // §9: la acción propia aparece con el actor identificado (formato legible para el rector)
        const propia = body.items.find((i) => i.accion === "COLEGIO_CURSO_CREADO");
        expect(propia, "§9: la acción del colegio debe listarse").toBeTruthy();
        expect(propia!.usuario?.nombre, "la fila identifica al actor por nombre, no por id crudo").toBe(usuario.nombre);
        expect(propia!.usuario?.email).toBe(usuario.email);

        // §9 aislamiento: ni acciones ajenas al colegio ni acciones no COLEGIO_* se cuelan
        expect(body.items.every((i) => i.colegioId === colegioId), "§9: solo filas del propio colegio").toBe(true);
        expect(body.items.every((i) => i.accion.startsWith("COLEGIO_")), "§9: solo acciones COLEGIO_*").toBe(true);
        expect(body.items.some((i) => i.accion === "LOGIN"), "una acción no COLEGIO_* no debe aparecer").toBe(false);
    });
});

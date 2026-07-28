/**
 * SPEC-114 · Journey colegio — el camino institucional completo:
 * admin crea el colegio DE VERDAD (POST /api/admin/colegios) → llega la contraseña
 * temporal → primer ingreso con cambio obligatorio (C-9/I-35) → el panel carga →
 * gestiona cursos y alumnos → sale con la sesión muerta. Cierra en BD (§9).
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

describe(`SPEC-114 · colegio (ciclo ${CICLO})`, () => {
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
        const resAlumno = await alumnosPOST(
            new Request(`http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: `Alumno E2E Ciclo ${CICLO}` }),
            }),
            { params: Promise.resolve({ id: curso.id }) }
        );
        expect(resAlumno.status, "el colegio debe poder agregar un alumno").toBe(201);
        const { alumno } = (await resAlumno.json()) as { alumno: { id: string } };
        await verificarAuditLog("COLEGIO_ALUMNO_CREADO", alumno.id);

        // El curso y el alumno se listan de vuelta
        const listaCursos = await cursosGET(new Request("http://localhost:5005/api/colegio/cursos"));
        expect(listaCursos.status).toBe(200);
        const listaAlumnos = await alumnosGET(new Request(`http://localhost:5005/api/colegio/cursos/${curso.id}/alumnos`), {
            params: Promise.resolve({ id: curso.id }),
        });
        expect(listaAlumnos.status).toBe(200);
        const { alumnos } = (await listaAlumnos.json()) as { alumnos: { id: string }[] };
        expect(alumnos.some((a) => a.id === alumno.id)).toBe(true);

        // Estadísticas del colegio cargan
        const { GET: estadisticasGET } = await import("@/app/api/colegio/estadisticas/route");
        const resStats = await estadisticasGET(new Request("http://localhost:5005/api/colegio/estadisticas"));
        expect(resStats.status, "las estadísticas del colegio deben cargar").toBe(200);

        // Salir: la sesión muere de verdad (I-35b)
        await salirYExigirSesionMuerta(sesion, HOME_POR_ROL.SCHOOL_ADMIN);
    });
});

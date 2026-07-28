/**
 * SPEC-114 · Journey operador y comité — la revisión humana por el camino real:
 * admin crea ambos roles por la API → el operador ve su bandeja, confirma un caso y
 * escala otro → el comité lo recibe, se lo asigna y resuelve. Cierra en BD (§9):
 * transición registrada, corrección persistida, AuditLog.
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo } from "../seed-ciclo";
import { entrarComo, verificarAuditLog, HOME_POR_ROL, salirYExigirSesionMuerta } from "../helpers";
import { crearTokenUsuario } from "@/lib/reporte-test-utils";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

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

describe(`SPEC-114 · operador y comité (ciclo ${CICLO})`, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
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
});

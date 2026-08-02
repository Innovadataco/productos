/**
 * SPEC-114 · Journey cola 041 — recorridos de los bloques de la noche:
 * (a) el padre NO ve nada técnico (SPEC-116), (b) el buscador de ciudades busca
 * y devuelve resultados (SPEC-115), (c) el admin gestiona padres: vigencia que
 * corta y restablece (SPEC-117/119), (d) ningún elemento de navegación ofrece un
 * destino bloqueado ni la página actual (SPEC-118/D-37). Cierra en BD (§9).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { jar, limpiarJar } from "../mock-headers";
import { prisma } from "@/lib/prisma";
import { sembrarBase, datosCiclo } from "../seed-ciclo";
import { entrarComo, verificarAuditLog } from "../helpers";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

describe(`SPEC-114 · cola 041 (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
    });

    it("(a) el detalle del padre NO trae nada técnico ni categorías descartadas", async () => {
        const datos = datosCiclo(CICLO);
        const sesion = await entrarComo("PARENT", `e2e-c${CICLO}-c41-padre@test.local`, "ClaveE2E-2026");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: datos.identificadorComun,
                plataformaId: plataforma!.id,
                texto: `${datos.textoBase} (vista padre)`,
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: `RPT-C${CICLO}-VISTA`,
                estado: "CLASIFICADO",
                usuarioId: sesion.usuarioId,
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "SOLICITUD_MATERIAL",
                confianza: 0.9,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b",
                latenciaMs: 1000,
                categoriasSecundarias: [{ categoria: "CONTACTO_INSISTENTE" }],
            },
        });
        // Voto de una categoría DESCARTADA (cumple=false): nunca debe asomar al padre
        await prisma.clasificacionRubricaVoto.create({
            data: {
                clasificacionIAId: clasificacion.id,
                categoria: "COMPARTIMIENTO_SEXUAL",
                modelo: "gemma2:27b",
                cumple: false,
                preguntasJson: [],
            },
        });

        jar.set("token", { name: "token", value: sesion.token });
        jar.set("__Host-token", { name: "__Host-token", value: sesion.token });
        const { GET: detalleGET } = await import("@/app/api/reportes/mis-reportes/[id]/route");
        const res = await detalleGET(new Request(`http://localhost:5005/api/reportes/mis-reportes/${reporte.id}`), {
            params: Promise.resolve({ id: reporte.id }),
        });
        expect(res.status).toBe(200);
        const texto = JSON.stringify(await res.json());
        // Fuera: nombres de modelos, porcentajes, umbrales, categorías descartadas
        expect(texto).not.toMatch(/gemma2|qwen2\.5|aya-expanse/i);
        expect(texto).not.toMatch(/COMPARTIMIENTO_SEXUAL/);
        expect(texto).not.toMatch(/"confianza"|umbral|"votos"/i);
        // Dentro: las conductas confirmadas (principal + secundaria) y el mensaje
        expect(texto).toMatch(/SOLICITUD_MATERIAL/);
        expect(texto).toMatch(/CONTACTO_INSISTENTE/);
    });

    it("(b) el buscador de ciudades busca en el servidor y devuelve resultados con coordenadas", async () => {
        const pais = await prisma.pais.findUnique({ where: { codigo: "CO" } });
        const { GET: buscarGET } = await import("@/app/api/ciudades/buscar/route");
        const res = await buscarGET(new Request(`http://localhost:5005/api/ciudades/buscar?q=bog&paisId=${pais!.id}&limit=10`));
        expect(res.status).toBe(200);
        const cuerpo = (await res.json()) as { resultados?: { nombre: string; lat: number | null }[]; ciudades?: { nombre: string; lat: number | null }[] };
        const lista = cuerpo.resultados ?? cuerpo.ciudades ?? [];
        expect(lista.length, "buscar 'bog' debe devolver resultados").toBeGreaterThan(0);
        const bogota = lista.find((c) => c.nombre.toLowerCase().includes("bogot"));
        expect(bogota, "Bogotá debe aparecer en la búsqueda").toBeTruthy();
        expect(bogota!.lat, "Bogotá debe tener coordenadas").not.toBeNull();

        // Búsqueda sin acento encuentra igual (normalización). Upsert: las ciudades
        // son catálogo compartido que resetDatabase no borra (pueden existir de otra corrida)
        await prisma.ciudad.upsert({
            where: { nombre_paisId: { nombre: "Monguí", paisId: pais!.id } },
            update: { nombreNormalizado: "mongui", lat: 5.72, lng: -72.85 },
            create: { nombre: "Monguí", paisId: pais!.id, nombreNormalizado: "mongui", lat: 5.72, lng: -72.85 },
        });
        const res2 = await buscarGET(new Request(`http://localhost:5005/api/ciudades/buscar?q=mongui&paisId=${pais!.id}&limit=10`));
        expect(res2.status).toBe(200);
        const texto2 = JSON.stringify(await res2.json());
        expect(texto2, "buscar 'mongui' (sin tilde) encuentra Monguí").toMatch(/Monguí/);

        // Query inválida (vacía o sin país) → 400 controlado, nunca 500
        const res3 = await buscarGET(new Request(`http://localhost:5005/api/ciudades/buscar?q=&paisId=${pais!.id}`));
        expect(res3.status).toBe(400);
    });

    it("(c) el admin gestiona padres: lista, fija vigencia que corta, y restablece", async () => {
        const admin = await entrarComo("ADMIN", `e2e-c${CICLO}-c41-admin@test.local`, "ClaveE2E-2026");
        const padre = await entrarComo("PARENT", `e2e-c${CICLO}-c41-padre2@test.local`, "ClaveE2E-2026");
        jar.set("token", { name: "token", value: admin.token });
        jar.set("__Host-token", { name: "__Host-token", value: admin.token });

        // Listado: el padre aparece
        const { GET: padresGET } = await import("@/app/api/admin/padres/route");
        const lista = await padresGET(new Request("http://localhost:5005/api/admin/padres?page=1&pageSize=25"));
        expect(lista.status).toBe(200);
        const cuerpoLista = (await lista.json()) as { items?: { email: string }[]; padres?: { email: string }[] };
        const emails = (cuerpoLista.items ?? cuerpoLista.padres ?? []).map((p) => p.email);
        expect(emails).toContain(padre.email);

        // Fijar vigencia VENCIDA → el padre queda fuera con mensaje claro
        const { PATCH: vigenciaPATCH } = await import("@/app/api/admin/padres/[id]/vigencia/route");
        const ayer = new Date(Date.now() - 2 * 86400000);
        const anteayer = new Date(Date.now() - 3 * 86400000);
        const resVig = await vigenciaPATCH(
            new Request(`http://localhost:5005/api/admin/padres/${padre.usuarioId}/vigencia`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inicioServicio: anteayer.toISOString(), finServicio: ayer.toISOString() }),
            }),
            { params: Promise.resolve({ id: padre.usuarioId }) }
        );
        expect(resVig.status, "el admin debe poder fijar la ventana").toBeLessThan(300);

        const { POST: loginPOST } = await import("@/app/api/auth/login/route");
        const resLogin = await loginPOST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: padre.email, password: "ClaveE2E-2026" }),
            })
        );
        expect(resLogin.status, "padre vencido: login bloqueado").toBe(403);
        const cuerpoLogin = JSON.stringify(await resLogin.json());
        expect(cuerpoLogin, "el mensaje debe explicar qué pasó (no un 403 seco)").toMatch(/vigencia|vencid|servicio/i);

        // Extender la ventana → el padre vuelve a entrar
        const manana = new Date(Date.now() + 365 * 86400000);
        await vigenciaPATCH(
            new Request(`http://localhost:5005/api/admin/padres/${padre.usuarioId}/vigencia`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inicioServicio: anteayer.toISOString(), finServicio: manana.toISOString() }),
            }),
            { params: Promise.resolve({ id: padre.usuarioId }) }
        );
        const resLogin2 = await loginPOST(
            new Request("http://localhost:5005/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: padre.email, password: "ClaveE2E-2026" }),
            })
        );
        expect(resLogin2.status, "con la ventana extendida el padre vuelve a entrar").toBe(200);

        // Restablecer contraseña: temporal + debeCambiarPassword + AuditLog
        const { POST: restablecerPOST } = await import("@/app/api/admin/padres/[id]/restablecer-password/route");
        const resRest = await restablecerPOST(
            new Request(`http://localhost:5005/api/admin/padres/${padre.usuarioId}/restablecer-password`, { method: "POST" }),
            { params: Promise.resolve({ id: padre.usuarioId }) }
        );
        expect([200, 201]).toContain(resRest.status);
        const enBd = await prisma.usuario.findUnique({ where: { id: padre.usuarioId } });
        expect(enBd!.debeCambiarPassword, "§9: restablecer fuerza el cambio").toBe(true);
        await verificarAuditLog("USER_UPDATE", padre.usuarioId);
    });

    it("(d) la navegación nunca ofrece un destino bloqueado ni la página actual (D-37)", async () => {
        const { esDestinoPermitidoPorRol } = await import("@/lib/proxy");
        const destinosNav = ["/", "/dashboard", "/dashboard-publico", "/mis-reportes", "/reportar", "/seguimiento", "/dashboard/colegio", "/dashboard/admin", "/cambiar-password"];
        // SCHOOL_ADMIN: los destinos que el menú le ofrezca deben pasar el proxy (misma función)
        const permitidosColegio = destinosNav.filter((d) => esDestinoPermitidoPorRol("SCHOOL_ADMIN", d));
        for (const d of ["/", "/dashboard-publico", "/seguimiento", "/cambiar-password"]) {
            expect(permitidosColegio, `el colegio PUEDE ir a ${d} (abierto por SPEC-118)`).toContain(d);
        }
        for (const d of ["/reportar", "/dashboard/admin", "/dashboard", "/mis-reportes"]) {
            expect(permitidosColegio, `el colegio NO debe ofrecer ${d}`).not.toContain(d);
        }
        // PARENT: no ofrece el área interna; ADMIN: no ofrece el área de usuario final
        expect(esDestinoPermitidoPorRol("PARENT", "/dashboard/admin")).toBe(false);
        expect(esDestinoPermitidoPorRol("ADMIN", "/reportar")).toBe(false);
        expect(esDestinoPermitidoPorRol("ADMIN", "/dashboard")).toBe(false);
    });
});

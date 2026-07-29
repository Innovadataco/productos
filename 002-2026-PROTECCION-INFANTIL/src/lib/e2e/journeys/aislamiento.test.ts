/**
 * SPEC-114 · Journey aislamiento — la matriz de NO-acceso por rol, por el camino
 * real del proxy. Un 403/redirect correcto es el resultado esperado: lo que cada
 * rol NO debe alcanzar es tan importante como lo que sí (I-36, lección del piloto).
 */
import { describe, it, expect, beforeEach } from "vitest";
import "../mock-headers";
import { limpiarJar } from "../mock-headers";
import { sembrarBase } from "../seed-ciclo";
import { entrarComo, viaProxy, esperarBloqueo, esperarPasoLibre, type Sesion } from "../helpers";
import { esDestinoPermitidoPorRol } from "@/lib/proxy";
import type { RolUsuario } from "@prisma/client";

const CICLO = Number(process.env.E2E_CICLO ?? "1");

interface Caso {
    rol: RolUsuario;
    ruta: string;
    porQue: string;
}

/** Matriz de aislamiento: cada fila es un camino que DEBE estar cerrado. */
const CASOS_BLOQUEO: Caso[] = [
    // PARENT: nada del área interna ni del colegio interno
    { rol: "PARENT", ruta: "/dashboard/admin", porQue: "un padre no entra al panel interno" },
    { rol: "PARENT", ruta: "/dashboard/admin/comite", porQue: "un padre no entra al comité" },
    { rol: "PARENT", ruta: "/api/admin/operadores", porQue: "un padre no alcanza la API interna" },
    // SCHOOL_ADMIN: aislado a su módulo (I-25/I-36); SPEC-118 (D-37) abre SOLO el
    // área pública de lectura — todo lo interno/padres/reportar sigue cerrado.
    { rol: "SCHOOL_ADMIN", ruta: "/dashboard/admin", porQue: "el colegio no entra al panel de plataforma" },
    { rol: "SCHOOL_ADMIN", ruta: "/dashboard", porQue: "el colegio no usa el área de padres" },
    { rol: "SCHOOL_ADMIN", ruta: "/mis-reportes", porQue: "el colegio no tiene Mis reportes (módulo de padres)" },
    { rol: "SCHOOL_ADMIN", ruta: "/reportar", porQue: "la cuenta institucional no reporta" },
    { rol: "SCHOOL_ADMIN", ruta: "/api/reportes", porQue: "crear reportes sigue vedado: solo se abrió el seguimiento (GET)" },
    { rol: "SCHOOL_ADMIN", ruta: "/api/admin/operadores", porQue: "el colegio no alcanza la API interna" },
    // OPERADOR: sin gestión de comité ni área de usuario final
    { rol: "OPERADOR", ruta: "/dashboard/admin/comite/gestion", porQue: "el operador no gestiona el comité (admin-only)" },
    { rol: "OPERADOR", ruta: "/dashboard", porQue: "el operador no usa el área de padres" },
    { rol: "OPERADOR", ruta: "/mis-reportes", porQue: "el operador no tiene Mis reportes" },
    { rol: "OPERADOR", ruta: "/reportar", porQue: "la cuenta interna no reporta" },
    // COMITE_VALIDACION: sin gestión ni área de usuario final
    { rol: "COMITE_VALIDACION", ruta: "/dashboard/admin/comite/gestion", porQue: "el comité no se autogestiona (admin-only)" },
    { rol: "COMITE_VALIDACION", ruta: "/dashboard", porQue: "el comité no usa el área de padres" },
    { rol: "COMITE_VALIDACION", ruta: "/reportar", porQue: "la cuenta interna no reporta" },
    // ADMIN: tampoco usa el área de usuario final ni reporta
    { rol: "ADMIN", ruta: "/dashboard", porQue: "el admin no usa el área de padres" },
    { rol: "ADMIN", ruta: "/mis-reportes", porQue: "el admin no tiene Mis reportes" },
    { rol: "ADMIN", ruta: "/reportar", porQue: "la cuenta interna no reporta (I-36)" },
];

const EMAILS: Record<RolUsuario, string> = {
    PARENT: `e2e-c${CICLO}-ais-padre@test.local`,
    SCHOOL_ADMIN: "",
    ADMIN: `e2e-c${CICLO}-ais-admin@test.local`,
    OPERADOR: `e2e-c${CICLO}-ais-op@test.local`,
    COMITE_VALIDACION: `e2e-c${CICLO}-ais-comite@test.local`,
};

describe(`SPEC-114 · aislamiento por rol (ciclo ${CICLO})`, { timeout: 30_000 }, () => {
    const sesiones = new Map<RolUsuario, Sesion>();

    beforeEach(async () => {
        await sembrarBase();
        limpiarJar();
        sesiones.clear();
    });

    async function sesion(rol: RolUsuario): Promise<Sesion> {
        if (!sesiones.has(rol)) {
            sesiones.set(rol, await entrarComo(rol, EMAILS[rol], "ClaveE2E-2026"));
        }
        return sesiones.get(rol)!;
    }

    it("matriz de NO-acceso: cada camino prohibido está cerrado de verdad", async () => {
        for (const caso of CASOS_BLOQUEO) {
            const s = await sesion(caso.rol);
            esperarBloqueo(await viaProxy(s, caso.ruta), `${caso.rol} → ${caso.ruta}: ${caso.porQue}`);
        }
    });

    it("sin sesión, toda ruta privada devuelve al login o 401", async () => {
        const { proxy } = await import("@/lib/proxy");
        const { NextRequest } = await import("next/server");
        for (const ruta of ["/dashboard", "/dashboard/colegio", "/dashboard/admin", "/mis-reportes"]) {
            const res = await proxy(new NextRequest(`http://localhost:5005${ruta}`));
            esperarBloqueo(res, `anónimo → ${ruta}: debe devolver al login`);
        }
        const api = await proxy(new NextRequest("http://localhost:5005/api/admin/operadores"));
        expect(api.status, "anónimo → API interna: 401").toBe(401);
    });

    it("SPEC-118 (D-37): el colegio alcanza el área pública de SOLO LECTURA por el proxy real", async () => {
        // Decisión de producto NUEVA y explícita (ZEUS/D-37, NO ablandamiento):
        // el aislamiento total no aportaba seguridad (son estadísticas públicas
        // agregadas, visibles incluso sin sesión) y creaba clics muertos.
        const s = await sesion("SCHOOL_ADMIN");
        const abiertas = ["/", "/dashboard-publico", "/seguimiento", "/api/consulta", "/api/estadisticas-publicas", "/api/reportes/seguimiento/RPT-E2E-000001"];
        for (const ruta of abiertas) {
            esperarPasoLibre(await viaProxy(s, ruta), `SCHOOL_ADMIN → ${ruta}: pública de solo lectura, debe pasar`);
        }
        // Y la superficie cerrada no se movió:
        esperarBloqueo(await viaProxy(s, "/dashboard/admin"), "SCHOOL_ADMIN → /dashboard/admin sigue cerrado");
        esperarBloqueo(await viaProxy(s, "/reportar"), "SCHOOL_ADMIN → /reportar sigue cerrado (no reporta)");
    });

    it("el criterio del menú es el MISMO del proxy (sin segunda fuente de verdad)", async () => {
        // I-36: el menú se alimenta de esDestinoPermitidoPorRol; aquí se verifica que su
        // criterio coincide con lo que el proxy efectivamente deja pasar para cada rol.
        const comprobaciones: [RolUsuario, string, boolean][] = [
            ["PARENT", "/dashboard", true],
            ["PARENT", "/mis-reportes", true],
            ["PARENT", "/reportar", true],
            ["PARENT", "/dashboard/admin", false],
            ["SCHOOL_ADMIN", "/dashboard/colegio", true],
            ["SCHOOL_ADMIN", "/dashboard", false],
            ["SCHOOL_ADMIN", "/mis-reportes", false],
            ["SCHOOL_ADMIN", "/reportar", false],
            // SPEC-118 (D-37): el área pública de solo lectura queda ABIERTA al colegio
            ["SCHOOL_ADMIN", "/", true],
            ["SCHOOL_ADMIN", "/dashboard-publico", true],
            ["SCHOOL_ADMIN", "/seguimiento", true],
            ["SCHOOL_ADMIN", "/api/consulta", true],
            ["SCHOOL_ADMIN", "/api/estadisticas-publicas", true],
            ["SCHOOL_ADMIN", "/api/reportes/seguimiento/RPT-E2E-000001", true],
            ["OPERADOR", "/dashboard/admin", true],
            ["OPERADOR", "/dashboard", false],
            ["OPERADOR", "/reportar", false],
            ["COMITE_VALIDACION", "/dashboard/admin/comite", true],
            ["COMITE_VALIDACION", "/dashboard", false],
            ["ADMIN", "/dashboard/admin", true],
            ["ADMIN", "/reportar", false],
        ];
        for (const [rol, ruta, esperado] of comprobaciones) {
            expect(esDestinoPermitidoPorRol(rol, ruta), `menú ${rol} → ${ruta}`).toBe(esperado);
            // Y el proxy concuerda: permitido pasa, prohibido bloquea
            const s = await sesion(rol);
            const res = await viaProxy(s, ruta);
            if (esperado) {
                esperarPasoLibre(res, `proxy ${rol} → ${ruta} (menú lo ofrece: debe pasar)`);
            } else {
                esperarBloqueo(res, `proxy ${rol} → ${ruta} (menú NO lo ofrece: debe bloquear)`);
            }
        }
    });
});

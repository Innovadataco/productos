/**
 * SPEC-435 (Jelkin vivo 04-09) · Candado permanente: los grants del rol
 * VERIFICADOR NO pueden crecer más allá de su único módulo.
 *
 * Contrato Jelkin verbatim:
 *   «la cuenta nace con `admin_verificacion_profesionales` y nada más:
 *    no hereda módulos de admin».
 *   «el menú del verificador no muestra ítems de operador, comité ni padre».
 *
 * El defecto que este candado caza (lección I-278/I-299): un rol nuevo hereda
 * el menú de otro rol y termina con acciones que no le tocan (I-299 = el
 * PROFESIONAL heredaba `PADRE_NAV_ITEMS`). Como el nav lateral se filtra por
 * `modulosPermitidosParaRol`, contaminar `CLAVES_POR_ROL.VERIFICADOR` es
 * exactamente el vector para contaminar su menú.
 *
 * Vigilancia por CONDUCTA (no por texto): la constante se importa y se
 * compara — mutarla en el archivo mata este test.
 */
import { describe, it, expect } from "vitest";
import { CLAVES_POR_ROL } from "../../prisma/seed-modulos-grants";

describe("SPEC-435 · VERIFICADOR nace con un solo módulo (contrato Jelkin)", () => {
    it("solo tiene `admin_verificacion_profesionales`", () => {
        expect(CLAVES_POR_ROL.VERIFICADOR).toEqual(["admin_verificacion_profesionales"]);
    });

    it("no hereda módulos de operador, comité, colegio ni padre", () => {
        const prohibidos = [
            // Operador (I-274)
            "operadores",
            "bandeja_reportes",
            // Comité
            "comite",
            "comite_bandeja",
            "comite_guias_accion",
            "comite_auditoria",
            // Colegio
            "colegios",
            "colegios_gestion",
            // Padres (I-299 · un rol no hereda menú de otro)
            "padres",
            "usuarios_admin",
            // Pagos / configuración / analítica (todo lo del ADMIN)
            "pagos_admin",
            "configuracion_sistema",
            "analisis_admin",
            "analisis_recomendaciones",
            "audit_logs",
            "estadisticas",
            "anti_abuso",
            // Sistema (crítico)
            "sistema_admin",
            // Gestión de operadores/profesionales/verificadores (admin puro)
            "profesionales_admin",
            "verificadores_admin",
        ];
        const contaminados = prohibidos.filter((clave) => CLAVES_POR_ROL.VERIFICADOR.includes(clave));
        expect(
            contaminados,
            [
                "SPEC-435 · VERIFICADOR heredó módulos que no le tocan:",
                ...contaminados.map((c) => `  · ${c}`),
                "",
                "Contrato Jelkin: «un rol, una persona, un trabajo». El verificador",
                "SOLO abre solicitudes/incidentes de profesionales. Si el menú necesita",
                "otra pieza, se piensa dos veces antes de otorgar — es una decisión",
                "de arquitectura, no un accidente.",
            ].join("\n"),
        ).toEqual([]);
    });
});

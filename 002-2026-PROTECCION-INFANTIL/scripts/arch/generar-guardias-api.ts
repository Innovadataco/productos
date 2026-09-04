// SPEC-400b (I-236 · I-239) · FASE DE ANÁLISIS — el borde que se abre solo
// cada 5 minutos.
//
// Este generador NO decide el cierre. Produce el inventario COMPLETO de rutas
// /api/** con: qué guardianes aplican hoy CON cookie, qué pasa SIN cookie
// (fail-open medido a través de `middleware.ts`), y una recomendación
// fail-closed por ruta: bloquear / exenta / decidir. Las decisiones difíciles
// van marcadas "decidir" con dos opciones — SPEC-400b implementación decide.
//
// Fuente única de la lógica: helpers reales de `src/lib/routing/guardias.ts`
// (no reimplementamos ninguna regla) y `src/lib/routing/roles-titulares.ts`.
// La verdad del middleware está en el código; este script solo LO LEE.
//
// Uso:
//   npx tsx scripts/arch/generar-guardias-api.ts
//   npx tsx scripts/arch/generar-guardias-api.ts --check
//
// Salida: docs/architecture/04-guardias-api.md.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARTEFACTOS, encabezadoGenerado } from "./artefactos";
import { inventarioRutasApp } from "./lib/rutas-app";
import { RUTA_APP } from "./lib/paths";
import {
    esRutaPublica,
    esRutaSesion,
    esExentaConsentimiento,
    esExentaCambiarPassword,
    esExentaCamino,
    esExentaVigencia,
    tieneVigencia,
} from "@/lib/routing/guardias";
import { esTitularDelDato, tieneCaminoGuiado } from "@/lib/routing/roles-titulares";

const ARTEFACTO = resolve(__dirname, "..", "..", "docs", "architecture", "04-guardias-api.md");
const PROPIO = ARTEFACTOS.find((a) => a.archivo === "04-guardias-api.md")!;
const GENERADOR = PROPIO.generador;

// Roles con potencial de disparar guardianes. VERIFICADOR entró en SPEC-408
// pero se incluye aquí para que la matriz esté completa cuando su código
// aterrice — el generador no distingue "existe" de "existirá".
const ROLES = ["PARENT", "SCHOOL_ADMIN", "COMITE_CONVIVENCIA", "COMITE_VALIDACION", "OPERADOR", "ADMIN", "PROFESIONAL", "VERIFICADOR"] as const;

// Familias de rutas que se marcan "exenta" del fail-closed propuesto sin ambigüedad:
// - /api/auth: login, registro, cambiar-password, activar, logout, recuperar.
// - /api/sesion/al-dia: rebote que re-sella la cookie (bloquearlo cicla al usuario).
// - /api/vigencia/refresh: re-emite cookie de estado (bloquearlo deja al usuario sin manera de destrabarse).
// - /api/health, /api/monitor/notif: monitoreo externo (curl sin cookie).
// - /api/webhooks/**: autenticados por firma propia (HMAC-Svix de Resend).
// - /api/publico/**: familia diseñada sin auth (SPEC-346).
// - /api/consulta, /api/reportes, /api/estadisticas-publicas, /api/plataformas,
//   /api/paises, /api/departamentos, /api/ciudades, /api/config/parametros/publicos,
//   /api/docs: catálogos y consulta pública.
// - /api/me: header lee sesión (no evalúa consentimiento/vigencia por diseño).
// - /api/consentimiento: es EL camino de salida del guardián de consentimiento.
const PREFIJOS_EXENTOS_FAIL_CLOSED = [
    "/api/auth",
    "/api/sesion/al-dia",
    "/api/vigencia/refresh",
    "/api/health",
    "/api/monitor/notif",
    "/api/webhooks/",
    "/api/publico/",
    "/api/consulta",
    "/api/reportes",
    "/api/estadisticas-publicas",
    "/api/plataformas",
    "/api/paises",
    "/api/departamentos",
    "/api/ciudades",
    "/api/config/parametros/publicos",
    "/api/docs",
    "/api/me",
    "/api/consentimiento",
];

// Familias donde el CEO dijo "no decidas": pagos (¿deben tener vigencia?),
// suscripción (misma pregunta). Se marcan "decidir" con las dos opciones.
const PREFIJOS_DECIDIR_FAIL_CLOSED = [
    "/api/pagos/",
    "/api/padre/suscripcion",
    "/api/colegio/suscripcion",
];

type Veredicto = "bloquear" | "exenta" | "decidir";

interface RutaAPI {
    ruta: string;              // ej: /api/admin/reportes/[id]/expediente
    rutaEval: string;          // ej: /api/admin/reportes/muestra/expediente
    archivo: string;
    esPublica: boolean;
    esSesion: boolean;
    // Guardianes que APLICAN hoy CON cookie (rol-agnóstico donde aplica).
    aplicaConsentimiento: boolean;  // aplica a titulares; el flag es "no está exenta".
    aplicaCambioPassword: boolean;  // aplica a cualquier rol; flag "no está exenta".
    aplicaCaminoPARENT: boolean;
    aplicaCaminoSCHOOL_ADMIN: boolean;
    aplicaVigencia: Partial<Record<typeof ROLES[number], boolean>>; // por rol con vigencia
    // Sin cookie sesion_estado (fail-open medido leyendo middleware.ts):
    //   el bloque `if (estado)` es falso → los pasos 4/5/6 se saltan y la
    //   ruta pasa sin evaluar. EXCEPCIÓN: para HTML de PARENT/SCHOOL_ADMIN
    //   hay un rebote a /api/sesion/al-dia, pero eso NO aplica a /api/**.
    // Por eso: sin cookie, TODAS las /api/** pasan. Se registra para dejarlo
    // explícito en el documento, no como propiedad variable.
    failOpenSinCookie: "PASA" | "REBOTE_CAMINO";
    // Recomendación fail-closed:
    failClosed: Veredicto;
    // Motivo humano cuando failClosed !== "bloquear".
    motivo: string;
}

function evaluarRuta(rutaEval: string, archivo: string, rutaMostrable: string): RutaAPI {
    const esPub = esRutaPublica(rutaEval);
    const esSes = esRutaSesion(rutaEval);

    const aplicaConsentimiento = !esPub && !esSes && !esExentaConsentimiento(rutaEval);
    const aplicaCambioPassword = !esPub && !esSes && !esExentaCambiarPassword(rutaEval);
    const aplicaCaminoPARENT = !esPub && !esSes && !esExentaCamino(rutaEval, "PARENT");
    const aplicaCaminoSCHOOL_ADMIN = !esPub && !esSes && !esExentaCamino(rutaEval, "SCHOOL_ADMIN");

    const aplicaVigencia: RutaAPI["aplicaVigencia"] = {};
    for (const rol of ROLES) {
        if (!tieneVigencia(rol)) continue;
        aplicaVigencia[rol] = !esPub && !esSes && !esExentaVigencia(rutaEval, rol);
    }

    // fail-open medido: middleware sin cookie de estado NO evalúa 4/5/6.
    // Rebote de camino solo para HTML (`!pathname.startsWith("/api/")`).
    const failOpenSinCookie: "PASA" | "REBOTE_CAMINO" = "PASA";

    // Decisión fail-closed:
    let failClosed: Veredicto;
    let motivo = "";
    if (esPub) {
        failClosed = "exenta";
        motivo = "pública por diseño (sin JWT)";
    } else if (esSes) {
        failClosed = "exenta";
        motivo = "ruta de sesión (necesaria para salir del bloqueo)";
    } else if (PREFIJOS_EXENTOS_FAIL_CLOSED.some((p) => rutaEval.startsWith(p))) {
        failClosed = "exenta";
        motivo = "familia explícita (health/webhooks/auth/vigencia/publico/catálogos)";
    } else if (PREFIJOS_DECIDIR_FAIL_CLOSED.some((p) => rutaEval.startsWith(p))) {
        failClosed = "decidir";
        motivo = "pagos/suscripción: opciones (a) tratar como cualquier /api/ y exigir vigencia; (b) exenta explícita porque pagar SIN vigencia es cómo se sale de la vencida";
    } else {
        failClosed = "bloquear";
        motivo = "cae en el catálogo genérico";
    }
    return {
        ruta: rutaMostrable,
        rutaEval,
        archivo,
        esPublica: esPub,
        esSesion: esSes,
        aplicaConsentimiento,
        aplicaCambioPassword,
        aplicaCaminoPARENT,
        aplicaCaminoSCHOOL_ADMIN,
        aplicaVigencia,
        failOpenSinCookie,
        failClosed,
        motivo,
    };
}

function listarApis(): RutaAPI[] {
    const inv = inventarioRutasApp(RUTA_APP)
        .filter((r) => r.tipo === "api" && r.ruta.startsWith("/api/"));
    return inv.map((r) => evaluarRuta(r.rutaEval, r.archivo, r.ruta))
        .sort((a, b) => a.ruta.localeCompare(b.ruta));
}

function encabezado(): string[] {
    return [
        encabezadoGenerado(PROPIO.generador, PROPIO.fuentes),
        "# 04 · Guardianes de `/api/**` (fase de análisis — SPEC-400b)",
        "",
        "> Este documento **es un análisis, no un fix**. La corrección (`middleware.ts`, `proxy.ts`, tests nuevos) se radica en un PR aparte con este inventario en la mano.",
        "",
        "## Fenómeno medido (I-236 · I-239)",
        "",
        "El middleware evalúa los guardianes 4 (`consentimiento`), 5 (`cambio-de-password` + `camino`) y 6 (`vigencia`) SOLO cuando puede leer la cookie firmada `sesion_estado`. Si la cookie **no está** (caducó a los 5 min, es de antes del despliegue, o el navegador la perdió), el bloque `if (estado) { … }` es falso y las tres etapas **se saltan enteras**: la request PASA sin evaluar. Para pantallas HTML de `PARENT` y `SCHOOL_ADMIN` existe un rebote explícito a `/api/sesion/al-dia` que re-sella la cookie (SPEC-339 · A-67), pero **ese rebote NO cubre `/api/**`**: cualquier `/api/**` sin cookie pasa. Ese es el «borde que se abre solo cada 5 minutos».",
        "",
        "## Alcance de este PR",
        "",
        "1. **Inventario completo** de todas las rutas `/api/**` con los guardianes que aplican HOY con cookie, ejecutando los helpers reales de `src/lib/routing/guardias.ts`.",
        "2. **Fail-open medido**: qué pasa sin cookie por ruta (siempre `PASA`; se documenta para dejar explícito el mapa).",
        "3. **Recomendación fail-closed por ruta**: `bloquear` / `exenta` / `decidir`. Las decisiones difíciles quedan marcadas `decidir` con dos opciones — SPEC-400b implementación decide.",
        "4. **Matriz de pruebas de cookie-ausente** por guardián y por rol, que hoy no existe (`middleware-api-guardias.test.ts` solo cubre CON cookie).",
        "",
        "Candado 22 v5: enumeración completa, no muestreo.",
        "",
    ];
}

function renderResumen(apis: RutaAPI[]): string[] {
    const bloquear = apis.filter((r) => r.failClosed === "bloquear").length;
    const exenta = apis.filter((r) => r.failClosed === "exenta").length;
    const decidir = apis.filter((r) => r.failClosed === "decidir").length;
    return [
        "## Resumen",
        "",
        `- Total de rutas \`/api/**\`: **${apis.length}**`,
        `- Recomendación **bloquear** en fail-closed: **${bloquear}**`,
        `- Recomendación **exenta** en fail-closed: **${exenta}**`,
        `- **Decidir** (requiere decisión CEO/Jelkin): **${decidir}**`,
        "",
    ];
}

function renderTablaGuardianes(apis: RutaAPI[]): string[] {
    const lineas: string[] = [
        "## Guardianes que aplican HOY (con cookie `sesion_estado`)",
        "",
        "Cada celda es `SÍ` si el guardián evalúa la ruta cuando la cookie existe. `no` si la ruta está exenta. `—` si la ruta es pública (`P`) o de sesión (`S`) y por diseño no llega a los guardianes.",
        "",
        "Camino y vigencia se ramifican por rol: se listan las dos ramas relevantes (PARENT vs SCHOOL_ADMIN para camino; roles con vigencia en columnas separadas).",
        "",
        "| Ruta | Tipo | Consent. | Camb. clave | Camino PARENT | Camino SCHOOL_ADMIN | Vigencia PARENT | Vigencia SCHOOL_ADMIN |",
        "|------|------|----------|-------------|---------------|---------------------|-----------------|-----------------------|",
    ];
    for (const r of apis) {
        const tipo = r.esPublica ? "P" : r.esSesion ? "S" : "R";
        const cel = (aplica: boolean, natal: boolean) => {
            if (natal) return "—";
            return aplica ? "SÍ" : "no";
        };
        const natural = r.esPublica || r.esSesion;
        lineas.push(
            `| \`${r.ruta}\` | ${tipo} | ${cel(r.aplicaConsentimiento, natural)} | ${cel(r.aplicaCambioPassword, natural)} | ${cel(r.aplicaCaminoPARENT, natural)} | ${cel(r.aplicaCaminoSCHOOL_ADMIN, natural)} | ${cel(!!r.aplicaVigencia.PARENT, natural)} | ${cel(!!r.aplicaVigencia.SCHOOL_ADMIN, natural)} |`
        );
    }
    lineas.push("");
    return lineas;
}

function renderTablaFailClosed(apis: RutaAPI[]): string[] {
    const lineas: string[] = [
        "## Recomendación fail-closed por ruta",
        "",
        "**Regla de lectura**:",
        "",
        "- `exenta`: entra en el catálogo explícito de rutas que deben responder sin cookie de estado (login, health, webhooks, catálogos, rebotes de sesión, pagos-si-eso-es-lo-que-decide-CEO).",
        "- `decidir`: hay dos lecturas legítimas; SPEC-400b implementación decide con el CEO.",
        "- `bloquear`: si el fail-closed se activa, esta ruta responde `401`/`403` cuando la cookie está ausente (default de «cualquier /api/ regular»).",
        "",
        "| Ruta | Fail-open hoy | Fail-closed propuesto | Motivo |",
        "|------|---------------|-----------------------|--------|",
    ];
    for (const r of apis) {
        lineas.push(`| \`${r.ruta}\` | ${r.failOpenSinCookie} | **${r.failClosed}** | ${r.motivo} |`);
    }
    lineas.push("");
    return lineas;
}

function renderMatrizPruebas(apis: RutaAPI[]): string[] {
    const lineas: string[] = [
        "## Matriz de pruebas de cookie-ausente por guardián × rol",
        "",
        "`middleware-api-guardias.test.ts` (SPEC-329) hoy solo cubre el escenario CON cookie. Esta matriz enumera los casos SIN cookie que faltan: para cada rol autenticado + guardián, qué debería contestar la ruta si se aplica fail-closed.",
        "",
        "| Guardián | Rol | Escenario | Hoy responde | Con fail-closed debería responder |",
        "|----------|-----|-----------|--------------|-----------------------------------|",
    ];
    const guardianes: Array<{ nombre: string; aplicaPorRol: (rol: string) => boolean; code: string }> = [
        { nombre: "consentimiento", aplicaPorRol: (rol) => esTitularDelDato(rol as any), code: "CONSENTIMIENTO_REQUERIDO" },
        { nombre: "cambio-de-password", aplicaPorRol: () => true, code: "CAMBIO_PASSWORD_REQUERIDO" },
        { nombre: "camino", aplicaPorRol: (rol) => tieneCaminoGuiado(rol as any), code: "CAMINO_INCOMPLETO" },
        { nombre: "vigencia", aplicaPorRol: (rol) => tieneVigencia(rol), code: "VIGENCIA_REQUERIDA" },
    ];
    for (const g of guardianes) {
        for (const rol of ROLES) {
            if (!g.aplicaPorRol(rol)) continue;
            lineas.push(`| ${g.nombre} | ${rol} | POST /api/ regular sin \`sesion_estado\` | **200/OK (fail-open)** | \`403 { code: "${g.code}" }\` |`);
        }
    }
    lineas.push("");
    lineas.push("**Cobertura pendiente**: cada fila de arriba requiere un test que valida el comportamiento fail-closed. Se implementan en el PR de SPEC-400b, no acá.");
    lineas.push("");
    return lineas;
}

function renderDecisionesAbiertas(apis: RutaAPI[]): string[] {
    const decidir = apis.filter((r) => r.failClosed === "decidir");
    if (decidir.length === 0) return [];
    const lineas: string[] = [
        "## Decisiones abiertas (`decidir`)",
        "",
        `${decidir.length} rutas caen fuera del catálogo «exenta obvia» pero cuya exención es discutible. Las dos opciones se listan aquí para que Jelkin/CEO decida antes de codificar.`,
        "",
        "| Ruta | Opciones |",
        "|------|----------|",
    ];
    for (const r of decidir) {
        lineas.push(`| \`${r.ruta}\` | ${r.motivo} |`);
    }
    lineas.push("");
    return lineas;
}

export function generar(): string {
    const apis = listarApis();
    const lineas = [
        ...encabezado(),
        ...renderResumen(apis),
        ...renderTablaGuardianes(apis),
        ...renderTablaFailClosed(apis),
        ...renderDecisionesAbiertas(apis),
        ...renderMatrizPruebas(apis),
    ];
    if (lineas[lineas.length - 1] !== "") lineas.push("");
    return lineas.join("\n");
}

function main(): void {
    const argv = process.argv.slice(2);
    const check = argv.includes("--check");
    const nuevo = generar();
    if (check) {
        const actual = readFileSync(ARTEFACTO, "utf-8");
        if (actual !== nuevo) {
            console.error("[SPEC-400b] docs/architecture/04-guardias-api.md está desactualizado.");
            console.error(`[SPEC-400b] Regenerar con: npx tsx ${GENERADOR} y commitear.`);
            process.exit(1);
        }
        console.log("[SPEC-400b] docs/architecture/04-guardias-api.md al día.");
        return;
    }
    writeFileSync(ARTEFACTO, nuevo);
    console.log("[SPEC-400b] docs/architecture/04-guardias-api.md reescrito.");
}

if (require.main === module) main();

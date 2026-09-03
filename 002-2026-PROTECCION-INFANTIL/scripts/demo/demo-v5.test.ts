/**
 * SPEC-412 · candados del poblador que marca lo que siembra. Lógica pura, sin BD.
 *
 * Estos tests defienden la regla del BRIEF A-76 — *el marcador va en
 * `demo_marcado`, nunca en la llave primaria* — en los tres puntos donde se
 * puede romper: el poblador fabricando ids, el validador ablandándose para
 * aceptar los ids viejos, y el borrado quedándose corto.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { cuidIdSchema } from "../../src/lib/schemas/base";
import { idSchema } from "../../src/lib/validators";
import { rng } from "./_common";
import { DEMO } from "./_common";
import { DEMO2 } from "./_common-v2";
import { DEMO3, id3 } from "./_common-v3";
import { DEMO4, id4 } from "./_common-v4";
import { ENTIDADES_ORDEN_BORRADO, CORRIDA_V5, INTOCABLES } from "./_marcado";
import {
    DEMO5,
    PESOS_CATEGORIA_V5,
    RELATOS_V5,
    CIUDADES_DEMO4,
    PAISES_DEMO4,
    numeroSolicitudV5,
    numeroSeguimientoV5,
    fechaEnVentanaV5,
    fraccionAsignacionDe,
    nitColegioV5,
    emailAdminV5,
} from "./_common-v5";
import { CategoriaConducta } from "@prisma/client";
import { PREFIJO_SEMBRADO } from "./marcar-retroactivo";

const AQUI = __dirname;
const FUENTES_POBLADOR = ["poblar-demo-v5.ts", "_poblar-v5-casos.ts"] as const;

function leer(archivo: string): string {
    return fs.readFileSync(path.join(AQUI, archivo), "utf-8");
}

describe("SPEC-412 · el poblador NO fabrica llaves primarias", () => {
    it("no hay un solo `id:` asignado en los payloads de creación del poblador", () => {
        // El candado central. v1 hacía `id: id.colegio(c)`; v3 hacía
        // `id: id3.solicitud(a.id)` — y eso dejó 254 casos del comité sin abrir.
        // Si alguien vuelve a ASIGNAR un id acá, este test se pone rojo.
        //
        // Formas que NO son asignar una llave, y por eso se dejan pasar:
        //  · `id: true` / `id: false`     → un `select`
        //  · `id: string` / `id: number`  → una firma de tipo
        //  · `id: { in: [...] }`          → un filtro
        //  · `id: fila.id`                → propagar una llave que Prisma YA puso
        //  · cualquier `id:` en una línea que ya trae `where:` → un filtro
        const SEGURO = /^(true|false|string|number|\{)/;
        const PROPAGA = /^[A-Za-z_$][\w$]*\.(?:[\w$]+\.)*id\b[;}\s]*$/;
        const ofensores: string[] = [];
        for (const archivo of FUENTES_POBLADOR) {
            leer(archivo).split("\n").forEach((linea, i) => {
                const codigo = linea.replace(/\/\/.*$/, "");
                if (/^\s*\*/.test(codigo)) return; // línea de comentario de bloque
                const m = codigo.match(/(?:^|[{,\s])id:\s*([^,]+)/);
                if (!m) return;
                if (codigo.includes("where:")) return;
                if (SEGURO.test(m[1].trim()) || PROPAGA.test(m[1].trim())) return;
                ofensores.push(`${archivo}:${i + 1} → ${linea.trim()}`);
            });
        }
        expect(ofensores, `el poblador está fabricando llaves:\n${ofensores.join("\n")}`).toEqual([]);
    });

    it("el candado anterior SÍ detecta la forma vieja (v1/v3)", () => {
        // Contraprueba: sin esto, un regex mal escrito pasaría siempre en verde.
        const SEGURO = /^(true|false|string|number|\{)/;
        const PROPAGA = /^[A-Za-z_$][\w$]*\.(?:[\w$]+\.)*id\b[;}\s]*$/;
        const detecta = (linea: string): boolean => {
            const codigo = linea.replace(/\/\/.*$/, "");
            const m = codigo.match(/(?:^|[{,\s])id:\s*([^,]+)/);
            if (!m || codigo.includes("where:")) return false;
            const valor = m[1].trim();
            return !SEGURO.test(valor) && !PROPAGA.test(valor);
        };
        expect(detecta("                id: id.colegio(c),")).toBe(true);
        expect(detecta("            id: id3.solicitud(a.id),")).toBe(true);
        expect(detecta("        id: `demo5-r-${n}`,")).toBe(true);
        expect(detecta("            select: { id: true },")).toBe(false);
        expect(detecta("    ciudad: { id: string; paisId: string },")).toBe(false);
        expect(detecta("        await tx.curso.update({ where: { id: cursos[i].id }, data: {} });")).toBe(false);
        expect(detecta("            { id: c.id, paisId: c.paisId },")).toBe(false); // propaga, no fabrica
        expect(detecta("                id: rId,")).toBe(true); // la forma de v1: sí es fabricar
    });

    it("el poblador recupera las llaves con createManyAndReturn / create+select", () => {
        // La contracara del test anterior: si no fabrica ids, tiene que pedírselos
        // a Prisma para poder marcarlos.
        for (const archivo of FUENTES_POBLADOR) {
            const fuente = leer(archivo);
            expect(fuente).toContain("createManyAndReturn");
            expect(fuente).toContain("select: { id: true");
        }
    });

    it("todo lo que el poblador crea, lo marca", () => {
        // Cada `createManyAndReturn`/`create(` del poblador debe tener su `marcar(`.
        for (const archivo of FUENTES_POBLADOR) {
            const fuente = leer(archivo);
            const creaciones = (fuente.match(/createManyAndReturn\(|\.create\(\{/g) ?? []).length;
            const marcados = (fuente.match(/await marcar\(/g) ?? []).length;
            expect(marcados, `${archivo}: ${creaciones} creaciones vs ${marcados} marcados`).toBeGreaterThanOrEqual(1);
            expect(marcados, `${archivo}: hay creaciones sin marcar`).toBeGreaterThanOrEqual(creaciones - 1);
        }
    });
});

describe("SPEC-412 · el validador NO se ablanda (I-292)", () => {
    // El brief es explícito: "si el propio sistema rechaza un dato sembrado, la
    // siembra está mal, no el sistema". Estos tests fijan esa frontera.
    const IDS_VIEJOS = [
        "demo3-sol-demo-al-r-00127-E", // el de la incidencia, literal
        id3.solicitud("demo-al-r-00042-E"),
        id3.transicion("demo-r-00042", 1),
        id4.reporte(7),
        "demo-c-01",
        "demo-u-cvi-03",
    ];

    it("los ids que sembró v1-v4 son inválidos — A PROPÓSITO", () => {
        for (const viejo of IDS_VIEJOS) {
            expect(cuidIdSchema.safeParse(viejo).success, `cuidIdSchema debería rechazar "${viejo}"`).toBe(false);
            expect(idSchema.safeParse(viejo).success, `idSchema debería rechazar "${viejo}"`).toBe(false);
        }
    });

    it("un cuid() real de Prisma sí pasa los dos validadores", () => {
        // Forma canónica: 25 caracteres, empieza por 'c', sin guiones.
        const reales = ["cmticor7l000kglr93d1ypox6", "clh3k9xyz0000abcd1234efgh"];
        for (const real of reales) {
            expect(cuidIdSchema.safeParse(real).success, `cuidIdSchema debería aceptar "${real}"`).toBe(true);
            expect(idSchema.safeParse(real).success, `idSchema debería aceptar "${real}"`).toBe(true);
        }
    });

    it("el prefijo del marcado retroactivo no puede colisionar con un cuid()", () => {
        // Todo cuid empieza por 'c'; "demo" no. Por eso el inventario retroactivo
        // por prefijo no tiene falsos positivos.
        expect(PREFIJO_SEMBRADO).toBe("demo");
        expect(PREFIJO_SEMBRADO.startsWith("c")).toBe(false);
        for (const viejo of [DEMO.prefix, DEMO2.prefix, DEMO3.prefix, DEMO4.prefix]) {
            expect(viejo.startsWith(PREFIJO_SEMBRADO), `"${viejo}" debe caer bajo el inventario retroactivo`).toBe(true);
        }
    });
});

describe("SPEC-412 · el borrado alcanza todo lo que el poblador marca", () => {
    it("cada entidad marcada en el poblador está en el orden de borrado", () => {
        // Una entidad marcada y no listada quedaría sembrada para siempre.
        const marcadas = new Set<string>();
        for (const archivo of FUENTES_POBLADOR) {
            for (const m of leer(archivo).matchAll(/marcar\(\s*tx,\s*"([A-Za-z]+)"/g)) {
                marcadas.add(m[1]);
            }
        }
        expect(marcadas.size, "el test no encontró ninguna llamada a marcar()").toBeGreaterThan(10);
        const faltantes = [...marcadas].filter((e) => !ENTIDADES_ORDEN_BORRADO.includes(e));
        expect(faltantes, `entidades marcadas fuera del orden de borrado: ${faltantes.join(", ")}`).toEqual([]);
    });

    it("el orden de borrado pone las hojas antes que sus padres", () => {
        const pos = (e: string) => ENTIDADES_ORDEN_BORRADO.indexOf(e);
        const antes: [string, string][] = [
            ["SolicitudComite", "AlertaColegio"],
            ["AlertaColegio", "Reporte"],
            ["ClasificacionIA", "Reporte"],
            ["TransicionReporte", "Reporte"],
            ["IdentificadorContacto", "ContactoConfianza"],
            ["ContactoConfianza", "Usuario"],
            ["IdentificadorEstudiante", "Estudiante"],
            ["IdentificadorAcudiente", "AcudienteEstudiante"],
            ["AcudienteEstudiante", "Estudiante"],
            ["IdentificadorProfesor", "Profesor"],
            ["Estudiante", "Curso"],
            ["Curso", "Colegio"],
            ["Profesor", "Colegio"],
            ["Usuario", "Colegio"],
            ["Colegio", "Tenant"],
        ];
        for (const [hoja, padre] of antes) {
            expect(pos(hoja), `${hoja} debe borrarse antes que ${padre}`).toBeGreaterThanOrEqual(0);
            expect(pos(padre), `${padre} falta en el orden de borrado`).toBeGreaterThanOrEqual(0);
            expect(pos(hoja), `${hoja} debe ir antes que ${padre}`).toBeLessThan(pos(padre));
        }
    });

    it("el borrado se apoya solo en demo_marcado — no mira prefijos ni nombres", () => {
        const fuente = fs.readFileSync(path.join(AQUI, "_borrado-marcado.ts"), "utf-8");
        expect(fuente).toContain("idsMarcados");
        // Si alguien mete un filtro por prefijo o por nombre, vuelve la falla vieja.
        expect(fuente).not.toContain("startsWith");
        expect(fuente).not.toMatch(/nombre:\s*\{/);
    });

    it("los INTOCABLES están declarados y el borrado los conoce", () => {
        expect(INTOCABLES.colegios).toContain("cmticor7l000kglr93d1ypox6");
        expect(INTOCABLES.emailsUsuario).toContain("soporte@innovadataco.com");
        const fuente = fs.readFileSync(path.join(AQUI, "_borrado-marcado.ts"), "utf-8");
        expect(fuente).toContain("INTOCABLES");
    });
});

describe("SPEC-412 · las series del v5 no chocan con lo ya sembrado", () => {
    it("los NIT arrancan fuera del rango de v1 y de v2", () => {
        expect(DEMO5.nitInicio).toBeGreaterThan(DEMO.nitFin);
        expect(DEMO5.nitInicio).toBeGreaterThan(DEMO2.nitInicio + 100);
        const ultimo = Number(nitColegioV5(DEMO5.nColegios));
        expect(ultimo).toBeGreaterThan(DEMO.nitFin);
    });

    it("los documentos de alumno y profesor no pisan las series de v1", () => {
        // v1: alumnos `10NNKKKK`, profesores `20NNKKK` — ambos por debajo de 10.000.000.
        expect(DEMO5.documentoEstudianteBase).toBeGreaterThan(10_999_999);
        expect(DEMO5.documentoProfesorBase).toBeGreaterThan(DEMO5.documentoEstudianteBase);
    });

    it("la marca de correo es propia y visible para el ojo humano", () => {
        expect(DEMO5.emailMarca).not.toBe(DEMO.emailMarca);
        expect(DEMO5.emailMarca).not.toBe(DEMO2.emailMarca);
        expect(emailAdminV5(3)).toContain(DEMO5.emailMarca);
        // Pero el correo NO es el mecanismo: el borrado no lo lee (test de arriba).
    });

    it("la corrida del v5 tiene nombre propio", () => {
        expect(CORRIDA_V5).toBe("spec-412-v5");
    });
});

describe("SPEC-412 · los números generados tienen la forma del producto", () => {
    it("el número de solicitud copia la forma de escalar/route.ts (SOL- + 8 hex)", () => {
        const r = rng(412);
        for (let i = 0; i < 200; i++) {
            expect(numeroSolicitudV5(r)).toMatch(/^SOL-[0-9A-F]{8}$/);
        }
    });

    it("el número de seguimiento es único en una corrida larga", () => {
        const r = rng(7);
        const vistos = new Set<string>();
        for (let i = 0; i < 5000; i++) vistos.add(numeroSeguimientoV5(r));
        // 36^10 combinaciones: 5.000 sin repetir es lo esperado.
        expect(vistos.size).toBe(5000);
    });

    it("los números que emite el v5 son válidos y los de v3 no tenían la forma real", () => {
        const r = rng(1);
        expect(numeroSolicitudV5(r)).toMatch(/^SOL-[0-9A-F]{8}$/);
        expect(id3.numeroSolicitud(6)).not.toMatch(/^SOL-[0-9A-F]{8}$/);
    });
});

describe("SPEC-412 · fechas", () => {
    const AHORA = new Date("2026-09-03T15:00:00Z");

    it("nunca genera una fecha futura", () => {
        const r = rng(412);
        for (let i = 0; i < 2000; i++) {
            expect(fechaEnVentanaV5(r, AHORA).getTime()).toBeLessThanOrEqual(AHORA.getTime());
        }
    });

    it("reparte dentro de la ventana de 3 años que pidió BI", () => {
        const r = rng(99);
        const minimo = AHORA.getTime() - DEMO5.mesesAtras * 30 * 24 * 3600 * 1000;
        for (let i = 0; i < 2000; i++) {
            expect(fechaEnVentanaV5(r, AHORA).getTime()).toBeGreaterThanOrEqual(minimo);
        }
    });

    it("cubre toda la ventana mes a mes, no se apelmaza en uno solo", () => {
        const r = rng(412);
        const meses = new Set<string>();
        const anios = new Set<number>();
        for (let i = 0; i < 4200; i++) {
            const f = fechaEnVentanaV5(r, AHORA);
            meses.add(`${f.getUTCFullYear()}-${f.getUTCMonth()}`);
            anios.add(f.getUTCFullYear());
        }
        expect(meses.size).toBeGreaterThanOrEqual(DEMO5.mesesAtras);
        // Tres años completos: la comparación año contra año que pidió el CEO.
        expect(anios.size).toBeGreaterThanOrEqual(3);
    });

    it("hora en punto (G20: los minutos del hecho no se conocen)", () => {
        const r = rng(5);
        for (let i = 0; i < 500; i++) {
            const f = fechaEnVentanaV5(r, AHORA);
            expect(f.getUTCMinutes()).toBe(0);
            expect(f.getUTCSeconds()).toBe(0);
        }
    });
});

describe("SPEC-412 · lo que BI pidió y la siembra vieja hacía bien (CEO 03-09 16:0x)", () => {
    it("ventana de 3 años (veredicto CEO 03-09 16:2x), que contiene los 12 meses", () => {
        expect(DEMO5.mesesAtras).toBe(36);
    });

    it("volúmenes: ~50 colegios · ~300 profesores · ~2.000 alumnos · ~2.800 acudientes · 4.000+ reportes", () => {
        expect(DEMO5.nColegios).toBeGreaterThanOrEqual(50);
        expect(DEMO5.nColegios * DEMO5.profesoresPorColegio).toBeGreaterThanOrEqual(300);
        expect(DEMO5.nColegios * DEMO5.alumnosPorColegio).toBeGreaterThanOrEqual(2000);
        const acudientes = DEMO5.nColegios * DEMO5.alumnosPorColegio * (1 + DEMO5.fraccionDosAcudientes);
        expect(acudientes).toBeGreaterThanOrEqual(2800);
        expect(DEMO5.nReportes).toBeGreaterThanOrEqual(4000);
    });

    it("las 14 categorías de conducta están en la mezcla (a v2 le faltaba OTRO)", () => {
        const delEnum = Object.values(CategoriaConducta).filter((c) => c !== "SPAM");
        expect(delEnum).toHaveLength(14);
        const enLaMezcla = new Set(PESOS_CATEGORIA_V5.map((p) => p.categoria));
        const faltantes = delEnum.filter((c) => !enLaMezcla.has(c as never));
        expect(faltantes, `categorías sin peso: ${faltantes.join(", ")}`).toEqual([]);
        expect(enLaMezcla.has("SPAM")).toBe(true);
    });

    it("cada categoría de la mezcla tiene relatos propios (ninguna cae en texto vacío)", () => {
        for (const { categoria } of PESOS_CATEGORIA_V5) {
            expect(RELATOS_V5[categoria], `sin relatos: ${categoria}`).toBeDefined();
            expect(RELATOS_V5[categoria].length).toBeGreaterThan(0);
        }
    });

    it("geografía: 12+ países y 30+ ciudades", () => {
        expect(PAISES_DEMO4.length).toBeGreaterThanOrEqual(12);
        expect(CIUDADES_DEMO4.length).toBeGreaterThanOrEqual(30);
        const paisesEnCiudades = new Set(CIUDADES_DEMO4.map((c) => c.split(":")[0]));
        expect(paisesEnCiudades.size).toBeGreaterThanOrEqual(12);
    });

    it("reincidencia deliberada: hay fracción de repetición y de cadena", () => {
        expect(DEMO5.reincidenciaPct).toBeGreaterThan(0);
        expect(DEMO5.cadenaPct).toBeGreaterThan(0);
        // El poblador tiene que ESCRIBIR la cadena, no solo planearla.
        expect(leer("_poblar-v5-casos.ts")).toContain("reportePrincipalId");
    });

    it("asignación desigual: uno casi lleno, uno a medias, uno casi libre", () => {
        const f = DEMO5.fraccionesAsignacion;
        expect(f.length).toBeGreaterThanOrEqual(3);
        expect(Math.max(...f)).toBeGreaterThanOrEqual(0.9);
        expect(Math.min(...f)).toBeLessThanOrEqual(0.3);
        // Cíclica: el colegio 0 y el colegio f.length reciben la misma.
        expect(fraccionAsignacionDe(0)).toBe(fraccionAsignacionDe(f.length));
        expect(fraccionAsignacionDe(0)).not.toBe(fraccionAsignacionDe(f.length - 1));
    });

    it("transiciones escalonadas: el poblador reusa la cadena de v3", () => {
        const fuente = leer("_poblar-v5-casos.ts");
        expect(fuente).toContain("cadenaParaEstado");
        expect(fuente).toContain("fechasEscalonadas");
    });

    it("las solicitudes del comité quedan vinculadas a un comité válido", () => {
        const fuente = leer("_poblar-v5-casos.ts");
        expect(fuente).toContain("comitePorColegio.get(a.colegioId)");
        expect(fuente).toContain("alertaColegioId");
        expect(fuente).toContain("colegioId: a.colegioId");
    });

    it("los pagos se siembran, se marcan y se pueden borrar solos", () => {
        // Corrección del CEO 03-09 16:1x: SÍ se siembra `Pago` para que BI pueda
        // ejercitar su tablero comercial. Y por eso mismo tiene que ser borrable.
        const fuente = leer("_poblar-v5-pagos.ts");
        expect(fuente).toContain("tx.pago.createManyAndReturn");
        expect(fuente).toContain('marcar(tx, "Pago"');
        expect(ENTIDADES_ORDEN_BORRADO).toContain("Pago");
        expect(ENTIDADES_ORDEN_BORRADO).toContain("Plan");
    });

    it("el pago cae antes que su suscripción, y la suscripción antes que su plan", () => {
        const pos = (e: string) => ENTIDADES_ORDEN_BORRADO.indexOf(e);
        expect(pos("Pago")).toBeLessThan(pos("Suscripcion"));
        expect(pos("Suscripcion")).toBeLessThan(pos("Plan"));
        expect(pos("Suscripcion")).toBeLessThan(pos("Colegio"));
    });

    it("las dos fuentes cuentan la misma historia: montoRealPagado = suma de AUTORIZADO", () => {
        const fuente = leer("_poblar-v5-pagos.ts");
        expect(fuente).toContain("montoRealPagado");
        expect(fuente).toContain('p.estado !== "AUTORIZADO"');
        // Y hay un verificador que lo comprueba contra la base al terminar.
        expect(fuente).toContain("export async function verificarCuadre");
        expect(leer("poblar-demo-v5.ts")).toContain("verificarCuadre");
    });

    it("los planes que ya existen se REUSAN; solo se crea (y se marca) lo que falta", () => {
        const fuente = leer("_poblar-v5-pagos.ts");
        expect(fuente).toContain("prisma.plan.findUnique");
        expect(fuente).toContain('marcar(tx, "Plan"');
        // El plan preexistente se devuelve tal cual, sin marcarlo: no es sembrado.
        expect(fuente).toMatch(/if \(existente\) \{[\s\S]{0,200}?continue;/);
    });

    it("queda escrito que producción NO llena la tabla Pago", () => {
        // Nota del CEO que no se puede perder: si mañana alguien mira estos datos
        // y concluye que el recaudo real sale de `Pago`, se equivoca.
        const fuente = leer("_poblar-v5-pagos.ts");
        expect(fuente).toContain("Ningún camino de producción escribe `Pago`");
        expect(fuente).toContain("montoRealPagado");
    });
});

describe("SPEC-412 · no se siembran profesionales (orden de Jelkin 03-09)", () => {
    it("el poblador no toca la Red de Apoyo", () => {
        for (const archivo of FUENTES_POBLADOR) {
            const fuente = leer(archivo);
            expect(fuente).not.toMatch(/perfilProfesional|profesional\.create|CitaProfesional|FranjaDisponibilidad/);
        }
        expect(ENTIDADES_ORDEN_BORRADO).not.toContain("PerfilProfesional");
    });
});

/**
 * CANDADO · SPEC-395 — la visibilidad del contacto es UNA sola decisión, y se
 * verifica por CONDUCTA, no por «pasar por» la función.
 *
 * El defecto (hallazgo de Jelkin en prod): la regla estaba TRIPLICADA. El
 * calendario del profesional REPLICABA `estado === "confirmada"` en vez de llamar
 * a la fuente, así que exponía el correo del padre aunque el DTO se endureciera.
 *
 * Por qué este candado es de CONDUCTA (veredicto CEO):
 *   «pasar por `contactoVisiblePorSesion`» NO es obedecerla — un llamador puede
 *   invocarla y después hacer `|| esAdmin`, o ignorar el resultado. Entonces:
 *
 *   (1) Se FUERZA la fuente a `false` y se afirma que las TRES superficies
 *       devuelven el contacto AUSENTE, con el correo REAL plantado en el
 *       escenario (si la fixture no trae correo, «ausente» no probaría nada).
 *   (2) CONTROL POSITIVO: se fuerza a `true` y se afirma que el correo SÍ aparece
 *       en las tres. Sin este lado, un verde podría estar mirando una pantalla
 *       que nunca tuvo el dato.
 *   (3) COMPLEMENTO de fuente: nadie más decide el contacto por su cuenta — todo
 *       archivo que ASIGNA un campo de contacto debe pasar por la fuente única, y
 *       la lista de decisores tiene que coincidir con la que este candado ejerce
 *       (si aparece un cuarto, esta suite queda roja hasta cubrirlo por conducta).
 *
 * Las tres superficies:
 *   · `toCitaParaPadre`        → el padre ve el contacto del PROFESIONAL.
 *   · `toCitaParaProfesional`  → el profesional ve el correo del PADRE.
 *   · `calendarioDelProfesional` → el calendario del profesional (la fuga real).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Fuente única, controlable: la forzamos a voluntad para probar la CONDUCTA de
// las superficies ante cada resultado. dto.ts la importa por ruta relativa y
// calendario.service.ts por alias `@` — ambas resuelven al MISMO archivo, así que
// un solo mock cubre las tres superficies.
const { visibleMock } = vi.hoisted(() => ({ visibleMock: vi.fn() }));
vi.mock("@/lib/profesional/cita/contacto-visible", () => ({
    contactoVisiblePorSesion: (estado: unknown) => visibleMock(estado),
}));

// El calendario es un servicio que consulta repos; los reemplazamos por dobles
// para ejercer SOLO la decisión de contacto (sin base). El correo REAL del padre
// va plantado en la solicitud de la franja.
const CORREO_PADRE = "padre-real@correo.local";
const CORREO_PROFESIONAL = "profesional-real@correo.local";

vi.mock("@/lib/dal/repositories/perfil-profesional", () => ({
    PerfilProfesionalRepository: class {
        async findPorUsuarioId() {
            return { id: "pro-1", atiendeVirtual: true, atiendePresencial: false, duracionMinutos: 60 };
        }
        async venceEnVigente() {
            return null;
        }
    },
}));
vi.mock("@/lib/dal/repositories/franja-disponible", () => ({
    FranjaDisponibleRepository: class {
        async listarConSolicitud() {
            return [
                {
                    id: "fr-1",
                    inicio: new Date("2026-09-11T15:00:00Z"),
                    fin: new Date("2026-09-11T16:00:00Z"),
                    modalidad: "VIRTUAL",
                    tomada: true,
                    solicitud: {
                        id: "sol-1",
                        estado: "CONFIRMADA",
                        presentacion: "Hola, necesito una cita.",
                        padreUsuario: { nombre: "Familia Real", email: CORREO_PADRE },
                    },
                },
            ];
        }
    },
}));
vi.mock("@/lib/dal/repositories/dia-bloqueado", () => ({
    DiaBloqueadoRepository: class {
        async diasBloqueadosDe() {
            return [];
        }
    },
}));

import { toCitaParaPadre, toCitaParaProfesional } from "./dto";
import { calendarioDelProfesional } from "@/lib/profesional/calendario/calendario.service";

const AHORA = new Date("2026-09-11T12:00:00Z");

// Solicitud CONFIRMADA con perfil ACTIVO: aislamos la decisión de sesión de las
// OTRAS condiciones de `debeExponerContacto` (perfil vencido / reembolso 48h), que
// tienen su propio candado en dto.test.ts.
const solicitudParaPadre = {
    id: "sol-1",
    padreUsuarioId: "padre-1",
    profesionalId: "pro-1",
    franjaId: "fr-1",
    presentacion: "Necesito ayuda con mi hijo.",
    urgencia: "SIN_APURO",
    estado: "CONFIRMADA",
    pagoAprobadoEn: AHORA,
    expedienteCompartidoId: null,
    solicitudPreviaId: null,
    pagoHeredadoDeId: null,
    montoConsulta: 100000,
    montoServicio: 10000,
    montoTotal: 110000,
    porcentajeServicio: 10,
    venceEn: new Date("2026-09-13T12:00:00Z"),
    creadoEn: new Date("2026-09-10T12:00:00Z"),
    actualizadoEn: new Date("2026-09-10T12:00:00Z"),
    profesional: {
        id: "pro-1",
        nombreVisible: "Dra. Test",
        tituloProfesional: "Psicóloga",
        estado: "ACTIVO",
        ciudad: { id: "ciudad-1", nombre: "Bogotá" },
        usuario: { email: CORREO_PROFESIONAL, telefono: "+573000000000" },
    },
    franja: { inicio: new Date("2026-09-11T15:00:00Z"), fin: new Date("2026-09-11T16:00:00Z"), modalidad: "VIRTUAL" },
} as never;

const solicitudParaProfesional = {
    id: "sol-1",
    estado: "CONFIRMADA",
    urgencia: "SIN_APURO",
    creadoEn: new Date("2026-09-10T12:00:00Z"),
    pagoAprobadoEn: AHORA,
    presentacion: "Hola, necesito una cita.",
    expedienteCompartidoId: null,
    montoConsulta: 100000,
    padreUsuario: { id: "padre-1", nombre: "Familia Real", email: CORREO_PADRE },
    franja: { inicio: new Date("2026-09-11T15:00:00Z"), fin: new Date("2026-09-11T16:00:00Z"), modalidad: "VIRTUAL" },
} as never;

beforeEach(() => {
    visibleMock.mockReset();
});

describe("SPEC-395 · candado de CONDUCTA — el contacto sale/no sale según la fuente única", () => {
    describe("la fuente en FALSE cierra el contacto en las TRES superficies (correo real plantado)", () => {
        beforeEach(() => visibleMock.mockReturnValue(false));

        it("toCitaParaPadre no adjunta el contacto del profesional", () => {
            const dto = toCitaParaPadre(solicitudParaPadre, AHORA);
            expect(dto.contactoProfesional).toBeUndefined();
        });

        it("toCitaParaProfesional no adjunta el correo del padre", () => {
            const dto = toCitaParaProfesional(solicitudParaProfesional, AHORA);
            expect(dto.padre.email).toBeUndefined();
        });

        it("el calendario del profesional no expone el correo del padre (la fuga real)", async () => {
            const cal = await calendarioDelProfesional("u-1", AHORA);
            const bloque = cal.bloques.find((b) => b.solicitudId === "sol-1");
            expect(bloque, "el bloque de la cita debe existir en el escenario").toBeDefined();
            expect(bloque?.contactoEmail).toBeUndefined();
        });
    });

    describe("CONTROL POSITIVO · la fuente en TRUE sí expone el correo real en las tres", () => {
        beforeEach(() => visibleMock.mockReturnValue(true));

        it("toCitaParaPadre adjunta el correo real del profesional", () => {
            const dto = toCitaParaPadre(solicitudParaPadre, AHORA);
            expect(dto.contactoProfesional?.email).toBe(CORREO_PROFESIONAL);
        });

        it("toCitaParaProfesional adjunta el correo real del padre", () => {
            const dto = toCitaParaProfesional(solicitudParaProfesional, AHORA);
            expect(dto.padre.email).toBe(CORREO_PADRE);
        });

        it("el calendario del profesional expone el correo real del padre", async () => {
            const cal = await calendarioDelProfesional("u-1", AHORA);
            const bloque = cal.bloques.find((b) => b.solicitudId === "sol-1");
            expect(bloque?.contactoEmail).toBe(CORREO_PADRE);
        });
    });

    describe("GUARD SUBSUMIDO · perfil VENCIDO cierra el contacto aunque la fuente diga TRUE", () => {
        // SPEC-754 · la rama `estadoPerfil === "VENCIDO" | "SUSPENDIDO"` de `debeExponerContacto`
        // manda SOBRE la fuente (reserva legal H-2 · Ley 2375/2024). Con la fuente HOY en `false`
        // esa rama nunca sería el decisor real; sin este caso, en seis meses es código muerto que
        // alguien borra «porque no lo cubre nada». Acá se la EJERCITA de verdad: se FUERZA la fuente
        // a `true` y se pone el perfil VENCIDO ⇒ el contacto SIGUE ausente. El control positivo de
        // arriba (fuente `true` + perfil ACTIVO ⇒ correo PRESENTE) prueba que este `undefined` lo
        // decide el guard, no un escenario sin dato: mismo correo real plantado, único cambio el estado.
        beforeEach(() => visibleMock.mockReturnValue(true));

        it("toCitaParaPadre NO adjunta el contacto del profesional si su perfil está VENCIDO", () => {
            // `solicitudParaPadre` está tipada `as never` (fixture ancha); la reabrimos a un objeto
            // spreable solo para sobreescribir el estado del perfil sin duplicar la fixture entera.
            const base = solicitudParaPadre as unknown as { profesional: Record<string, unknown> };
            const vencido = {
                ...base,
                profesional: { ...base.profesional, estado: "VENCIDO" },
            } as never;
            const dto = toCitaParaPadre(vencido, AHORA);
            expect(dto.contactoProfesional).toBeUndefined();
        });
    });
});

// ── COMPLEMENTO de fuente ────────────────────────────────────────────────────
// El candado de conducta prueba las superficies CONOCIDAS. Este barrido cierra el
// resto: cualquier archivo que ASIGNE un campo de contacto es un «decisor», tiene
// que pasar por la fuente única, y la lista de decisores debe coincidir con la que
// la suite de conducta ejerce (COBERTURA). Un decisor nuevo → rojo hasta cubrirlo.
const RAIZ = path.resolve(__dirname, "../../../..");

// Asignación (no comparación): `x.contactoEmail = …`, `x.contactoProfesional = …`,
// `x.padre.email = …`. El `(?!=)` excluye `===`/`==` (lecturas/comparaciones) y las
// declaraciones de tipo (`campo?:`), que son consumidores, no decisores.
const ASIGNA_CONTACTO = /contactoEmail\s*=(?!=)|contactoProfesional\s*=(?!=)|\.padre\.email\s*=(?!=)/;

function archivosFuente(): string[] {
    const salida: string[] = [];
    const recorrer = (dir: string) => {
        for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
            const completo = path.join(dir, entrada.name);
            if (entrada.isDirectory()) {
                recorrer(completo);
                continue;
            }
            if (!/\.tsx?$/.test(entrada.name)) continue;
            if (/\.(test|spec)\.tsx?$/.test(entrada.name)) continue;
            salida.push(completo);
        }
    };
    recorrer(path.join(RAIZ, "src"));
    return salida;
}

function decisoresDeContacto(): string[] {
    return archivosFuente()
        .filter((abs) => ASIGNA_CONTACTO.test(fs.readFileSync(abs, "utf-8")))
        .map((abs) => path.relative(RAIZ, abs))
        .sort();
}

// Las superficies que la suite de conducta de arriba ejerce, por archivo.
const COBERTURA_CONDUCTA = [
    "src/lib/profesional/cita/dto.ts",
    "src/lib/profesional/calendario/calendario.service.ts",
].sort();

describe("SPEC-395 · complemento — nadie decide el contacto por su cuenta", () => {
    it("todo decisor de contacto pasa por la fuente única `contacto-visible`", () => {
        const sinFuente = decisoresDeContacto().filter(
            (rel) => !/contacto-visible/.test(fs.readFileSync(path.join(RAIZ, rel), "utf-8")),
        );
        expect(
            sinFuente,
            "estos archivos ASIGNAN un campo de contacto sin importar `contacto-visible`: " +
                "vuelven a decidir la regla por su cuenta (el patrón que causó la fuga). " +
                "Rutá la decisión por `contactoVisiblePorSesion`.",
        ).toEqual([]);
    });

    it("los decisores conocidos son EXACTAMENTE los que la suite de conducta cubre", () => {
        // Control positivo del barrido (que no matchee nada = falso verde) y guardia
        // de un cuarto decisor: si aparece uno nuevo, hay que agregarlo a la suite de
        // conducta (con sus lados false/true) y a COBERTURA_CONDUCTA — no basta con
        // que importe la fuente.
        expect(decisoresDeContacto()).toEqual(COBERTURA_CONDUCTA);
    });
});

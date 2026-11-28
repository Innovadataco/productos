/**
 * CANDADO · SPEC-983 · ningún método de AutenticacionService da de alta un usuario CON contraseña sin
 * verificar el correo, salvo `registrar` (alta por un admin, rol validado en la ruta).
 *
 * ALCANCE REAL: solo `AutenticacionService` / `autenticacion.ts`. NO garantiza que otros servicios, rutas
 * o repositorios no den de alta usuarios: cada uno necesita su propio candado.
 *
 * El defecto: `completarRegistro` creaba un padre con contraseña sin verificar el correo y no tenía llamador
 * (código muerto, pero un futuro cableado habría abierto el alta sin verificación).
 *
 * Dos partes:
 *  A · CONDUCTA: se barren por reflexión todos los métodos del PROTOTIPO; cada uno fuera de ALTAS_PERMITIDAS,
 *      llamado con firma posicional (email, clave, nombre) Y con firma de objeto ({ email, password, nombre }),
 *      NO debe llamar `usuario.create`, `createMany` ni `upsert`. No ve campos flecha (no están en el prototipo).
 *  B · ESTRUCTURAL: en la fuente enmascarada (sin comentarios ni literales) hay EXACTAMENTE UNA creación de
 *      usuario y está dentro del cuerpo de `registrar` (delimitado por balanceo de llaves, con modificadores en
 *      cualquier orden). Cubre métodos privados/estáticos, campos flecha y parámetros con paréntesis.
 * Ambas partes tienen controles por mutación (en memoria / en el prototipo, nunca se escribe en src/).
 * Solo datos inventados.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { unmockPrisma } from "@/lib/test-mocks/unmock-prisma";

const mocks = vi.hoisted(() => ({
    usuarioCreate: vi.fn(),
    // Operaciones de Prisma que dan de alta un usuario; el espía cuenta todas.
    escrituras: ["create", "createMany", "upsert"],
}));

vi.mock("@/lib/prisma", () => {
    const modelo = (nombre: string): Record<string, unknown> =>
        new Proxy(
            {},
            {
                get: (_t, op: string) =>
                    nombre === "usuario" && mocks.escrituras.includes(op) ? mocks.usuarioCreate : vi.fn(async () => null),
            },
        );
    const fake: Record<string, unknown> = new Proxy(
        {},
        {
            get: (_t, prop: string) => {
                if (prop === "$transaction") {
                    return (fn: unknown) => (typeof fn === "function" ? fn(fake) : Promise.resolve(null));
                }
                return modelo(prop);
            },
        },
    );
    return { prisma: fake };
});

import { AutenticacionService } from "./autenticacion";

afterAll(async () => {
    await unmockPrisma();
});

const ALTAS_PERMITIDAS = ["registrar"];
const EMAIL = "padre-sin-verificar@example.com";
const CLAVE = "ClaveInventada123";
const NOMBRE = "Nombre Inventado";

function metodosDelServicio(): string[] {
    return Object.getOwnPropertyNames(AutenticacionService.prototype).filter((n) => n !== "constructor");
}


type Metodo = (...a: unknown[]) => unknown;
type Forma = "posicional" | "objeto";

/** Las dos firmas con que se invoca cada método: un alta puede esperar strings o un objeto. */
const FORMAS: ReadonlyArray<{ forma: Forma; args: unknown[] }> = [
    { forma: "posicional", args: [EMAIL, CLAVE, NOMBRE] },
    { forma: "objeto", args: [{ email: EMAIL, password: CLAVE, nombre: NOMBRE }] },
];

interface ResultadoLlamada {
    forma: Forma;
    creo: boolean;
    lanzo: string | null;
}

/**
 * Llama el método con cada forma (una instancia nueva por llamada). Una excepción no se traga: queda
 * registrada en `lanzo`; igualmente se evalúa si ANTES de lanzar llegó a crear un usuario.
 */
async function llamarConAmbasFormas(nombre: string): Promise<ResultadoLlamada[]> {
    const resultados: ResultadoLlamada[] = [];
    for (const { forma, args } of FORMAS) {
        mocks.usuarioCreate.mockClear();
        const instancia = new AutenticacionService() as unknown as Record<string, Metodo | undefined>;
        let lanzo: string | null = null;
        try {
            await instancia[nombre]?.(...args);
        } catch (e) {
            lanzo = e instanceof Error ? e.message : String(e);
        }
        resultados.push({ forma, creo: mocks.usuarioCreate.mock.calls.length > 0, lanzo });
    }
    return resultados;
}

/** Barrido: métodos fuera de la lista permitida que llegan a una escritura de usuario, y qué formas lanzaron. */
async function barrido(): Promise<{ culpables: string[]; lanzaron: Record<string, Forma[]> }> {
    const culpables: string[] = [];
    const lanzaron: Record<string, Forma[]> = {};
    for (const nombre of metodosDelServicio().filter((n) => !ALTAS_PERMITIDAS.includes(n))) {
        const resultados = await llamarConAmbasFormas(nombre);
        if (resultados.some((r) => r.creo)) culpables.push(nombre);
        lanzaron[nombre] = resultados.filter((r) => r.lanzo !== null).map((r) => r.forma);
    }
    return { culpables, lanzaron };
}

beforeEach(() => {
    mocks.usuarioCreate.mockReset();
    mocks.usuarioCreate.mockImplementation(async () => ({
        id: "usr-1",
        email: EMAIL,
        nombre: NOMBRE,
        rol: "PARENT",
    }));
});

describe("SPEC-983 · A (conducta) · solo `registrar` da de alta usuarios", () => {
    it("controles positivos: el barrido ve login, registrar y validarCodigo", () => {
        const metodos = metodosDelServicio();
        expect(metodos).toEqual(expect.arrayContaining(["login", "registrar", "validarCodigo"]));
    });

    it("control positivo: `registrar` (con datos inventados) sí llama usuario.create una vez", async () => {
        const servicio = new AutenticacionService();
        await servicio.registrar({ email: "alta-admin@example.com", password: CLAVE, rol: "PARENT" });
        expect(mocks.usuarioCreate).toHaveBeenCalledTimes(1);
    });

    for (const nombre of metodosDelServicio().filter((n) => !ALTAS_PERMITIDAS.includes(n))) {
        it(`${nombre} NO crea usuarios (firma posicional ni de objeto)`, async () => {
            const resultados = await llamarConAmbasFormas(nombre);
            expect(resultados.filter((r) => r.creo)).toEqual([]);
        });
    }

    it("el espía cuenta create, createMany y upsert de usuario", async () => {
        const { prisma } = await import("@/lib/prisma");
        const usuario = (prisma as unknown as Record<string, Record<string, Metodo>>).usuario as Record<string, Metodo>;
        for (const op of ["create", "createMany", "upsert"]) {
            mocks.usuarioCreate.mockClear();
            await usuario[op]?.({});
            expect(mocks.usuarioCreate, op).toHaveBeenCalledTimes(1);
        }
        mocks.usuarioCreate.mockClear();
        await usuario.findMany?.({});
        expect(mocks.usuarioCreate).not.toHaveBeenCalled();
    });

    it("control por mutación: un método inyectado con firma posicional SÍ lo marca el barrido", async () => {
        const proto = AutenticacionService.prototype as unknown as Record<string, unknown>;
        expect(Object.getOwnPropertyNames(proto)).not.toContain("altaSinVerificar");
        Object.defineProperty(proto, "altaSinVerificar", {
            configurable: true,
            writable: true,
            enumerable: false,
            value: async function (this: { usuarios: { crear: (d: Record<string, unknown>) => Promise<unknown> } }) {
                return this.usuarios.crear({ email: EMAIL, passwordHash: "hash-inventado", rol: "PARENT" });
            },
        });
        try {
            expect((await barrido()).culpables).toEqual(["altaSinVerificar"]);
        } finally {
            delete proto.altaSinVerificar;
        }
        expect((await barrido()).culpables).toEqual([]);
    });

    it("control por mutación: `altaPadre({ email, password })` (solo crea con firma de objeto) SÍ se caza", async () => {
        const proto = AutenticacionService.prototype as unknown as Record<string, unknown>;
        expect(Object.getOwnPropertyNames(proto)).not.toContain("altaPadre");
        Object.defineProperty(proto, "altaPadre", {
            configurable: true,
            writable: true,
            enumerable: false,
            value: async function (
                this: { usuarios: { crear: (d: Record<string, unknown>) => Promise<unknown> } },
                input: { email?: string; password?: string },
            ) {
                // con strings, la desestructuración no da email: lanza antes de crear
                const { email, password } = input;
                if (typeof email !== "string" || typeof password !== "string") throw new Error("firma de objeto");
                return this.usuarios.crear({ email, passwordHash: "hash-inventado", rol: "PARENT" });
            },
        });
        try {
            const resultados = await llamarConAmbasFormas("altaPadre");
            // la forma posicional lanza SIN crear (un barrido solo posicional daría falso verde)…
            expect(resultados.find((r) => r.forma === "posicional")).toMatchObject({ creo: false });
            expect(resultados.find((r) => r.forma === "posicional")?.lanzo).not.toBeNull();
            // …y la de objeto crea
            expect(resultados.find((r) => r.forma === "objeto")).toMatchObject({ creo: true, lanzo: null });
            const { culpables, lanzaron } = await barrido();
            expect(culpables).toEqual(["altaPadre"]);
            expect(lanzaron.altaPadre).toEqual(["posicional"]);
        } finally {
            delete proto.altaPadre;
        }
        expect((await barrido()).culpables).toEqual([]);
    });
});

// ── B · estructural ─────────────────────────────────────────────────────────
const RUTA_SERVICIO = path.resolve(__dirname, "autenticacion.ts");
const FUENTE = fs.readFileSync(RUTA_SERVICIO, "utf-8");

/**
 * Enmascara con espacios (mismo largo, preserva offsets y saltos de línea): comentarios y CONTENIDO de
 * literales de texto y plantillas (las expresiones `${…}` sí se conservan como código). No trata regex literales.
 */
function enmascarar(src: string): string {
    const n = src.length;
    const quitar = (c: string): string => (c === "\n" ? "\n" : " ");
    const llavesEnPlantilla: number[] = [];
    let res = "";
    let i = 0;

    const leerPlantilla = (): void => {
        while (i < n) {
            const c = src[i] as string;
            if (c === "\\") {
                res += quitar(c) + (i + 1 < n ? quitar(src[i + 1] as string) : "");
                i += 2;
            } else if (c === "`") {
                res += c;
                i++;
                return;
            } else if (c === "$" && src[i + 1] === "{") {
                res += "${";
                i += 2;
                llavesEnPlantilla.push(0);
                return;
            } else {
                res += quitar(c);
                i++;
            }
        }
    };

    const leerLiteral = (comilla: string): void => {
        res += comilla;
        i++;
        while (i < n && src[i] !== comilla && src[i] !== "\n") {
            if (src[i] === "\\") {
                res += " ";
                i++;
            }
            if (i < n) {
                res += " ";
                i++;
            }
        }
        if (i < n && src[i] === comilla) {
            res += comilla;
            i++;
        }
    };

    while (i < n) {
        const c = src[i] as string;
        const d = src[i + 1];
        if (c === "/" && d === "/") {
            while (i < n && src[i] !== "\n") {
                res += " ";
                i++;
            }
        } else if (c === "/" && d === "*") {
            const fin = src.indexOf("*/", i + 2);
            const tope = fin < 0 ? n : fin + 2;
            for (; i < tope; i++) res += quitar(src[i] as string);
        } else if (c === '"' || c === "'") {
            leerLiteral(c);
        } else if (c === "`") {
            res += c;
            i++;
            leerPlantilla();
        } else if (c === "{" && llavesEnPlantilla.length > 0) {
            llavesEnPlantilla[llavesEnPlantilla.length - 1] = (llavesEnPlantilla[llavesEnPlantilla.length - 1] as number) + 1;
            res += c;
            i++;
        } else if (c === "}" && llavesEnPlantilla.length > 0) {
            const abiertas = llavesEnPlantilla[llavesEnPlantilla.length - 1] as number;
            res += c;
            i++;
            if (abiertas === 0) {
                llavesEnPlantilla.pop();
                leerPlantilla();
            } else {
                llavesEnPlantilla[llavesEnPlantilla.length - 1] = abiertas - 1;
            }
        } else {
            res += c;
            i++;
        }
    }
    return res;
}

/** Creaciones de usuario: repo (`crear*`), Prisma (`create`, `createMany`, `upsert`) y repo instanciado al vuelo. */
const PATRONES_CREACION = [
    /\b\w*[Uu]suarios?\w*\.(?:crear|create|upsert)\w*\(/g,
    /new UsuarioRepository\([^)]*\)\.(?:crear|create|upsert)\w*\(/g,
];

const MODIFICADORES = "(?:(?:public|private|protected|static|async|override|readonly)\\s+)*";

/** Posición del cierre que equilibra el de apertura en `pos` (`(` o `{`), o -1. */
function cerrarBalanceado(codigo: string, pos: number): number {
    const abre = codigo[pos] as string;
    const cierra = abre === "(" ? ")" : "}";
    let prof = 0;
    for (let i = pos; i < codigo.length; i++) {
        if (codigo[i] === abre) prof++;
        else if (codigo[i] === cierra && --prof === 0) return i;
    }
    return -1;
}

/**
 * Cuerpo de un método o campo flecha de la clase: de su `{` al `}` que lo equilibra (sobre código ya enmascarado).
 * Acepta modificadores en cualquier orden, genéricos, parámetros con paréntesis/llaves y tipos de retorno con llaves.
 */
function cuerpoDe(codigo: string, nombre: string): { inicio: number; fin: number } | null {
    const decl = new RegExp(`^[ \\t]*${MODIFICADORES}${nombre}\\s*(?:=\\s*(?:async\\s*)?)?[(<]`, "m").exec(codigo);
    if (!decl) return null;
    const abreParams = codigo.indexOf("(", decl.index + decl[0].length - 1);
    const cierraParams = abreParams < 0 ? -1 : cerrarBalanceado(codigo, abreParams);
    if (cierraParams < 0) return null;
    for (let i = cierraParams + 1; i < codigo.length; i++) {
        if (codigo[i] !== "{") continue;
        const previo = codigo.slice(cierraParams + 1, i).trimEnd().slice(-1) || ")";
        if (/[\w)>\]]/.test(previo)) {
            const fin = cerrarBalanceado(codigo, i);
            return fin < 0 ? null : { inicio: i, fin };
        }
        // `{` de un tipo de retorno (tras `:`, `<`, `|`, `&`, `,`): se sigue buscando el cuerpo
    }
    return null;
}

interface AnalisisCreaciones {
    total: number;
    enRegistrar: number;
    registrarEncontrado: boolean;
}

function analizarCreaciones(src: string): AnalisisCreaciones {
    const codigo = enmascarar(src);
    const cuerpo = cuerpoDe(codigo, "registrar");
    let total = 0;
    let enRegistrar = 0;
    for (const patron of PATRONES_CREACION) {
        for (const m of codigo.matchAll(patron)) {
            total++;
            const pos = m.index ?? 0;
            if (cuerpo && pos > cuerpo.inicio && pos < cuerpo.fin) enRegistrar++;
        }
    }
    return { total, enRegistrar, registrarEncontrado: cuerpo !== null };
}

/** Violaciones del invariante: vacío = cumple (EXACTAMENTE una creación y dentro de `registrar`). */
function violaciones(src: string): string[] {
    const a = analizarCreaciones(src);
    const v: string[] = [];
    if (!a.registrarEncontrado) v.push("no se encontró el cuerpo de registrar");
    if (a.total !== 1) v.push(`creaciones de usuario en la fuente: ${a.total} (debe ser exactamente 1)`);
    if (a.enRegistrar !== 1) v.push(`creaciones dentro de registrar: ${a.enRegistrar} (debe ser exactamente 1)`);
    return v;
}

/** Inserta `texto` justo después del cuerpo de `registrar` (dentro de la clase), en memoria. */
function insertarTrasRegistrar(src: string, texto: string): string {
    const cuerpo = cuerpoDe(enmascarar(src), "registrar");
    if (!cuerpo) throw new Error("registrar no encontrado: la mutación no puede aplicar");
    return `${src.slice(0, cuerpo.fin + 1)}\n${texto}\n${src.slice(cuerpo.fin + 1)}`;
}

describe("SPEC-983 · B (estructural) · la fuente tiene UNA creación de usuario, en `registrar`", () => {
    it("la fuente real cumple: exactamente 1 creación y dentro de registrar", () => {
        expect(analizarCreaciones(FUENTE)).toEqual({ total: 1, enRegistrar: 1, registrarEncontrado: true });
        expect(violaciones(FUENTE)).toEqual([]);
    });

    it("los comentarios y los literales de texto no cuentan (enmascarados)", () => {
        const ruido = `${FUENTE}\n// this.usuarios.crear({ x: 1 });\n/* this.usuarios.crear(1) */\nconst t = "this.usuarios.crear(";\nconst u = \`\${1} this.usuarios.crear(\`;\n`;
        expect(violaciones(ruido)).toEqual([]);
    });

    it("el balanceo de llaves ignora llaves dentro de literales y plantillas", () => {
        const fuente = "class X {\n    async registrar(a: string): Promise<{ ok: boolean }> {\n        const s = \"}}}\" + `${a}}`;\n        return this.usuarios.crear({ s });\n    }\n}";
        expect(analizarCreaciones(fuente)).toEqual({ total: 1, enRegistrar: 1, registrarEncontrado: true });
    });

    it("registrar con modificadores, genéricos, parámetros con paréntesis y tipo de retorno con llaves se delimita", () => {
        const variantes = [
            "public async registrar(a: (x: number) => void, b: { f(): void }): Promise<{ ok: boolean }> {",
            "async public registrar(a: string) {",
            "private static async registrar<T>(a: T): Promise<T> {",
            "registrar = async (a: string): Promise<void> => {",
        ];
        for (const cabecera of variantes) {
            const fuente = `class X {\n    ${cabecera}\n        return this.usuarios.crear({});\n    }\n}`;
            expect(analizarCreaciones(fuente), cabecera).toEqual({ total: 1, enRegistrar: 1, registrarEncontrado: true });
        }
    });

    it("sin registrar el detector falla (no hay falso verde por ausencia)", () => {
        const fuente = "class X {\n    async otro() {\n        return this.usuarios.crear({});\n    }\n}";
        expect(violaciones(fuente)).toEqual(
            expect.arrayContaining(["no se encontró el cuerpo de registrar"]),
        );
    });

    it("cada forma de creación de usuario se cuenta", () => {
        const formas = [
            "this.usuarios.crear({})",
            "this.usuarios.crearMuchos([])",
            "prisma.usuario.create({})",
            "tx.usuario.createMany({})",
            "this.prisma.usuario.upsert({})",
            "new UsuarioRepository(db).crear({})",
        ];
        for (const forma of formas) {
            const fuente = `class X {\n    async registrar() {\n        return ${forma};\n    }\n}`;
            expect(analizarCreaciones(fuente).total, forma).toBe(1);
        }
    });

    it("tokens y códigos (no son usuarios) no cuentan", () => {
        const fuente = "class X {\n    async registrar() {\n        await this.tokens.crear({});\n        await this.codigos.crear({});\n        return this.usuarios.crear({});\n    }\n}";
        expect(analizarCreaciones(fuente).total).toBe(1);
    });

    const MUTACIONES: Array<{ nombre: string; texto: string }> = [
        {
            nombre: "(a) `private async altaX` con this.usuarios.crear justo después de registrar",
            texto: `    private async altaX(email: string, password: string): Promise<unknown> {
        return this.usuarios.crear({ email, passwordHash: password, rol: "PARENT" });
    }`,
        },
        {
            nombre: "(b) método con argumento de objeto `altaPadre({ email, password })`",
            texto: `    async altaPadre({ email, password }: { email: string; password: string }): Promise<unknown> {
        return this.usuarios.crear({ email, passwordHash: password, rol: "PARENT" });
    }`,
        },
        {
            nombre: "(c) campo flecha `altaY = async (...) => {...}`",
            texto: `    altaY = async (email: string, password: string): Promise<unknown> => {
        return this.usuarios.crear({ email, passwordHash: password, rol: "PARENT" });
    };`,
        },
        {
            nombre: "(d) `protected static async` con parámetro con paréntesis y upsert de Prisma",
            texto: `    protected static async altaZ(f: (x: number) => void, e: string): Promise<unknown> {
        return prisma.usuario.upsert({ where: { email: e }, create: {}, update: {} });
    }`,
        },
        {
            nombre: "(e) segunda creación DENTRO de registrar (total 2)",
            texto: "",
        },
    ];

    for (const { nombre, texto } of MUTACIONES) {
        it(`control por mutación ${nombre}: el detector FALLA`, () => {
            let mutada: string;
            if (texto === "") {
                const cuerpo = cuerpoDe(enmascarar(FUENTE), "registrar");
                expect(cuerpo).not.toBeNull();
                const fin = (cuerpo as { fin: number }).fin;
                mutada = `${FUENTE.slice(0, fin)}\n        await this.usuarios.crear({});\n    ${FUENTE.slice(fin)}`;
            } else {
                mutada = insertarTrasRegistrar(FUENTE, texto);
            }
            expect(mutada, "la mutación debía aplicar").not.toBe(FUENTE);
            const v = violaciones(mutada);
            expect(v.length, v.join(" | ")).toBeGreaterThan(0);
            expect(analizarCreaciones(mutada).total).toBe(2);
        });
    }

    it("control por mutación: reponer el método viejo `completarRegistro` al final de la clase se CAZA", () => {
        const viejo = `
    /** alta del padre verificado (mutación de prueba) */
    async completarRegistro(email: string, password: string, nombre?: string): Promise<ResultadoRegistro> {
        const user = await this.usuarios.crear({
            email,
            nombre: nombre || null,
            passwordHash: await hashPassword(password),
            rol: "PARENT",
        });
        return { ok: true, user: { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol } };
    }
}`;
        const cierre = FUENTE.lastIndexOf("}");
        const mutada = FUENTE.slice(0, cierre).trimEnd() + "\n" + viejo + FUENTE.slice(cierre + 1);
        expect(mutada, "la mutación debía aplicar").not.toBe(FUENTE);
        expect(analizarCreaciones(mutada)).toEqual({ total: 2, enRegistrar: 1, registrarEncontrado: true });
        expect(violaciones(mutada)).not.toEqual([]);
    });
});

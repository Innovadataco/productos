import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CategoriaParametro, TipoParametro } from "@prisma/client";
import { prisma } from "./prisma";
import { getParametroSistema, getParametroSistemaValor } from "./parametros";
import { encryptParameter } from "./param-encryption";

const KEY = Buffer.from("a".repeat(32), "utf8");

describe("parametros", () => {
    beforeEach(async () => {
        await prisma.parametroSistema.deleteMany({ where: { clave: { startsWith: "test." } } });
        process.env.PARAM_ENCRYPTION_KEY = KEY.toString("utf8");
    });

    afterEach(async () => {
        await prisma.parametroSistema.deleteMany({ where: { clave: { startsWith: "test." } } });
    });

    it("descifra automáticamente un parámetro secreto", async () => {
        const original = "valor-ultra-secreto";
        const cifrado = encryptParameter(original, KEY);
        await prisma.parametroSistema.create({
            data: {
                clave: "test.secret",
                valor: cifrado,
                tipo: TipoParametro.STRING,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                esSecreto: true,
            },
        });

        const param = await getParametroSistema("test.secret");
        expect(param).not.toBeNull();
        expect(param!.valor).toBe(original);
    });

    it("devuelve el valor plano si no es secreto", async () => {
        await prisma.parametroSistema.create({
            data: {
                clave: "test.plain",
                valor: "visible",
                tipo: TipoParametro.STRING,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: true,
                esSecreto: false,
            },
        });

        const valor = await getParametroSistemaValor("test.plain");
        expect(valor).toBe("visible");
    });

    it("devuelve null si el parámetro no existe", async () => {
        const param = await getParametroSistema("test.inexistente");
        expect(param).toBeNull();
    });

    it("mantiene valor plano para secreto si aún no fue migrado", async () => {
        await prisma.parametroSistema.create({
            data: {
                clave: "test.legacy-secret",
                valor: "plano",
                tipo: TipoParametro.STRING,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                esSecreto: true,
            },
        });

        const param = await getParametroSistema("test.legacy-secret");
        expect(param!.valor).toBe("plano");
    });
});

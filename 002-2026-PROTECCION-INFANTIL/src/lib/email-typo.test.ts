import { describe, it, expect } from "vitest";
import { sugerirDominioCorreo, aplicarSugerenciaDominio, completarDominio, distanciaDamerau } from "./email-typo";

describe("sugerirDominioCorreo (3003)", () => {
    it("detecta inserción: gmaail.com → gmail.com", () => {
        expect(sugerirDominioCorreo("jelkin.carrillo+padre01@gmaail.com")).toBe("gmail.com");
    });

    it("detecta transposición: gmial.com → gmail.com", () => {
        expect(sugerirDominioCorreo("ana@gmial.com")).toBe("gmail.com");
    });

    it("detecta borrado: hotmal.com → hotmail.com", () => {
        expect(sugerirDominioCorreo("r@hotmal.com")).toBe("hotmail.com");
    });

    it("detecta sustitución en TLD: gmail.con → gmail.com", () => {
        expect(sugerirDominioCorreo("x@gmail.con")).toBe("gmail.com");
    });

    it("detecta TLD corto: gmail.co → gmail.com", () => {
        expect(sugerirDominioCorreo("x@gmail.co")).toBe("gmail.com");
    });

    it("detecta yahooo.com → yahoo.com", () => {
        expect(sugerirDominioCorreo("x@yahooo.com")).toBe("yahoo.com");
    });

    it("NO sugiere cuando el dominio es exacto y conocido", () => {
        expect(sugerirDominioCorreo("x@gmail.com")).toBeNull();
        expect(sugerirDominioCorreo("x@hotmail.com")).toBeNull();
        expect(sugerirDominioCorreo("x@proton.me")).toBeNull();
    });

    it("NO toca dominios institucionales/lejanos (colegio)", () => {
        expect(sugerirDominioCorreo("rector@colegiosanpedro.edu.co")).toBeNull();
        expect(sugerirDominioCorreo("a@servidorcorporativo.com.co")).toBeNull();
        expect(sugerirDominioCorreo("a@midominio-raro.org")).toBeNull();
    });

    it("SÍ sugiere con borrado de letra interna: gmal.com → gmail.com", () => {
        expect(sugerirDominioCorreo("x@gmal.com")).toBe("gmail.com");
    });

    it("NO sugiere con dominio lejano (distancia ≥ 2)", () => {
        expect(sugerirDominioCorreo("x@servidorlejano.com")).toBeNull();
        expect(sugerirDominioCorreo("x@zz.co")).toBeNull();
    });

    it("correo sin @ o mal formado → null (no sugiere)", () => {
        expect(sugerirDominioCorreo("sinarroba")).toBeNull();
        expect(sugerirDominioCorreo("")).toBeNull();
    });

    it("normaliza a minúsculas antes de comparar", () => {
        expect(sugerirDominioCorreo("x@GMAAIL.COM")).toBe("gmail.com");
    });
});

describe("aplicarSugerenciaDominio", () => {
    it("reemplaza solo el dominio; la parte local queda intacta (alias + mayúsculas)", () => {
        expect(aplicarSugerenciaDominio("Jelkin.Carrillo+padre01@gmaail.com", "gmail.com"))
            .toBe("Jelkin.Carrillo+padre01@gmail.com");
    });

    it("sin @ devuelve el valor tal cual", () => {
        expect(aplicarSugerenciaDominio("sindominio", "gmail.com")).toBe("sindominio");
    });
});

describe("completarDominio (atajos 3003)", () => {
    it("sin @ agrega el dominio", () => {
        expect(completarDominio("Jelkin.Carrillo+padre01", "gmail.com")).toBe("Jelkin.Carrillo+padre01@gmail.com");
    });
    it("con dominio a medias lo reemplaza", () => {
        expect(completarDominio("ana@hot", "hotmail.com")).toBe("ana@hotmail.com");
    });
    it("con dominio completo lo cambia solo a él (la parte local no se toca)", () => {
        expect(completarDominio("x@gmaail.com", "gmail.com")).toBe("x@gmail.com");
    });
    it("vacío agrega solo el dominio", () => {
        expect(completarDominio("", "yahoo.com")).toBe("@yahoo.com");
    });
});

describe("distanciaDamerau", () => {
    it("transposición adyacente cuesta 1", () => {
        expect(distanciaDamerau("gmial", "gmail")).toBe(1);
    });
    it("igualdad cuesta 0", () => {
        expect(distanciaDamerau("gmail", "gmail")).toBe(0);
    });
});

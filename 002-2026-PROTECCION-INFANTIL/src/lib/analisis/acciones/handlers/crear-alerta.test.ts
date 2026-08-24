/**
 * SPEC-226 (002-PI-mega-cola, FR-005/FR-016): tests unitarios de la resolución
 * pura de destinatarios del handler `crear_alerta` (sin BD): lista explícita
 * del parámetro manda; vacía, inválida o ausente → todos los ADMIN activos.
 */
import { describe, it, expect } from "vitest";
import { resolverDestinatariosAlerta } from "./crear-alerta";

const ADMINS = ["admin-1", "admin-2"];

describe("resolverDestinatariosAlerta", () => {
    it("lista JSON válida no vacía manda sobre los ADMIN activos", () => {
        expect(resolverDestinatariosAlerta('["admin-9"]', ADMINS)).toEqual(["admin-9"]);
    });

    it("lista vacía → todos los ADMIN activos", () => {
        expect(resolverDestinatariosAlerta("[]", ADMINS)).toEqual(ADMINS);
    });

    it("parámetro ausente (null) → todos los ADMIN activos", () => {
        expect(resolverDestinatariosAlerta(null, ADMINS)).toEqual(ADMINS);
    });

    it("JSON inválido → todos los ADMIN activos", () => {
        expect(resolverDestinatariosAlerta("{no-json", ADMINS)).toEqual(ADMINS);
    });

    it("JSON válido pero no lista de strings → todos los ADMIN activos", () => {
        expect(resolverDestinatariosAlerta('{"a":1}', ADMINS)).toEqual(ADMINS);
        expect(resolverDestinatariosAlerta("[1,2]", ADMINS)).toEqual(ADMINS);
        expect(resolverDestinatariosAlerta('[""]', ADMINS)).toEqual(ADMINS);
    });
});

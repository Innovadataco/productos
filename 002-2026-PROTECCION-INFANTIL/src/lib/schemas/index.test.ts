import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
    cuidIdSchema,
    emailSchema,
    parametroClaveSchema,
    emptyBodySchema,
    ollamaProbarBodySchema,
    sandboxBodySchema,
    operadorIdParamsSchema,
    parametroClaveParamsSchema,
    parametroPatchBodySchema,
    profesorBodySchema,
    profesorPatchSchema,
    profesoresQuerySchema,
    cursoBodySchema,
    cursoUpdateBodySchema,
    bloquearIpBodySchema,
    desbloquearIpBodySchema,
    monitoreoLogsPurgeSchema,
    ipv4Schema,
    informeMensualQuerySchema,
} from "./index";

describe("schemas/index", () => {
    it("cuidIdSchema accepts a valid cuid", () => {
        const validCuid = "cm0k5example12345678901234567890";
        expect(() => cuidIdSchema.parse(validCuid)).not.toThrow();
    });

    it("cuidIdSchema rejects an invalid cuid", () => {
        expect(() => cuidIdSchema.parse("not-a-cuid")).toThrow();
    });

    it("emailSchema accepts a valid email", () => {
        expect(() => emailSchema.parse("test@example.com")).not.toThrow();
    });

    it("emailSchema rejects an invalid email", () => {
        expect(() => emailSchema.parse("not-an-email")).toThrow();
    });

    it("parametroClaveSchema accepts a non-empty key up to 100 chars", () => {
        expect(() => parametroClaveSchema.parse("security.max_login_attempts")).not.toThrow();
    });

    it("parametroClaveSchema rejects an empty key", () => {
        expect(() => parametroClaveSchema.parse("")).toThrow();
    });

    it("emptyBodySchema accepts an empty object", () => {
        expect(() => emptyBodySchema.parse({})).not.toThrow();
    });

    it("emptyBodySchema rejects extra fields", () => {
        expect(() => emptyBodySchema.parse({ extra: true })).toThrow();
    });

    it("ollamaProbarBodySchema requires a non-empty url string", () => {
        expect(() => ollamaProbarBodySchema.parse({ url: "http://localhost:11434" })).not.toThrow();
    });

    it("ollamaProbarBodySchema rejects a missing url", () => {
        expect(() => ollamaProbarBodySchema.parse({})).toThrow();
    });

    it("ollamaProbarBodySchema rejects a non-string url", () => {
        expect(() => ollamaProbarBodySchema.parse({ url: 123 })).toThrow();
    });

    it("sandboxBodySchema accepts a valid payload", () => {
        expect(() =>
            sandboxBodySchema.parse({ texto: "texto de prueba", comparar: true })
        ).not.toThrow();
    });

    it("sandboxBodySchema rejects an empty texto", () => {
        expect(() => sandboxBodySchema.parse({ texto: "" })).toThrow();
    });

    it("sandboxBodySchema rejects a texto longer than 4000 characters", () => {
        const longText = "a".repeat(4001);
        expect(() => sandboxBodySchema.parse({ texto: longText })).toThrow();
    });

    it("sandboxBodySchema rejects non-object parametrosOverride", () => {
        expect(() => sandboxBodySchema.parse({ texto: "ok", parametrosOverride: "bad" })).toThrow();
    });

    it("operadorIdParamsSchema accepts a valid cuid id", () => {
        expect(() => operadorIdParamsSchema.parse({ id: "cm0k5example12345678901234567890" })).not.toThrow();
    });

    it("operadorIdParamsSchema rejects an invalid id", () => {
        expect(() => operadorIdParamsSchema.parse({ id: "not-a-cuid" })).toThrow();
    });

    it("parametroClaveParamsSchema accepts a valid clave", () => {
        expect(() => parametroClaveParamsSchema.parse({ clave: "visibility.report_threshold" })).not.toThrow();
    });

    it("parametroClaveParamsSchema rejects an empty clave", () => {
        expect(() => parametroClaveParamsSchema.parse({ clave: "" })).toThrow();
    });

    it("parametroPatchBodySchema accepts a valid patch payload", () => {
        expect(() =>
            parametroPatchBodySchema.parse({
                valor: "5",
                motivo: "Ajuste de umbral",
                tipo: "INTEGER",
                categoria: "VISIBILITY",
            })
        ).not.toThrow();
    });

    it("parametroPatchBodySchema rejects an empty valor", () => {
        expect(() => parametroPatchBodySchema.parse({ valor: "" })).toThrow();
    });

    it("parametroPatchBodySchema rejects an invalid tipo", () => {
        expect(() => parametroPatchBodySchema.parse({ valor: "x", tipo: "INVALID" })).toThrow();
    });

    it("parametroPatchBodySchema rejects an invalid categoria", () => {
        expect(() => parametroPatchBodySchema.parse({ valor: "x", categoria: "INVALID" })).toThrow();
    });

    it("parametroPatchBodySchema rejects a motivo longer than 500 chars", () => {
        expect(() =>
            parametroPatchBodySchema.parse({ valor: "x", motivo: "a".repeat(501) })
        ).toThrow();
    });
});

// SPEC-145 (FR-005): schemas del CRUD de profesores y titular de curso (D1=A).
describe("schemas profesor (SPEC-145)", () => {
    it("profesorBodySchema exige identidad completa; el viejo mínimo se rechaza (SPEC-320 §2.2)", () => {
        const completo = profesorBodySchema.parse({
            nombre: "María", apellidos: "López",
            tipoDocumento: "CC", numeroDocumento: "12345678",
            anioNacimiento: 1990, sexo: "F",
            email: "maria@colegio.edu.co", telefono: "+573001112233",
        });
        expect(completo.numeroDocumento).toBe("12345678");
        expect(completo.anioNacimiento).toBe(1990);
        // El mínimo de SPEC-145 (solo nombre + apellidos) ahora es inválido.
        expect(profesorBodySchema.safeParse({ nombre: "María", apellidos: "López" }).success).toBe(false);
    });

    it("profesorBodySchema exige email y teléfono (ya no opcionales, SPEC-320 §2.2)", () => {
        const base = { nombre: "María", apellidos: "López", tipoDocumento: "CC", numeroDocumento: "12345678", anioNacimiento: 1990, sexo: "F" };
        expect(profesorBodySchema.safeParse({ ...base, email: "maria@colegio.edu.co", telefono: "+573001112233" }).success).toBe(true);
        expect(profesorBodySchema.safeParse({ ...base, telefono: "+573001112233" }).success).toBe(false); // falta email
        expect(profesorBodySchema.safeParse({ ...base, email: "maria@colegio.edu.co" }).success).toBe(false); // falta teléfono
    });

    it("profesorBodySchema rechaza sin apellidos con mensaje humano", () => {
        const result = profesorBodySchema.safeParse({ nombre: "María" });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]?.message).toBe("Falta el apellido del profesor");
    });

    it("profesorBodySchema rechaza email mal formado", () => {
        expect(() => profesorBodySchema.parse({ nombre: "María", apellidos: "López", email: "no-es-email" })).toThrow();
    });

    it("profesorPatchSchema acepta subconjuntos válidos; ya no admite email null (SPEC-320 §2.2)", () => {
        expect(() => profesorPatchSchema.parse({ estado: "inactivo" })).not.toThrow();
        expect(() => profesorPatchSchema.parse({ telefono: "+573009998877" })).not.toThrow();
        expect(() => profesorPatchSchema.parse({ email: "nueva@colegio.edu.co" })).not.toThrow();
        // Identidad obligatoria: limpiar el email con null se rechaza.
        expect(profesorPatchSchema.safeParse({ email: null }).success).toBe(false);
    });

    it("profesorPatchSchema rechaza estado fuera de activo|inactivo", () => {
        expect(() => profesorPatchSchema.parse({ estado: "suspendido" })).toThrow();
    });

    it("profesorPatchSchema rechaza el body vacío", () => {
        expect(() => profesorPatchSchema.parse({})).toThrow();
    });

    it("profesoresQuerySchema aplica defaults y cota pageSize", () => {
        const parsed = profesoresQuerySchema.parse({});
        expect(parsed).toEqual({ page: 1, pageSize: 25, estado: "activo" });
        expect(profesoresQuerySchema.parse({ page: "2", pageSize: "50", estado: "todos" })).toEqual({ page: 2, pageSize: 50, estado: "todos" });
        expect(() => profesoresQuerySchema.parse({ pageSize: "101" })).toThrow();
        expect(() => profesoresQuerySchema.parse({ estado: "suspendido" })).toThrow();
    });

    it("cursoBodySchema y cursoUpdateBodySchema aceptan profesorTitularId (D1=A), null y ausente", () => {
        const cuid = "cm0k5example12345678901234567890";
        expect(() => cursoBodySchema.parse({ nombre: "6A", profesorTitularId: cuid })).not.toThrow();
        expect(() => cursoBodySchema.parse({ nombre: "6A", profesorTitularId: null })).not.toThrow();
        expect(() => cursoBodySchema.parse({ nombre: "6A" })).not.toThrow();
        expect(() => cursoBodySchema.parse({ nombre: "6A", profesorTitularId: "no-es-cuid" })).toThrow();
        expect(() => cursoUpdateBodySchema.parse({ profesorTitularId: cuid })).not.toThrow();
        expect(() => cursoUpdateBodySchema.parse({ profesorTitularId: null })).not.toThrow();
    });

    it("bloquearIpBodySchema acepta IPv4 e IPv6 válidas", () => {
        expect(() =>
            bloquearIpBodySchema.parse({ ip: "192.0.2.10", motivo: "Robot inundando", duracion: "24h" })
        ).not.toThrow();
        expect(() =>
            bloquearIpBodySchema.parse({ ip: "2001:db8::1", motivo: "Robot inundando", duracion: "7d" })
        ).not.toThrow();
    });

    it("bloquearIpBodySchema rechaza IPs inválidas", () => {
        expect(() =>
            bloquearIpBodySchema.parse({ ip: "999.999.999.999", motivo: "X", duracion: "24h" })
        ).toThrow();
        expect(() =>
            bloquearIpBodySchema.parse({ ip: "no-es-ip", motivo: "X", duracion: "24h" })
        ).toThrow();
    });

    it("bloquearIpBodySchema rechaza motivo vacío o duración inválida", () => {
        expect(() =>
            bloquearIpBodySchema.parse({ ip: "192.0.2.10", motivo: "", duracion: "24h" })
        ).toThrow();
        expect(() =>
            bloquearIpBodySchema.parse({ ip: "192.0.2.10", motivo: "X", duracion: "1h" as "24h" })
        ).toThrow();
    });

    it("desbloquearIpBodySchema requiere motivo de al menos 20 caracteres", () => {
        const id = "cm0k5example12345678901234567890";
        expect(() => desbloquearIpBodySchema.parse({ id, motivo: "Motivo suficientemente largo" })).not.toThrow();
        expect(() => desbloquearIpBodySchema.parse({ id, motivo: "corto" })).toThrow();
        expect(() => desbloquearIpBodySchema.parse({ id })).toThrow();
    });

    it("monitoreoLogsPurgeSchema rechaza fecha límite igual o posterior a hoy", () => {
        const ayer = new Date();
        ayer.setUTCDate(ayer.getUTCDate() - 1);
        ayer.setUTCHours(23, 59, 0, 0);
        expect(() =>
            monitoreoLogsPurgeSchema.parse({
                hasta: ayer.toISOString(),
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        ).not.toThrow();

        const hoy = new Date();
        hoy.setUTCHours(12, 0, 0, 0);
        expect(() =>
            monitoreoLogsPurgeSchema.parse({
                hasta: hoy.toISOString(),
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        ).toThrow();
    });

    it("monitoreoLogsPurgeSchema requiere servicio cuando se indica nivel", () => {
        expect(() =>
            monitoreoLogsPurgeSchema.parse({
                hasta: "2026-01-01T00:00:00Z",
                nivel: "ERROR",
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        ).toThrow();

        expect(() =>
            monitoreoLogsPurgeSchema.parse({
                hasta: "2026-01-01T00:00:00Z",
                servicio: "pi-app",
                nivel: "ERROR",
                motivo: "Limpieza de logs antiguos por política de retención",
            })
        ).not.toThrow();
    });

    it("monitoreoLogsPurgeSchema rechaza motivo fuera de rango", () => {
        expect(() =>
            monitoreoLogsPurgeSchema.parse({
                hasta: "2026-01-01T00:00:00Z",
                motivo: "Corto",
            })
        ).toThrow();
    });

    it("ipv4Schema rechaza octetos fuera de rango", () => {
        expect(() => ipv4Schema.parse("256.0.0.1")).toThrow();
        expect(() => ipv4Schema.parse("192.168.1.256")).toThrow();
        expect(() => ipv4Schema.parse("-1.0.0.1")).toThrow();
    });

    it("ipv4Schema rechaza formato inválido", () => {
        expect(() => ipv4Schema.parse("192.168.1")).toThrow();
        expect(() => ipv4Schema.parse("abc")).toThrow();
    });

    it("ipv4Schema acepta una IPv4 válida", () => {
        expect(() => ipv4Schema.parse("192.0.2.10")).not.toThrow();
    });

    it("informeMensualQuerySchema acepta el mes actual", () => {
        const ahora = new Date();
        const mes = `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, "0")}`;
        expect(() => informeMensualQuerySchema.parse({ mes })).not.toThrow();
    });

    it("informeMensualQuerySchema rechaza mes futuro y mayor a 12 meses atrás", () => {
        const ahora = new Date();
        const futuro = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
        const mesFuturo = `${futuro.getUTCFullYear()}-${String(futuro.getUTCMonth() + 1).padStart(2, "0")}`;
        expect(() => informeMensualQuerySchema.parse({ mes: mesFuturo })).toThrow();

        const viejo = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 13, 1));
        const mesViejo = `${viejo.getUTCFullYear()}-${String(viejo.getUTCMonth() + 1).padStart(2, "0")}`;
        expect(() => informeMensualQuerySchema.parse({ mes: mesViejo })).toThrow();
    });

    it("informeMensualQuerySchema acepta el límite de 12 meses atrás", () => {
        const ahora = new Date();
        const limite = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() - 11, 1));
        const mesLimite = `${limite.getUTCFullYear()}-${String(limite.getUTCMonth() + 1).padStart(2, "0")}`;
        expect(() => informeMensualQuerySchema.parse({ mes: mesLimite })).not.toThrow();
    });

    it("informeMensualQuerySchema rechaza formato de mes inválido", () => {
        expect(() => informeMensualQuerySchema.parse({ mes: "2026-13" })).toThrow();
        expect(() => informeMensualQuerySchema.parse({ mes: "2026-1" })).toThrow();
    });
});

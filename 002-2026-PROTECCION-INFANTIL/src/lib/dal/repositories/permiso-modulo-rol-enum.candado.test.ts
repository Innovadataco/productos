/**
 * SPEC-509 · Candado de CONDUCTA del enum `RolUsuario` en `PermisoModulo.rol`.
 *
 * El enum es self-locking mientras EXISTE (TS + el tipo enum de Postgres). Pero si
 * alguien revierte la migración/schema a `rol String`, nada se pondría rojo — y un
 * candado que no muere con el defecto no es candado.
 *
 * Este test golpea el tipo a NIVEL POSTGRES con SQL crudo (salta la validación del
 * cliente Prisma): con `rol RolUsuario`, la BD rechaza `'TYPO'` con «invalid input
 * value for enum». Con `rol String`, `'TYPO'` entraría y este test se pondría ROJO.
 * Mutación de verificación: `git stash` del cambio de enum (volver a String) → rojo.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";

describe("SPEC-509 · enum RolUsuario en PermisoModulo.rol (candado a nivel BD)", () => {
    beforeEach(async () => {
        await resetDatabase(); // siembra ModuloPermisible + los permisos por rol
    });

    it("Postgres RECHAZA un rol fuera del enum (INSERT crudo)", async () => {
        // moduloId REAL: así el ÚNICO valor inválido de la fila es rol='TYPO', y el
        // rechazo es por el tipo enum, no por el FK ni por una columna faltante.
        const modulo = await prisma.moduloPermisible.findFirst({ select: { id: true } });
        expect(modulo, "resetDatabase debe sembrar al menos un ModuloPermisible").not.toBeNull();

        await expect(
            prisma.$executeRawUnsafe(
                "INSERT INTO \"PermisoModulo\" (\"id\", \"rol\", \"moduloId\", \"actualizadoEn\") VALUES ('candado-enum-509', 'TYPO', $1, now())",
                modulo!.id
            )
        ).rejects.toThrow(/invalid input value for enum|RolUsuario/i);
    });
});

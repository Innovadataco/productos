/**
 * SPEC-296 (002-PI-197 · cierra I-152): ratchet CI de la migración de email.ts
 * al Motor de Notificaciones.
 *
 * Verifica:
 * 1. Cada uno de los 20 eventos migrados tiene ≥ 1 regla activa canal=EMAIL con
 *    plantilla existente en la BD post-seed. Falla si el seed regresa el bug
 *    "no hay regla → programar() no envía nada".
 * 2. Al llamar un wrapper representativo (`enviarCodigoVerificacion`), se crea
 *    una fila en `Notificacion` con evento, plantilla y variables correctos.
 * 3. Al llamar con múltiples destinatarios (`enviarAlertasSuscriptores`), se
 *    crean N filas — respetando el patrón de fanout.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { prisma } from "./prisma";
import { resetDatabase } from "./test-utils";
import { RolUsuario } from "@prisma/client";
import {
    enviarCodigoVerificacion,
    enviarEmailBienvenidaOperador,
    enviarAlertasSuscriptores,
} from "./email";

const REPO_ROOT = resolve(__dirname, "..", "..");
const SEED_CMD = "npx tsx prisma/seed.ts";

const EVENTOS_MIGRADOS = [
    "auth.codigo_verificacion",
    "auth.password_recuperacion",
    // SPEC-338 (I-226): aviso "ya tenés una cuenta" al registrarse con correo existente.
    "auth.cuenta_existente",
    // SPEC-322: aviso de seguridad al cambiar contraseña (obligatoria, todos los roles).
    "auth.password_cambiada",
    "usuario.bienvenida.operador",
    "usuario.bienvenida.comite",
    "usuario.credenciales.padre",
    "comite.pendientes.alerta",
    "comite.apelaciones.plazo",
    "reporte.revision.requerida",
    "reporte.score_critico",
    "padre.circulo_confianza.pendientes",
    "padre.circulo_confianza.reporte_enriquecido",
    "colegio.reporte_nuevo",
    "colegio.curso.umbral",
    "colegio.estudiante.repetido",
    "colegio.resumen_semanal",
    "colegio.alerta.pendientes",
    "suscriptores.reporte_publicado",
    "infra.alerta",
    "infra.rate_limit",
    "motor.deriva.alerta",
];

function correrSeed() {
    execSync(SEED_CMD, {
        cwd: REPO_ROOT,
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
}

describe("email.migracion (SPEC-296 · cierra I-152)", () => {
    beforeAll(async () => {
        await resetDatabase();
        // El seed omite algunos seeders sin admin; sembramos uno explícito.
        await prisma.usuario.create({
            data: {
                email: `email-migracion-admin-${Date.now()}@test.local`,
                passwordHash: "hash",
                rol: RolUsuario.ADMIN,
                estado: "activo",
            },
        });
        correrSeed();
    }, 180_000);

    it("los 20 eventos migrados tienen ≥ 1 regla activa canal=EMAIL con plantilla existente", async () => {
        for (const evento of EVENTOS_MIGRADOS) {
            const reglas = await prisma.notificacionRegla.findMany({
                where: { evento, activa: true, canal: "EMAIL" },
            });
            expect(reglas.length, `evento=${evento} sin reglas`).toBeGreaterThanOrEqual(1);
            for (const r of reglas) {
                const plantilla = await prisma.notificacionPlantilla.findUnique({
                    where: { clave: r.plantillaClave },
                });
                expect(plantilla, `plantilla ${r.plantillaClave} no existe`).not.toBeNull();
                expect(plantilla?.canal).toBe("EMAIL");
                expect(plantilla?.activa).toBe(true);
            }
        }
    });

    it("enviarCodigoVerificacion crea una fila en Notificacion con las variables correctas", async () => {
        const email = `parent-${Date.now()}@test.local`;
        await enviarCodigoVerificacion(email, "9999");
        const notif = await prisma.notificacion.findFirst({
            where: { evento: "auth.codigo_verificacion", destinatarioEmail: email },
            orderBy: { createdAt: "desc" },
        });
        expect(notif).not.toBeNull();
        expect(notif?.plantillaClave).toBe("auth.codigo_verificacion.email");
        expect(notif?.canal).toBe("EMAIL");
        expect((notif?.variables as { codigo?: string })?.codigo).toBe("9999");
    });

    it("enviarEmailBienvenidaOperador crea fila con email + tempPassword + urlLogin", async () => {
        const email = `op-${Date.now()}@test.local`;
        await enviarEmailBienvenidaOperador(email, "temp-pass-1234");
        const notif = await prisma.notificacion.findFirst({
            where: { evento: "usuario.bienvenida.operador", destinatarioEmail: email },
            orderBy: { createdAt: "desc" },
        });
        expect(notif).not.toBeNull();
        expect(notif?.plantillaClave).toBe("usuario.bienvenida.operador.email");
        const vars = notif?.variables as { email?: string; tempPassword?: string; urlLogin?: string };
        expect(vars?.email).toBe(email);
        expect(vars?.tempPassword).toBe("temp-pass-1234");
        expect(vars?.urlLogin).toContain("/login");
    });

    it("enviarAlertasSuscriptores crea N filas cuando hay N suscriptores", async () => {
        const plataforma = await prisma.plataforma.findFirstOrThrow({ where: { clave: "whatsapp" } });
        const identificadorTest = `+57300${Date.now()}`.slice(0, 15);
        // 3 suscriptores con emails únicos, todos con cooldown pasado.
        const usuarios = await Promise.all(
            [1, 2, 3].map((n) =>
                prisma.usuario.create({
                    data: {
                        email: `susc-${n}-${Date.now()}@test.local`,
                        passwordHash: "h",
                        rol: RolUsuario.PARENT,
                        estado: "activo",
                    },
                })
            )
        );
        for (const u of usuarios) {
            await prisma.alertaSuscripcion.create({
                data: {
                    usuarioId: u.id,
                    identificador: identificadorTest,
                    plataformaId: plataforma.id,
                    activa: true,
                    ultimoEmailEn: null,
                },
            });
        }

        // Habilitar el flag de alertas de suscriptores.
        await prisma.parametroSistema.upsert({
            where: { clave: "alerts.subscriptions.enabled" },
            update: { valor: "true" },
            create: {
                clave: "alerts.subscriptions.enabled",
                valor: "true",
                tipo: "BOOLEAN",
                categoria: "SYSTEM",
                esPublico: false,
                esSecreto: false,
                descripcion: "test",
            },
        });

        await enviarAlertasSuscriptores({ identificador: identificadorTest, plataformaId: plataforma.id, totalReportes: 5 });

        const emailsSuscritos = usuarios.map((u) => u.email);
        const notifs = await prisma.notificacion.findMany({
            where: { evento: "suscriptores.reporte_publicado", destinatarioEmail: { in: emailsSuscritos } },
        });
        expect(notifs.length).toBe(3);
    }, 60_000);
});

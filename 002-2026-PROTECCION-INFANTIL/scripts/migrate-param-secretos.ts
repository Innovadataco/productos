/**
 * Migra los valores de ParametroSistema con esSecreto=true de texto plano a AES-256-GCM.
 *
 * Patrón seguro:
 *   1. Dump de respaldo con timestamp (plano).
 *   2. Cifrar valores no cifrados.
 *   3. Verificar ida y vuelta: descifrar y comparar byte a byte con el respaldo.
 *   4. Opcionalmente limpiar el respaldo local si todo verificó OK.
 *
 * Uso:
 *   node --env-file=.env -r tsx scripts/migrate-param-secretos.ts
 *   node --env-file=.env -r tsx scripts/migrate-param-secretos.ts --dry-run
 *   node --env-file=.env -r tsx scripts/migrate-param-secretos.ts --clean-backup
 */
import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import {
    encryptParameter,
    decryptParameter,
    isEncryptedValue,
    verifyEncryptionKey,
} from "../src/lib/param-encryption";

const prisma = new PrismaClient();

const BACKUP_DIR = path.resolve(process.cwd(), "backups");

interface BackupEntry {
    id: string;
    clave: string;
    valorOriginal: string;
    tipo: string;
    categoria: string;
    esPublico: boolean;
    esSecreto: boolean;
    descripcion: string | null;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    const cleanBackup = process.argv.includes("--clean-backup");

    if (!verifyEncryptionKey()) {
        throw new Error(
            "PARAM_ENCRYPTION_KEY no está configurada o no es válida (debe tener 32 bytes). Abortando."
        );
    }

    const secretos = await prisma.parametroSistema.findMany({
        where: { esSecreto: true },
        orderBy: { clave: "asc" },
    });

    const pendientes = secretos.filter((p) => p.valor && !isEncryptedValue(p.valor));

    console.log(`[MIGRACION] Parámetros secretos encontrados: ${secretos.length}`);
    console.log(`[MIGRACION] Parámetros secretos pendientes de cifrar: ${pendientes.length}`);

    if (pendientes.length === 0) {
        console.log("[MIGRACION] No hay valores planos para migrar. Nada que hacer.");
        return;
    }

    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(BACKUP_DIR, `param-secretos-${timestamp}.json`);

    const backup: BackupEntry[] = pendientes.map((p) => ({
        id: p.id,
        clave: p.clave,
        valorOriginal: p.valor!,
        tipo: p.tipo,
        categoria: p.categoria,
        esPublico: p.esPublico,
        esSecreto: p.esSecreto,
        descripcion: p.descripcion,
    }));

    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), "utf8");
    console.log(`[MIGRACION] Respaldo plano guardado en: ${backupPath}`);

    if (dryRun) {
        console.log("[MIGRACION] Modo dry-run: no se modificó la base de datos.");
        return;
    }

    // PASO 2: cifrar
    try {
        await prisma.$transaction(async (tx) => {
            for (const entry of backup) {
                const cifrado = encryptParameter(entry.valorOriginal);
                await tx.parametroSistema.update({
                    where: { id: entry.id },
                    data: { valor: cifrado },
                });
            }
        });
        console.log(`[MIGRACION] ${backup.length} valor(es) cifrados en BD.`);
    } catch (error) {
        console.error("[MIGRACION] Error durante el cifrado:", error);
        console.log(`[MIGRACION] Rollback no requerido: la BD conserva los valores originales. Respaldo en ${backupPath}`);
        process.exit(1);
    }

    // PASO 3: verificación ida y vuelta
    const verificacion = await prisma.$transaction(async (tx) => {
        const fallos: { clave: string; esperado: string; obtenido: string }[] = [];
        for (const entry of backup) {
            const actual = await tx.parametroSistema.findUnique({ where: { id: entry.id } });
            if (!actual || !actual.valor) {
                fallos.push({ clave: entry.clave, esperado: entry.valorOriginal, obtenido: "(vacío/inexistente)" });
                continue;
            }
            try {
                const descifrado = decryptParameter(actual.valor);
                if (descifrado !== entry.valorOriginal) {
                    fallos.push({ clave: entry.clave, esperado: entry.valorOriginal, obtenido: descifrado });
                }
            } catch (e) {
                fallos.push({
                    clave: entry.clave,
                    esperado: entry.valorOriginal,
                    obtenido: `ERROR: ${e instanceof Error ? e.message : String(e)}`,
                });
            }
        }
        return fallos;
    });

    if (verificacion.length > 0) {
        console.error("[MIGRACION] VERIFICACIÓN FALLIDA. Fallos:");
        for (const f of verificacion) {
            console.error(`  - ${f.clave}: esperado=${f.esperado}, obtenido=${f.obtenido}`);
        }

        // Rollback: restaurar plano desde el respaldo
        console.log("[MIGRACION] Iniciando rollback...");
        await prisma.$transaction(async (tx) => {
            for (const entry of backup) {
                await tx.parametroSistema.update({
                    where: { id: entry.id },
                    data: { valor: entry.valorOriginal },
                });
            }
        });
        console.log("[MIGRACION] Rollback completado. Los valores planos fueron restaurados.");
        console.log(`[MIGRACION] Respaldo conservado en: ${backupPath}`);
        process.exit(1);
    }

    console.log(`[MIGRACION] Verificación OK: ${backup.length} valor(es) descifran idéntico al respaldo.`);

    // PASO 4: limpieza opcional del plano local
    if (cleanBackup) {
        await fs.unlink(backupPath);
        console.log(`[MIGRACION] Respaldo local eliminado: ${backupPath}`);
    } else {
        console.log(`[MIGRACION] Respaldo conservado en: ${backupPath}. Ejecutar con --clean-backup para eliminarlo.`);
    }

    console.log("[MIGRACION] Migración completada exitosamente.");
}

main()
    .catch((error) => {
        console.error("[MIGRACION] Error fatal:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

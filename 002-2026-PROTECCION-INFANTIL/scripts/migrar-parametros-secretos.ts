import { prisma } from "../src/lib/prisma";
import { encryptParameter, decryptParameter, getEncryptionKey, isEncryptedValue, verifyEncryptionKey } from "../src/lib/param-encryption";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";

async function main() {
    const key = getEncryptionKey();
    if (!key) {
        throw new Error(
            "PARAM_ENCRYPTION_KEY no está definida o no tiene 32 bytes. Configurala antes de migrar."
        );
    }

    if (!verifyEncryptionKey(key)) {
        throw new Error("La clave de cifrado no pasó la prueba de ida/vuelta.");
    }

    // Backup obligatorio antes de tocar secretos
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `pre-cifrado-parametros-${Date.now()}.sql`);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL no definida; no se puede hacer backup.");
    }

    console.log(`[MIGRACION] Creando backup en ${backupPath} ...`);
    const dump = spawnSync("pg_dump", [databaseUrl], { encoding: "utf-8" });
    if (dump.status !== 0) {
        throw new Error(`pg_dump falló: ${dump.stderr}`);
    }
    require("fs").writeFileSync(backupPath, dump.stdout);
    console.log("[MIGRACION] Backup creado.");

    const secretos = await prisma.parametroSistema.findMany({
        where: { esSecreto: true },
    });

    if (secretos.length === 0) {
        console.log("[MIGRACION] No hay parámetros marcados como secretos. Nada que cifrar.");
        return;
    }

    console.log(`[MIGRACION] ${secretos.length} parámetro(s) secreto(s) encontrados.`);

    let cifrados = 0;
    let yaCifrados = 0;
    let fallidos = 0;

    for (const param of secretos) {
        if (isEncryptedValue(param.valor)) {
            console.log(`[MIGRACION] ${param.clave} ya está cifrado; omitiendo.`);
            yaCifrados++;
            continue;
        }

        try {
            const cifrado = encryptParameter(param.valor, key);
            // Verificación ida/vuelta antes de persistir
            const descifrado = decryptParameter(cifrado, key);
            if (descifrado !== param.valor) {
                throw new Error("Verificación ida/vuelta falló");
            }

            await prisma.parametroSistema.update({
                where: { id: param.id },
                data: { valor: cifrado },
            });

            console.log(`[MIGRACION] ${param.clave} cifrado correctamente.`);
            cifrados++;
        } catch (e) {
            console.error(`[MIGRACION] Error cifrando ${param.clave}:`, e);
            fallidos++;
        }
    }

    console.log("\n[MIGRACION] Resumen:");
    console.log(`  - Cifrados: ${cifrados}`);
    console.log(`  - Ya cifrados: ${yaCifrados}`);
    console.log(`  - Fallidos: ${fallidos}`);
    console.log(`  - Backup: ${backupPath}`);

    if (fallidos > 0) {
        process.exit(1);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

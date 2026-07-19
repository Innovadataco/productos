import { vencerApelacionesPendientes } from "@/lib/apelaciones";

async function main() {
    const result = await vencerApelacionesPendientes();
    console.log(`[APELACIONES-VENCIMIENTO] Apelaciones vencidas: ${result.vencidas}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

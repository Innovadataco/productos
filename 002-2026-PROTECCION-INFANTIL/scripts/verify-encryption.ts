import { prisma } from "@/lib/prisma";
import { decryptParameter } from "@/lib/param-encryption";

async function main() {
    await prisma.parametroSistema.upsert({
        where: { clave: "test.secret.param" },
        update: {},
        create: {
            clave: "test.secret.param",
            valor: "valor-plano-secreto",
            tipo: "STRING",
            categoria: "SYSTEM",
            esPublico: false,
            esSecreto: true,
            descripcion: "test",
        },
    });
    console.log("Parámetro creado/verificado");

    const loginRes = await fetch("http://localhost:5005/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@proteccion.local", password: "Admin123!Secure" }),
    });
    if (!loginRes.ok) {
        console.log("Login falló:", loginRes.status, await loginRes.text());
        return;
    }
    const cookie = loginRes.headers.get("set-cookie") || "";

    const patchRes = await fetch("http://localhost:5005/api/config/parametros/test.secret.param", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ valor: "nuevo-secreto-123" }),
    });
    console.log("PATCH status:", patchRes.status);
    const patchBody = await patchRes.text();
    console.log("PATCH body:", patchBody);

    const db = await prisma.parametroSistema.findUnique({ where: { clave: "test.secret.param" } });
    console.log("Valor en BD:", db?.valor?.slice(0, 30), "... esSecreto:", db?.esSecreto);
    const isEncrypted = db?.valor?.startsWith("enc:") ?? false;
    console.log("Está cifrado:", isEncrypted);

    if (isEncrypted && db?.valor) {
        const plain = decryptParameter(db.valor);
        console.log("Descifrado interno:", plain);
    }

    const revRes = await fetch("http://localhost:5005/api/config/parametros/test.secret.param/revelar", {
        method: "POST",
        headers: { Cookie: cookie },
    });
    console.log("Revelar status:", revRes.status);
    console.log("Revelar body:", await revRes.text());

    await prisma.parametroSistema.delete({ where: { clave: "test.secret.param" } });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    const count = await prisma.user.count();
    if (count > 0) {
        console.log("Usuario ya existe. Saltando seed.");
        return;
    }

    const hashed = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
        data: {
            username: "admin",
            password: hashed,
            role: "admin",
        },
    });
    console.log("Usuario admin creado.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
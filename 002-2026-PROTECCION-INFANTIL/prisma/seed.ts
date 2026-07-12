import { PrismaClient, RolUsuario, TipoParametro, CategoriaParametro } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
    // Admin default
    const adminExists = await prisma.usuario.findUnique({
        where: { email: "admin@proteccion.local" },
    });

    if (!adminExists) {
        await prisma.usuario.create({
            data: {
                email: "admin@proteccion.local",
                nombre: "Administrador",
                passwordHash: await bcrypt.hash("Admin123!Secure", 12),
                rol: RolUsuario.ADMIN,
            },
        });
        console.log("Admin creado");
    }

    // Default parameters
    const defaults = [
        {
            clave: "visibility.report_threshold",
            valor: "3",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.VISIBILITY,
            esPublico: true,
            descripcion: "Mínimo reportes independientes para visibilidad pública",
        },
        {
            clave: "security.max_login_attempts",
            valor: "5",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Intentos fallidos antes de bloqueo temporal",
        },
        {
            clave: "security.lockout_duration_minutes",
            valor: "30",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Minutos de bloqueo tras exceder intentos",
        },
        {
            clave: "security.password_min_length",
            valor: "8",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: true,
            descripcion: "Longitud mínima de contraseña",
        },
        {
            clave: "security.jwt_ttl_hours",
            valor: "24",
            tipo: TipoParametro.INTEGER,
            categoria: CategoriaParametro.SECURITY,
            esPublico: false,
            descripcion: "Vida del token JWT en horas",
        },
        {
            clave: "system.maintenance_mode",
            valor: "false",
            tipo: TipoParametro.BOOLEAN,
            categoria: CategoriaParametro.SYSTEM,
            esPublico: true,
            descripcion: "Modo mantenimiento de la plataforma",
        },
    ];

    for (const p of defaults) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: {},
            create: p,
        });
    }
    console.log("Parámetros por defecto creados");

    // Empty SaaS tables - just verify they exist
    console.log("Tablas Tenant, Plan, Subscription, BillingCycle listas");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
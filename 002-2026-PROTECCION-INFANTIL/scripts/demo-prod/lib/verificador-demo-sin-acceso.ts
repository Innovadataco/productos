/**
 * I-418 · VERIFICADOR demo SIN ACCESO — firmante de verificaciones SEMBRADAS.
 *
 * Un `VerificacionProfesional.revisadoPorId` apunta a un `Usuario`. Firmar las verificaciones
 * demo con un ADMIN REAL (lo que hacía poblar-red-apoyo) deja registros demo con AUTORÍA de una
 * persona que no las revisó. Peor: un VERIFICADOR **puede aprobar profesionales reales** — la
 * capacidad viene del ROL, y una marca demo cambia lo que se VE, no lo que se puede HACER
 * ([[ceo-cuenta-demo-con-rol-privilegiado-es-llave-real]]). Por eso este firmante NO puede entrar:
 *  - clave ALEATORIA irrecuperable (hash bcrypt válido, no usable con ninguna clave conocida), y
 *  - `estado="inactivo"` → el login responde «inactiva» y `verifyAuth`/`getUserFromToken` lo
 *    rechazan en cada petición. Dos cerrojos independientes.
 *
 * SCOPE POR CORRIDA (Datos): se marca en `demo_marcado` con la corrida que se le pase, y firma SOLO
 * las verificaciones de ESA corrida. NO se reutiliza un verificador de otra corrida: como
 * `revisadoPorId` es `onDelete: Restrict`, una verificación de la corrida A que apunte a un
 * verificador de la corrida B trabaría un `purgar-demo --corrida B`. Un verificador por corrida =
 * purga por corrida a salvo.
 */
import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hashPassword } from "../../../src/lib/auth";

/** Cuenta intocable (orden permanente de Jelkin): jamás se siembra ni se usa como destino. */
const EMAIL_INTOCABLE = "soporte@innovadataco.com";

/** Clave aleatoria que nadie conoce (se descarta): hash bcrypt VÁLIDO pero no usable con ninguna clave. */
function hashInutilizable(): Promise<string> {
    return hashPassword(randomBytes(32).toString("hex"));
}

/**
 * Asegura (idempotente) el VERIFICADOR demo sin acceso de una corrida y devuelve su id.
 * Se llama DENTRO de una transacción (la marca va en la misma tx). El hash se fija SOLO al crear
 * (esta función es el único creador de ese correo → un existente ya nació sin acceso); en update
 * solo se reafirma rol/estado, para que re-correr no re-hashee (idempotencia del hash).
 */
export async function asegurarVerificadorDemoSinAcceso(
    tx: Prisma.TransactionClient,
    opts: { corrida: string; script: string; email: string; nombre?: string },
): Promise<string> {
    const { corrida, script, email } = opts;
    const nombre = opts.nombre ?? "Verificador demo (sin acceso)";
    if (email === EMAIL_INTOCABLE) {
        throw new Error(`[verificador-demo] jamás la cuenta intocable ${EMAIL_INTOCABLE}`);
    }

    const existente = await tx.usuario.findUnique({ where: { email }, select: { id: true } });
    let id: string;
    if (existente) {
        // D-121: si el correo YA existe pero NO lleva la marca demo de ESTA corrida, es una cuenta
        // AJENA — no se secuestra (abortar, no convertir). Con el correo `.invalid` esto no debería
        // pasar nunca; es defensa. Si está marcada para la corrida, es la nuestra → reafirmar.
        const marca = await tx.demoMarcado.findFirst({ where: { entidad: "Usuario", entidadId: existente.id }, select: { metadata: true } });
        const corridaMarca = (marca?.metadata as { corrida?: string } | null)?.corrida;
        if (corridaMarca !== corrida) {
            throw new Error(
                `[verificador-demo] ya existe una cuenta ${email} ${marca ? `marcada para la corrida '${corridaMarca}'` : "SIN marca demo"}; ` +
                    "no se convierte una cuenta ajena en verificador. Aborto.",
            );
        }
        // Reafirma sin-acceso; NO toca passwordHash (ya nació inutilizable acá) → idempotente.
        await tx.usuario.update({
            where: { id: existente.id },
            data: { rol: "VERIFICADOR", estado: "inactivo", estadoActivacion: "REGISTRADO", debeCambiarPassword: false },
        });
        id = existente.id;
    } else {
        const creada = await tx.usuario.create({
            data: {
                email,
                nombre,
                passwordHash: await hashInutilizable(),
                passwordCreadaEn: new Date(),
                rol: "VERIFICADOR",
                estado: "inactivo",
                estadoActivacion: "REGISTRADO",
                debeCambiarPassword: false,
            },
            select: { id: true },
        });
        id = creada.id;
    }

    // Marca en la MISMA tx (nunca una fila sembrada sin su marca). Idempotente por (entidad, id).
    await tx.demoMarcado.upsert({
        where: { entidad_entidadId: { entidad: "Usuario", entidadId: id } },
        update: {},
        create: { entidad: "Usuario", entidadId: id, metadata: { corrida, script, notas: "verificador demo sin acceso (firmante)" } },
    });

    return id;
}

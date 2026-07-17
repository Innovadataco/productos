#!/usr/bin/env tsx
/**
 * Genera reportes sinteticos de demo y los procesa contra Ollama real.
 * Uso:
 *   node --env-file=.env --import tsx scripts/generar-reportes-demo.ts --count 100 --delay 800 --procesar
 */
import { PrismaClient, type Plataforma, type Pais, type Ciudad, type Usuario } from "@prisma/client";

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE || "http://192.168.2.23:5005";
const WORKER_SECRET = process.env.WORKER_SECRET!;
const VERBOSE = process.argv.includes("--verbose");

if (!WORKER_SECRET) {
    console.error("[generar-reportes-demo] WORKER_SECRET no está definido. Seteá la variable de entorno antes de ejecutar este script.");
    process.exit(1);
}

const CATEGORIAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
] as const;

type Categoria = (typeof CATEGORIAS)[number];

interface DemoReporte {
    identificador: string;
    plataformaId: string;
    texto: string;
    ciudadId: string;
    paisId: string;
    ciudad: string;
    pais: string;
    esAnonimo: boolean;
    usuarioId?: string;
    edadVictima: number;
    fechaIncidente: Date;
    categoriaEsperada: Categoria;
}

function parseArgs() {
    const args = process.argv.slice(2);
    let count = 100;
    let delayMs = 800;
    let procesar = false;
    let cleanup = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--count" && args[i + 1]) count = parseInt(args[i + 1], 10);
        if (args[i] === "--delay" && args[i + 1]) delayMs = parseInt(args[i + 1], 10);
        if (args[i] === "--procesar") procesar = true;
        if (args[i] === "--cleanup") cleanup = true;
    }
    return { count, delayMs, procesar, cleanup };
}

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function cargarContexto() {
    const plataformas = await prisma.plataforma.findMany({ where: { esActiva: true } });
    const paises = await prisma.pais.findMany({
        where: { esActivo: true },
        include: { ciudades: { where: { esActivo: true } } },
    });
    const admin = await prisma.usuario.findFirst({ where: { rol: "ADMIN" } });

    if (plataformas.length === 0) throw new Error("No hay plataformas activas");
    if (paises.length === 0) throw new Error("No hay paises activos");

    return { plataformas, paises, admin };
}

function generarIdentificador(index: number): string {
    const tipos = ["tel", "nick", "email"];
    const tipo = tipos[index % tipos.length];
    const unique = `${String(index).padStart(3, "0")}${Math.random().toString(36).slice(2, 6)}`;
    if (tipo === "tel") return `300${unique.slice(0, 8)}`;
    if (tipo === "nick") return `demo_${unique}`;
    return `demo_${unique}@example.com`;
}

function sample<T>(arr: T[], seed: number): T {
    return arr[Math.abs(seed) % arr.length];
}

function generarTexto(categoria: Categoria, index: number, plataforma: string, ciudad: string, pais: string, edad: number): string {
    const plantillas = PLANTILLAS_POR_CATEGORIA[categoria];
    const plantilla = sample(plantillas, index * 31 + edad);
    const reemplazos: Record<string, string> = {
        plataforma,
        ciudad,
        pais,
        edad: String(edad),
        numero: String(1000 + (index % 9000)),
    };
    let texto = plantilla.replace(/\{\{(\w+)\}\}/g, (_, k) => reemplazos[k] ?? k);
    texto += ` Caso de prueba demo #${index + 1} para validacion de graficos.`;
    return texto;
}

function generarReportes(
    count: number,
    plataformas: Plataforma[],
    paises: (Pais & { ciudades: Ciudad[] })[],
    admin: Usuario | null
): DemoReporte[] {
    const reportes: DemoReporte[] = [];

    for (let i = 0; i < count; i++) {
        const categoria = CATEGORIAS[i % CATEGORIAS.length];
        const plataforma = plataformas[i % plataformas.length];
        const pais = paises[i % paises.length];
        const ciudad = pais.ciudades[i % pais.ciudades.length];
        const esAnonimo = i % 3 !== 0; // 1 de cada 3 autenticado

        reportes.push({
            identificador: generarIdentificador(i),
            plataformaId: plataforma.id,
            texto: generarTexto(categoria, i, plataforma.nombre, ciudad.nombre, pais.nombre, 10 + (i % 8)),
            ciudadId: ciudad.id,
            paisId: pais.id,
            ciudad: ciudad.nombre,
            pais: pais.nombre,
            esAnonimo,
            usuarioId: esAnonimo ? undefined : admin?.id,
            edadVictima: 10 + (i % 8),
            fechaIncidente: new Date(Date.now() - (i % 60) * 24 * 60 * 60 * 1000),
            categoriaEsperada: categoria,
        });
    }
    return reportes;
}

async function insertarReportes(reportes: DemoReporte[]) {
    const creados: { id: string; categoriaEsperada: Categoria }[] = [];
    for (const r of reportes) {
        const numeroSeguimiento = `RPT-DEMO-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        const creado = await prisma.reporte.create({
            data: {
                identificador: r.identificador,
                plataformaId: r.plataformaId,
                texto: r.texto,
                fechaIncidente: r.fechaIncidente,
                ciudad: r.ciudad,
                pais: r.pais,
                paisId: r.paisId,
                ciudadId: r.ciudadId,
                esAnonimo: r.esAnonimo,
                edadVictima: r.edadVictima,
                usuarioId: r.usuarioId,
                numeroSeguimiento,
                estado: "PENDIENTE",
            },
            select: { id: true },
        });
        creados.push({ id: creado.id, categoriaEsperada: r.categoriaEsperada });
    }
    return creados;
}

async function procesarReporte(reporteId: string, intento = 1): Promise<{ estado: string; categoria?: string; confianza?: number; clasificacion?: { categoria?: string; confianza?: number }; error?: string }> {
    try {
        const res = await fetch(`${API_BASE}/api/reportes/procesar`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-worker-secret": WORKER_SECRET,
            },
            body: JSON.stringify({ reporteId }),
        });
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body}`);
        }
        return await res.json();
    } catch (err) {
        if (intento < 3) {
            await sleep(2000 * intento);
            return procesarReporte(reporteId, intento + 1);
        }
        return { estado: "ERROR", error: err instanceof Error ? err.message : String(err) };
    }
}

async function main() {
    const { count, delayMs, procesar, cleanup } = parseArgs();

    if (cleanup) {
        console.log("Eliminando reportes demo previos...");
        const previos = await prisma.reporte.deleteMany({
            where: { numeroSeguimiento: { startsWith: "RPT-DEMO-" } },
        });
        console.log(`${previos.count} reportes demo eliminados`);
    }

    console.log(`Generando ${count} reportes de demo...`);
    const { plataformas, paises, admin } = await cargarContexto();
    if (VERBOSE) {
        console.log(`Contexto: ${plataformas.length} plataformas, ${paises.length} paises, admin=${admin?.email || "ninguno"}`);
    } else {
        console.log(`Contexto: ${plataformas.length} plataformas, ${paises.length} paises`);
    }

    const reportes = generarReportes(count, plataformas, paises, admin);
    const creados = await insertarReportes(reportes);
    console.log(`${creados.length} reportes insertados en estado PENDIENTE`);

    if (!procesar) {
        console.log("Omitido procesamiento. Usa --procesar para clasificar con Ollama.");
        await prisma.$disconnect();
        return;
    }

    console.log(`Iniciando procesamiento con Ollama (delay ${delayMs}ms)...`);
    const resultados: { esperada: Categoria; estado: string; categoria?: string; confianza?: number; clasificacion?: { categoria?: string; confianza?: number }; error?: string }[] = [];

    for (let i = 0; i < creados.length; i++) {
        const { id, categoriaEsperada } = creados[i];
        process.stdout.write(`[${i + 1}/${creados.length}] ${id.slice(0, 8)}... `);
        const resultado = await procesarReporte(id);
        resultados.push({ esperada: categoriaEsperada, ...resultado });
        const cat = resultado.clasificacion?.categoria || resultado.categoria;
        const conf = resultado.clasificacion?.confianza ?? resultado.confianza;
        console.log(`${resultado.estado} | IA: ${cat || "-"} | conf: ${conf?.toFixed(2) || "-"}`);
        await sleep(delayMs + Math.random() * 400);
    }

    // Resumen
    const total = resultados.length;
    const porEstado = new Map<string, number>();
    const porCategoria = new Map<string, number>();
    let aciertos = 0;

    for (const r of resultados) {
        porEstado.set(r.estado, (porEstado.get(r.estado) || 0) + 1);
        const cat = (r.clasificacion?.categoria || r.categoria) || "SIN_CLASIFICAR";
        porCategoria.set(cat, (porCategoria.get(cat) || 0) + 1);
        if (cat === r.esperada) aciertos++;
    }

    console.log("\n=== RESUMEN ===");
    console.log("Por estado:", Object.fromEntries(porEstado));
    console.log("Por categoria IA:", Object.fromEntries(porCategoria));
    console.log(`Coincidencia categoria esperada: ${aciertos}/${total} (${((aciertos / total) * 100).toFixed(1)}%)`);

    await prisma.$disconnect();
}

const PLANTILLAS_POR_CATEGORIA: Record<Categoria, string[]> = {
    CONTACTO_INSISTENTE: [
        "En {{plataforma}} me escribe todos los dias aunque no le respondo, insiste en saber donde estudio en {{ciudad}}.",
        "Desde hace semanas me envia mensajes cada hora por {{plataforma}} diciendo que quiere ser mi amigo especial.",
        "No deja de llamarme por videollamada a deshoras en {{plataforma}} y se enoja si no contesto.",
        "Me manda emojis y frases incomodos todo el tiempo por {{plataforma}}, ya le pedi que pare pero sigue.",
        "Crea cuentas nuevas cada vez que lo bloqueo en {{plataforma}} para seguirme escribiendo.",
        "Me envia mensajes de voz diciendo que soy suyo y que no puedo ignorarlo en {{plataforma}}.",
        "Publica comentarios en todas mis fotos pidiendo que le hable privado por {{plataforma}}.",
        "Me escribe de madrugada diciendo que me esta esperando en linea en {{plataforma}}.",
        "Insiste en que le cuente detalles intimos de mi vida familiar en {{plataforma}}.",
        "Me reclama porque no le contesto rapido y me exige explicaciones por {{plataforma}}.",
        "Me dice que soy la unica persona que lo entiende y que debo confiar en el en {{plataforma}}.",
        "Me envia listas de todo lo que hago durante el dia como si me espiara en {{plataforma}}.",
        "Me encuentra en todos los grupos de {{plataforma}} a los que entro y me etiqueta sin parar.",
        "Me mira fijamente en los streams y me envia donaciones con mensajes raros por {{plataforma}}.",
        "Me amenaza con hacerse dano si no le respondo los mensajes de {{plataforma}}.",
    ],
    SOLICITUD_MATERIAL: [
        "En {{plataforma}} me pide que le mande fotos en ropa interior diciendo que es solo para el.",
        "Por {{plataforma}} quiere que le envie videos mios cambiandome y promete borrarlos despues.",
        "Me dice por {{plataforma}} que si no le mando fotos intimas va a difundir rumores de mi.",
        "En {{plataforma}} pide fotos de partes de mi cuerpo usando excusas de un reto entre amigos.",
        "Me presiona por {{plataforma}} para enviarle fotos desnuda porque desaparecen.",
        "Por {{plataforma}} me amenaza con compartir mis secretos si no le envio imagenes privadas.",
        "En {{plataforma}} me pide un video en la ducha y dice que nadie se va a enterar.",
        "Por {{plataforma}} quiere que le pase fotos de mi hermana menor tambien.",
        "Me dice por {{plataforma}} que ya otras chicas le mandaron y que yo debo hacer lo mismo.",
        "Me exige por {{plataforma}} fotos cada vez mas comprometedoras o me va a dejar de hablar.",
        "En {{plataforma}} me pide que le envie audios diciendo cosas obscenas.",
        "Por {{plataforma}} quiere que me filme haciendo cosas indecentes para un supuesto casting.",
        "En {{plataforma}} me ofrece dinero a cambio de fotos intimas de mi cuerpo.",
        "Me dice por {{plataforma}} que me ama pero solo si le demuestro con fotos sin ropa.",
        "Por {{plataforma}} insiste en que le mande fotos de mis pies y luego pide mas.",
    ],
    OFRECIMIENTO_REGALOS: [
        "En {{plataforma}} me ofrece tarjetas de regalo si acepto quedar a solas con el.",
        "Por {{plataforma}} promete comprarme un telefono nuevo si le doy mi direccion exacta.",
        "Me dice por {{plataforma}} que me va a dar dinero cada semana si soy su amiga especial.",
        "En {{plataforma}} me ofrece pases para un concierto a cambio de fotos privadas.",
        "Por {{plataforma}} quiere enviarme regalos a mi casa en {{ciudad}} pero necesita saber mi direccion.",
        "Me promete por {{plataforma}} una consola de videojuegos si no le cuento a nadie de nuestra amistad.",
        "En {{plataforma}} me dice que me va a sacar de compras si le envio fotos en bikini.",
        "Por {{plataforma}} ofrece pagarme el celular a cambio de videollamada en secreto.",
        "En {{plataforma}} me promete dulces y peluches si accedo a ir a su departamento.",
        "Me dice por {{plataforma}} que me dara dinero para mi familia si hago lo que me pide.",
        "En {{plataforma}} me ofrece un pase vip a un parque tematico si lo visito sin mis padres.",
        "Por {{plataforma}} quiere mandarme ropa cara pero primero quiere verme probandomela.",
        "En {{plataforma}} me ofrece bitcoins a cambio de un encuentro privado.",
        "Promete por {{plataforma}} pagarme la universidad si mantengo nuestra relacion en secreto.",
        "Me dice por {{plataforma}} que me va a dar un auto cuando sea mayor si confio en el ahora.",
    ],
    SUPLANTACION_IDENTIDAD: [
        "En {{plataforma}} se hace pasar por un companero nuevo de mi colegio y pide fotos de mis tareas.",
        "Por {{plataforma}} dice ser prima mia y pide el numero de mis padres para una supuesta emergencia.",
        "Finge ser un profesor del colegio en {{plataforma}} y me pide datos personales de mi familia.",
        "En {{plataforma}} se hace pasar por un familiar lejano que viene de visita y pide mi direccion.",
        "Dice por {{plataforma}} ser amigo de mi hermano mayor y quiere que le pase fotos de casa.",
        "En {{plataforma}} crea un perfil falso con fotos de otra persona para acercarse a mi.",
        "Finge ser de un canal de television infantil en {{plataforma}} y me pide un video de presentacion.",
        "Dice por {{plataforma}} ser medico del colegio y necesita informacion sobre mi salud.",
        "En {{plataforma}} se hace pasar por entrenador deportivo para pedirme fotos en uniforme.",
        "Dice por {{plataforma}} ser un influencer que busca jovenes para un proyecto secreto.",
        "Finge ser mi primo recien llegado del extranjero en {{plataforma}} y quiere quedar.",
        "Por {{plataforma}} dice trabajar en una ONG que ayuda a ninos y pide datos bancarios de mis padres.",
        "En {{plataforma}} se hace pasar por policia juvenil y me amenaza si no le doy informacion.",
        "Finge por {{plataforma}} ser un amigo de infancia que perdio el contacto y pide fotos actuales.",
        "Dice ser director de casting para menores en {{plataforma}} y me pide un video en traje de bano.",
    ],
    SOLICITUD_ENCUENTRO: [
        "En {{plataforma}} me invita a encontrarnos en un parque de {{ciudad}} despues de clases sin avisar.",
        "Por {{plataforma}} quiere que vaya a su casa a jugar videojuegos mientras sus padres no estan.",
        "Me pide por {{plataforma}} quedar en un centro comercial de {{ciudad}} a escondidas.",
        "Dice por {{plataforma}} que va a pasar por mi en su carro si le doy mi direccion.",
        "Me propone por {{plataforma}} ir juntos a una cabana cerca de {{ciudad}} el fin de semana.",
        "En {{plataforma}} quiere vernos en un motel diciendo que es solo para platicar.",
        "Me pide por {{plataforma}} que me escape de mi casa en la noche para encontrarnos.",
        "Me invita por {{plataforma}} a una fiesta donde supuestamente habra solo gente grande.",
        "Dice por {{plataforma}} que me va a recoger en la salida del colegio para llevarme a comer.",
        "Me manda por {{plataforma}} la ubicacion de un departamento y me pide que vaya sola.",
        "En {{plataforma}} quiere que nos veamos en una zona boscosa apartada del parque.",
        "Me propone por {{plataforma}} quedar en la estacion de tren para irnos a otra ciudad.",
        "Me dice por {{plataforma}} que me espera afuera de mi casa y que no le diga a mis papas.",
        "Me invita por {{plataforma}} a un hotel para ver peliculas y dormir juntos.",
        "Quiere por {{plataforma}} que nos encontremos en la playa de {{pais}} a las seis de la manana.",
    ],
    COMPARTIMIENTO_SEXUAL: [
        "Por {{plataforma}} me envio un video sexual sin pedirlo y me dice que deberia hacer lo mismo.",
        "En {{plataforma}} me pasa imagenes de personas desnudas y me pregunta si me gustan.",
        "Comparte contenido pornografico en un grupo de {{plataforma}} donde hay menores.",
        "Me envia por {{plataforma}} fotos intimas de otra persona diciendo que son mias.",
        "Me obliga por {{plataforma}} a ver videos sexuales mientras hablamos por llamada.",
        "Me pide por {{plataforma}} que le describa fantasias sexuales por mensaje de voz.",
        "Envia por {{plataforma}} enlaces a paginas para adultos diciendo que es para aprender.",
        "Me comparte por {{plataforma}} capturas de chats sexuales de otras personas.",
        "Me dice por {{plataforma}} que me va a mandar fotos suyas si yo le mando las mias.",
        "Me envia por {{plataforma}} audio con gemidos y contenido sexual explicito.",
        "Comparte en su historia de {{plataforma}} imagenes sugestivas etiquetandome a mi.",
        "Me pide por {{plataforma}} que participe en un video sexual con otra persona.",
        "Me manda por {{plataforma}} mensajes describiendo actos sexuales que quiere hacer conmigo.",
        "Me envia por {{plataforma}} gifs y stickers de contenido sexual todo el tiempo.",
        "Me pide por {{plataforma}} que le cuente detalles de mi cuerpo en desarrollo.",
    ],
    OTRO: [
        "En {{plataforma}} me amenaza con lastimar a mi mascota si no le hago caso.",
        "Me dice por {{plataforma}} que sabe donde vivo en {{ciudad}} y que va a publicar mi direccion.",
        "Me acosa por {{plataforma}} en los comentarios con mensajes de odio.",
        "Me obliga por {{plataforma}} a bloquear a mis amigos para que solo le hable a el.",
        "Me envia por {{plataforma}} fotos de armas diciendo que puede hacerle dano a mi familia.",
        "Me extorsiona por {{plataforma}} diciendo que va a inventar cosas malas de mi en el colegio.",
        "Me obliga por {{plataforma}} a ver contenido violento y a reaccionar como si me gustara.",
        "Me chantajea por {{plataforma}} con conversaciones privadas que tuve con otra persona.",
        "Me discrimina por mi apariencia en {{plataforma}} y me obliga a cambiar mi forma de vestir.",
        "Me prohibe por {{plataforma}} participar en grupos de clase y me aísla de mis companeros.",
        "Me envia por {{plataforma}} mensajes suicidas y me culpa si no le presto atencion.",
        "Me hace pasar verguenza publica en {{plataforma}} inventando rumores sobre mi sexualidad.",
        "Me obliga por {{plataforma}} a compartir contrasenas de mis cuentas personales.",
        "Me dice por {{plataforma}} que va a crear perfiles falsos mios para perjudicarme.",
        "Me manipula emocionalmente por {{plataforma}} diciendo que sin mi su vida no tiene sentido.",
    ],
};

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});

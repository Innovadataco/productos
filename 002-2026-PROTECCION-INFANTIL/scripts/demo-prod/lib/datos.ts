import fs from "node:fs";
import path from "node:path";
import type { CategoriaConducta } from "@prisma/client";
import {
    CORRIDA,
    CATEGORIAS_PESOS,
    ESTADOS_HISTORICOS,
    DIAS_FRESCOS_MAX,
    DIAS_HISTORICOS_MAX,
} from "./config";

interface CasoBanco {
    texto: string;
    categoriaEsperada: string;
}

interface BancoSimulacion {
    fixtureVersion?: number;
    nota?: string;
    casos: CasoBanco[];
}

const bancoPath = path.resolve(import.meta.dirname ?? ".", "../../simulacion/simulacion-200-antes-curaduria.json");
const banco: BancoSimulacion = JSON.parse(fs.readFileSync(bancoPath, "utf8")) as BancoSimulacion;

function hashString(str: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed: number): () => number {
    return function () {
        let t = (seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const seed = hashString(CORRIDA);
const rnd = mulberry32(seed);

const NOMBRES_MASCULINOS = [
    "Santiago", "Mateo", "Sebastián", "Daniel", "Samuel", "Alejandro", "Nicolás", "Lucas",
    "Gabriel", "Tomás", "Emiliano", "Emmanuel", "Juan", "José", "David", "Andrés",
    "Martín", "Hugo", "Leo", "Diego", "Adrián", "Ángel", "Javier", "Maximiliano",
    "Iker", "Thiago", "Bruno", "Héctor", "Ricardo", "Mario", "Esteban", "Víctor",
    "Fernando", "Antonio", "César", "Miguel", "Jorge", "Eduardo", "Rafael", "Rubén",
    "Cristian", "Dylan", "Ian", "Aaron", "Julio", "Saúl", "Alan", "Marco",
    "Josué", "Matías", "Benjamín", "Damián", "Erick", "Felipe", "Guillermo", "Lorenzo",
    "Mauricio", "Octavio", "Pablo", "Sergio",
];

const NOMBRES_FEMENINOS = [
    "Sofía", "Valentina", "Isabella", "Camila", "Luciana", "Mariana", "Valeria", "Emma",
    "Martina", "Lucía", "Victoria", "Natalia", "Sara", "Daniela", "Gabriela", "Renata",
    "Julieta", "Antonella", "Emilia", "Agustina", "Morena", "Romina", "Milagros", "Araceli",
    "Fernanda", "Paola", "Alejandra", "Carolina", "Diana", "Elena", "María", "Laura",
    "Paula", "Catalina", "Elisa", "Irene", "Jimena", "Karla", "Lorena", "Melissa",
    "Noelia", "Olivia", "Priscila", "Regina", "Salomé", "Tatiana", "Vanessa", "Wendy",
    "Ximena", "Yamila", "Zoe", "Abril", "Brisa", "Clara", "Delfina", "Estefanía",
    "Florencia", "Giselle", "Helena", "Inés",
];

const APELLIDOS = [
    "García", "Rodríguez", "Gómez", "Martínez", "López", "González", "Hernández", "Sánchez",
    "Pérez", "Ramírez", "Torres", "Flores", "Rivera", "Díaz", "Reyes", "Morales",
    "Cruz", "Ortiz", "Gutiérrez", "Chávez", "Ramos", "Aguilar", "Mendoza", "Ruiz",
    "Castillo", "Romero", "Vásquez", "Moreno", "Guerrero", "Castro", "Vargas", "Álvarez",
    "Mendez", "Jiménez", "Silva", "Rojas", "Medina", "Herrera", "Aguirre", "Fuentes",
    "Cortés", "Domínguez", "Sandoval", "Espinosa", "Vega", "Valencia", "Núñez", "Miranda",
    "Molina", "Delgado", "Cárdenas", "Padilla", "Marín", "León", "Peña", "Soto",
    "Campos", "Santos", "Salazar", "Mejía", "Rosales", "Carrillo", "Acosta", "Arias",
    "Parra", "Ibarra", "Navarro", "Figueroa", "Franco", " Bravo", "Toro", "Cabrera",
    "Maldonado", "Pacheco", "Escobar", "Velasco", "Contreras", "Sepúlveda", "Valenzuela", "Tapia",
];

const PREFIJOS_COLEGIO = [
    "Colegio DEMO Innova",
    "Institución Educativa DEMO",
    "Centro Educativo DEMO",
    "Colegio Campestre DEMO",
    "Gimnasio DEMO",
];

const RELACIONES_ACUDIENTE = ["madre", "padre", "tía", "tío", "abuela", "abuelo", "tutor"];

export function enteroEntre(min: number, max: number): number {
    return Math.floor(rnd() * (max - min + 1)) + min;
}

export function floatEntre(min: number, max: number): number {
    return rnd() * (max - min) + min;
}

export function esVerdadero(probabilidad: number): boolean {
    return rnd() < probabilidad;
}

function seleccionarPeso<T extends { peso: number }>(opciones: readonly T[]): T {
    const total = opciones.reduce((sum, o) => sum + o.peso, 0);
    let punto = rnd() * total;
    for (const opcion of opciones) {
        punto -= opcion.peso;
        if (punto <= 0) {
            return opcion;
        }
    }
    return opciones[opciones.length - 1] ?? opciones[0]!;
}

export function elegirCategoria(): CategoriaConducta {
    return seleccionarPeso(CATEGORIAS_PESOS).categoria;
}

export function elegirEstadoHistorico(): "CLASIFICADO" | "REVISION_MANUAL" | "POSIBLE_SPAM" | "CORREGIDO" {
    return seleccionarPeso(ESTADOS_HISTORICOS).estado;
}

export function nombreColegio(idx: number): string {
    return `${PREFIJOS_COLEGIO[idx % PREFIJOS_COLEGIO.length]} ${String(idx + 1).padStart(2, "0")}`;
}

export function nombrePersona(idx: number): { nombre: string; apellidos: string } {
    const femenino = idx % 2 === 0;
    const nombres = femenino ? NOMBRES_FEMENINOS : NOMBRES_MASCULINOS;
    const nombre = nombres[idx % nombres.length];
    const apellido1 = APELLIDOS[idx % APELLIDOS.length];
    const apellido2 = APELLIDOS[(idx * 7 + 13) % APELLIDOS.length];
    return { nombre, apellidos: `${apellido1} ${apellido2}` };
}

export function edadVictima(): number {
    return enteroEntre(10, 17);
}

export function telefonoDemo(idx: number): string {
    return `300DEMO${String(idx).padStart(7, "0")}`;
}

export function nickDemo(idx: number): string {
    return `demo_nick_${String(idx).padStart(7, "0")}`;
}

export function emailIdentificadorDemo(idx: number): string {
    return `demo_ident_${String(idx).padStart(7, "0")}@innovadataco.com`;
}

export function emailUsuarioDemo(rol: string, idx: number): string {
    const slug = rol.toLowerCase().replace(/_/g, "");
    return `soporte+${slug}${String(idx).padStart(2, "0")}@innovadataco.com`;
}

export function numeroSeguimientoDemo(idx: number): string {
    return `RPT-DEMO-${String(idx + 1).padStart(5, "0")}`;
}

export function identificadoresEstudiante(idxBase: number): { tipo: string; valor: string }[] {
    return [
        { tipo: "telefono", valor: telefonoDemo(idxBase * 5 + 1) },
        { tipo: "nick", valor: nickDemo(idxBase * 5 + 2) },
        { tipo: "email", valor: emailIdentificadorDemo(idxBase * 5 + 3) },
        { tipo: "telefono", valor: telefonoDemo(idxBase * 5 + 4) },
        { tipo: "nick", valor: nickDemo(idxBase * 5 + 5) },
    ];
}

export function relacionAcudiente(): string {
    return RELACIONES_ACUDIENTE[Math.floor(rnd() * RELACIONES_ACUDIENTE.length)] ?? "tutor";
}

export function cantidadAcudientes(): number {
    return rnd() > 0.55 ? 2 : 1;
}

export function textoDemo(categoria: CategoriaConducta): string {
    const casos = banco.casos.filter((c) => c.categoriaEsperada === categoria);
    const pool = casos.length > 0 ? casos : banco.casos;
    const caso = pool[Math.floor(rnd() * pool.length)];
    if (!caso) return "Reporte demo sin descripción.";

    const prefijos = [
        "Reporto que ",
        "Me contaron que ",
        "Detectamos que ",
        "Una persona nos informó que ",
        "",
    ];
    const sufijos = [
        " Esto me preocupa.",
        " Por favor revisar.",
        "",
    ];

    const prefijo = prefijos[Math.floor(rnd() * prefijos.length)] ?? "";
    const sufijo = sufijos[Math.floor(rnd() * sufijos.length)] ?? "";

    let texto = caso.texto;
    if (prefijo) {
        texto = texto.charAt(0).toLowerCase() + texto.slice(1);
        texto = `${prefijo}${texto}`;
    }
    texto = `${texto}${sufijo}`;
    return texto;
}

export function fechaReporte(esFresco: boolean): Date {
    const ahora = Date.now();
    const msPorDia = 24 * 60 * 60 * 1000;
    if (esFresco) {
        const ms = rnd() * DIAS_FRESCOS_MAX * msPorDia;
        return new Date(ahora - ms);
    }
    const dias = DIAS_FRESCOS_MAX + rnd() * (DIAS_HISTORICOS_MAX - DIAS_FRESCOS_MAX);
    const ms = dias * msPorDia;
    return new Date(ahora - ms);
}

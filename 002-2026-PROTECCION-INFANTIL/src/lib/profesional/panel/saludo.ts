/**
 * SPEC-437 (punto 5) · el saludo del panel del profesional.
 *
 * El panel mostraba **«Hola, ¡Hola!»**. Tomaba `PerfilProfesional.nombreVisible`
 * y le hacía `split(" ")[0]`. Ese campo se pide en la ficha con la etiqueta
 * «Cómo querés que te vean», que induce a escribir una presentación entera:
 * el valor real de Jelkin era *«¡Hola! mi nombre es Beatriz, aunque todo el
 * mundo me llama Bea…»*, cuya primera palabra es «¡Hola!».
 *
 * El arreglo es de los dos lados. Este archivo es el del servidor: **el saludo
 * usa el nombre de la cuenta**, no un campo libre, y si lo único disponible es
 * el campo libre solo lo acepta cuando **parece un nombre**. Si no lo parece,
 * saluda sin nombre — «Hola» a secas es correcto; «Hola, ¡Hola!» es un defecto
 * a la vista del usuario.
 *
 * El otro lado (renombrar y acotar el campo en la ficha) vive en la pantalla
 * que toca SPEC-434 y se coordina allá; este candado sostiene el panel aunque
 * el campo siga trayendo prosa.
 */

/** Más largo que esto ya no es un nombre: es una presentación. */
const MAX_PALABRAS_NOMBRE = 4;
const MAX_LARGO_NOMBRE = 40;

/** Signos que delatan una frase, no un nombre. */
const SIGNOS_DE_FRASE = /[¡!¿?.,;:()"]/;

/** Saludos y muletillas con las que la gente abre una presentación. */
const ARRANQUES_DE_SALUDO = new Set(["hola", "holaa", "buenas", "buenos", "hey", "saludos", "qué", "que"]);

function limpiar(valor: string): string {
    return valor.replace(/\s+/g, " ").trim();
}

/**
 * ¿Este texto es un nombre y no una presentación?
 *
 * Conservador a propósito: ante la duda dice que no, y el panel saluda sin
 * nombre. Equivocarse hacia «Hola» cuesta nada; hacia «Hola, ¡Hola!» cuesta
 * la credibilidad de la pantalla.
 */
export function pareceUnNombre(valor: string | null | undefined): boolean {
    if (!valor) return false;
    const limpio = limpiar(valor);
    if (limpio.length === 0 || limpio.length > MAX_LARGO_NOMBRE) return false;
    if (SIGNOS_DE_FRASE.test(limpio)) return false;

    const palabras = limpio.split(" ");
    if (palabras.length > MAX_PALABRAS_NOMBRE) return false;

    const primera = palabras[0]?.toLowerCase() ?? "";
    if (ARRANQUES_DE_SALUDO.has(primera)) return false;

    // Un nombre no lleva dígitos ni arroba.
    return !/[\d@]/.test(limpio);
}

/**
 * El nombre con el que saludar, o `null` para saludar sin nombre.
 *
 * Prefiere el nombre de la CUENTA (`Usuario.nombre`): es el dato que la persona
 * dio para identificarse, no para presentarse. `nombreVisible` es el respaldo y
 * solo entra si pasa el filtro.
 */
export function nombreParaSaludo(
    nombreCuenta: string | null | undefined,
    nombreVisible: string | null | undefined,
): string | null {
    for (const candidato of [nombreCuenta, nombreVisible]) {
        if (!pareceUnNombre(candidato)) continue;
        const primero = limpiar(candidato as string).split(" ")[0];
        if (primero) return primero;
    }
    return null;
}

/** El encabezado listo para pintar: «Hola, Beatriz» o «Hola». */
export function saludoDelPanel(
    nombreCuenta: string | null | undefined,
    nombreVisible: string | null | undefined,
): string {
    const nombre = nombreParaSaludo(nombreCuenta, nombreVisible);
    return nombre ? `Hola, ${nombre}` : "Hola";
}

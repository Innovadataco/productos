/**
 * Sets de preguntas de la rúbrica por categoría (spec 090).
 * Preguntas ESTRICTAS (indicadores factuales del texto): 1 solo con evidencia CLARA.
 * Se siembran en ParametroSistema (`ia.rubrica.preguntas`); los expertos las refinan
 * desde el tab "Rúbrica" sin desplegar código (ADR_004).
 */

export interface PreguntaRubrica {
    texto: string;
    activo: boolean;
}

export type SetsRubrica = Record<string, PreguntaRubrica[]>;

export const RUBRICA_SEMILLA: SetsRubrica = {
    COMPARTIMIENTO_SEXUAL: [
        { texto: "¿El texto describe que alguien compartió o envió contenido sexual?", activo: true },
        { texto: "¿El contenido es explícitamente sexual (no solo sugerente o romántico)?", activo: true },
        { texto: "¿La persona afectada o involucrada es menor de edad?", activo: true },
        { texto: "¿La acción de compartir o enviar está presente en el texto (no solo mencionada)?", activo: true },
    ],
    SOLICITUD_MATERIAL: [
        { texto: "¿Alguien pide fotos, videos o material visual a otra persona?", activo: true },
        { texto: "¿El material pedido es íntimo, del cuerpo o de contenido sexual?", activo: true },
        { texto: "¿La persona a quien se le pide es menor de edad?", activo: true },
        { texto: "¿Quien pide es un adulto o un desconocido?", activo: true },
    ],
    SOLICITUD_ENCUENTRO: [
        { texto: "¿Alguien propone verse o encontrarse en persona?", activo: true },
        { texto: "¿La propuesta viene de un adulto o un desconocido?", activo: true },
        { texto: "¿Involucra a un menor de edad?", activo: true },
        { texto: "¿La propuesta insiste a pesar de excusas o falta de respuesta?", activo: true },
    ],
    CONTACTO_INSISTENTE: [
        { texto: "¿Hay mensajes o llamadas repetidas a pesar de no recibir respuesta?", activo: true },
        { texto: "¿La insistencia genera incomodidad o miedo descrito en el texto?", activo: true },
        { texto: "¿El contacto proviene de un desconocido o de alguien mayor?", activo: true },
        { texto: "¿Continúa el contacto a pesar de pedirle que pare o de bloquearlo?", activo: true },
    ],
    OFRECIMIENTO_REGALOS: [
        { texto: "¿Se ofrece algo de valor (dinero, regalos, recargas, skins, ropa)?", activo: true },
        { texto: "¿El ofrecimiento viene de un adulto o un desconocido?", activo: true },
        { texto: "¿Va dirigido a un menor de edad?", activo: true },
        { texto: "¿Se ofrece a cambio de algo o para ganar la confianza del menor?", activo: true },
    ],
    SUPLANTACION_IDENTIDAD: [
        { texto: "¿Alguien se hace pasar por otra persona o entidad (nombre, fotos, cargo)?", activo: true },
        { texto: "¿La identidad usada es falsa o robada?", activo: true },
        { texto: "¿La suplantación se usa para contactar o ganarse a un menor?", activo: true },
        { texto: "¿El texto da evidencia concreta de la farsa (perfil falso, datos que no coinciden)?", activo: true },
    ],
    EXTORSION: [
        { texto: "¿Hay una amenaza o presión explícita en el texto?", activo: true },
        { texto: "¿Se exige algo (dinero, fotos, acceso, favores) a cambio de no divulgar o no dañar?", activo: true },
        { texto: "¿La amenaza involucra publicar contenido o hacer daño a la víctima o su familia?", activo: true },
        { texto: "¿La víctima es menor de edad?", activo: true },
    ],
    CONTENIDO_GENERADO_IA: [
        { texto: "¿El contenido fue creado o alterado con inteligencia artificial (deepfake, montaje)?", activo: true },
        { texto: "¿El contenido representa a una persona real e identificable?", activo: true },
        { texto: "¿El contenido es íntimo o sexual?", activo: true },
        { texto: "¿La persona representada es menor de edad?", activo: true },
    ],
    DIFUSION_NO_CONSENTIDA: [
        { texto: "¿Se compartió contenido privado de alguien sin su permiso?", activo: true },
        { texto: "¿La persona afectada NO autorizó su difusión?", activo: true },
        { texto: "¿El contenido es íntimo, sensible o de la vida privada?", activo: true },
        { texto: "¿La difusión fue a terceros (grupos, contactos, redes)?", activo: true },
    ],
    DOXING: [
        { texto: "¿Se publican datos personales (dirección, teléfono, colegio, ubicación)?", activo: true },
        { texto: "¿La publicación busca exponer a la persona o facilitar su localización?", activo: true },
        { texto: "¿Los datos pertenecen a un menor de edad?", activo: true },
        { texto: "¿Los datos se compartieron sin autorización del afectado?", activo: true },
    ],
};

export const CATEGORIAS_RUBRICA = Object.keys(RUBRICA_SEMILLA);

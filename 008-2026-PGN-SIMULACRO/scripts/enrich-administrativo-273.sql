-- Enriquecimiento de preguntas de derecho administrativo del perfil 273
-- Generado: 2026-09-14
-- Fuente: Manual Específico de Funciones PGN v.10, Convocatoria 273-2026, Resoluciones de selección,
--         Código de Procedimiento Administrativo y de lo Contencioso Administrativo (Ley 1437 de 2011),
--         Ley 489 de 1998 y Ley 1755 de 2015.
-- Acciones: ajuste de distribución de respuestas correctas (5 por posición) y correcciones menores.
BEGIN TRANSACTION;

-- Pregunta 2: reordenamiento para distribución de respuestas correctas.
UPDATE preguntas
SET opciones = '["Solo a las entidades territoriales y a sus funcionarios","A todos los organismos y entidades del poder público, órganos autónomos e independientes, y a los particulares cuando cumplan funciones administrativas","Exclusivamente a los jueces administrativos y al Consejo de Estado","Únicamente a los ministerios y departamentos administrativos de la Rama Ejecutiva"]',
    respuesta = 1,
    explicacion = 'El artículo 2 de la Ley 1437 de 2011 establece que las normas de la Parte Primera se aplican a todos los organismos y entidades que conforman las ramas del poder público, a los órganos autónomos e independientes del Estado y a los particulares cuando cumplan funciones administrativas, a quienes se denomina autoridades.',
    norma = 'Ley 1437/2011',
    articulo = 'Art. 2',
    dificultad = 'facil'
WHERE id = 2;

-- Pregunta 4: reordenamiento para distribución de respuestas correctas.
UPDATE preguntas
SET opciones = '["Principio de transparencia","Principio de eficiencia","Principio de gratuidad absoluta en la prestación de todos los servicios públicos","Principio de moralidad"]',
    respuesta = 2,
    explicacion = 'El artículo 3 de la Ley 489 de 1998 señala que la función administrativa se desarrollará conforme a los principios constitucionales, en particular los de buena fe, igualdad, moralidad, celeridad, economía, imparcialidad, eficacia, eficiencia, participación, publicidad, responsabilidad y transparencia. La gratuidad absoluta no figura en dicha enumeración.',
    norma = 'Ley 489/1998',
    articulo = 'Art. 3',
    dificultad = 'facil'
WHERE id = 4;

-- Pregunta 5: reordenamiento para distribución de respuestas correctas.
UPDATE preguntas
SET opciones = '["Solo los abogados pueden presentar peticiones ante las autoridades administrativas","El derecho de petición solo procede cuando se invoca expresamente el artículo 23 de la Constitución","Toda persona tiene derecho a presentar peticiones respetuosas por motivos de interés general o particular y a obtener pronta resolución completa y de fondo","Las peticiones deben limitarse a solicitar información sobre presupuesto público"]',
    respuesta = 2,
    explicacion = 'El artículo 13 de la Ley 1755 de 2015 establece que toda persona tiene derecho a presentar peticiones respetuosas a las autoridades por motivos de interés general o particular y a obtener pronta resolución completa y de fondo sobre la misma. Además, toda actuación ante las autoridades implica el ejercicio del derecho de petición sin necesidad de invocarlo.',
    norma = 'Ley 1755/2015',
    articulo = 'Art. 13',
    dificultad = 'facil'
WHERE id = 5;

-- Pregunta 19: corrección tipográfica del enunciado.
UPDATE preguntas
SET enunciado = 'Los artículos 83 y 84 de la Ley 1437 de 2011 regulan el silencio administrativo. ¿Cuál de las siguientes afirmaciones es correcta?'
WHERE id = 19;

COMMIT;

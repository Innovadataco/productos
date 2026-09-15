-- Enriquecimiento de 7 preguntas válidas de planeacion-273.
-- Las 13 preguntas restantes del set original (ids 183,184,185,186,188,191,192,194,195,196,197,198,200)
-- quedan marcadas para reemplazo en data/contenido/reemplazos-planeacion-273.json
-- y serán eliminadas lógicamente en el merge final.

-- Q181: instrumento básico de planeación -> Constitución Política Art. 339
UPDATE preguntas
SET
  norma = 'Constitución Política',
  articulo = 'Art. 339',
  explicacion = 'El artículo 339 de la Constitución Política establece el Plan Nacional de Desarrollo como el instrumento de planificación nacional conformado por una parte general y un plan de inversiones, en el cual se definen los propósitos, objetivos, metas y estrategias de la acción estatal.',
  opciones = '["Presupuesto General de la Nación","Plan Nacional de Desarrollo","Plan Operativo Anual","Plan de Acción"]',
  respuesta = 1,
  dificultad = 'facil'
WHERE id = 181;

-- Q182: contenido del PND -> Ley 152/1994 Art. 5 (reordenado a posición 2)
UPDATE preguntas
SET
  norma = 'Ley 152/1994',
  articulo = 'Art. 5',
  explicacion = 'El artículo 5 de la Ley 152 de 1994 señala que la parte general del Plan Nacional de Desarrollo contendrá los objetivos nacionales y sectoriales, las metas, las estrategias y políticas económicas, sociales y ambientales, y los procedimientos y mecanismos generales para alcanzar las metas.',
  opciones = '["La nómina de servidores públicos","Solo la asignación presupuestal anual","La estrategia y los programas para alcanzar los objetivos","El listado de contratos a celebrar"]',
  respuesta = 2,
  dificultad = 'medio'
WHERE id = 182;

-- Q187: armonización planes territoriales -> Constitución Política Art. 339 (reordenado a posición 3)
UPDATE preguntas
SET
  norma = 'Constitución Política',
  articulo = 'Art. 339',
  explicacion = 'El artículo 339 de la Constitución Política dispone que las entidades territoriales elaborarán y adoptarán de manera concertada entre ellas y el Gobierno nacional sus planes de desarrollo, garantizando la armonización con el Plan Nacional de Desarrollo.',
  opciones = '["El presupuesto municipal únicamente","Solo los intereses del gobernador o alcalde","Las decisiones del Concejo o Asamblea","El Plan Nacional de Desarrollo"]',
  respuesta = 3,
  dificultad = 'facil'
WHERE id = 187;

-- Q189: Banco de Programas -> Ley 152/1994 Art. 27
UPDATE preguntas
SET
  norma = 'Ley 152/1994',
  articulo = 'Art. 27',
  explicacion = 'El artículo 27 de la Ley 152 de 1994 establece que el Banco de Programas y Proyectos de Inversión Nacional es un instrumento para la planeación, que será administrado por el Departamento Nacional de Planeación, el cual conceptuará sobre los programas de inversión y mantendrá actualizada la información.',
  opciones = '["El Departamento Nacional de Planeación","La Procuraduría General","La Contraloría General","El Ministerio de Hacienda"]',
  respuesta = 0,
  dificultad = 'medio'
WHERE id = 189;

-- Q190: participación ciudadana -> Ley 152/1994 Art. 12 (corregido de Art. 25)
UPDATE preguntas
SET
  norma = 'Ley 152/1994',
  articulo = 'Art. 12',
  explicacion = 'El artículo 12 de la Ley 152 de 1994 establece las funciones del Consejo Nacional de Planeación, entre ellas organizar y coordinar una amplia discusión nacional sobre el proyecto del Plan Nacional de Desarrollo, con el fin de garantizar eficazmente la participación ciudadana de acuerdo con el artículo 342 de la Constitución Política.',
  opciones = '["Art. 10","Art. 12","Art. 41","Art. 4"]',
  respuesta = 1,
  dificultad = 'facil'
WHERE id = 190;

-- Q193: duración del PND -> Constitución Política Arts. 191 y 341 (corregido de Ley 152 Art. 4; reordenado a posición 2)
UPDATE preguntas
SET
  enunciado = 'Según la Constitución Política, el Plan Nacional de Desarrollo tendrá una duración igual al período presidencial, es decir:',
  norma = 'Constitución Política',
  articulo = 'Arts. 191 y 341',
  explicacion = 'La Constitución Política, en el artículo 191, establece que el período presidencial es de cuatro años, y en el artículo 341 dispone que el Gobierno presentará el proyecto del Plan Nacional de Desarrollo al Congreso dentro de los seis meses siguientes a la iniciación del período presidencial, correspondiendo su vigencia a dicho período.',
  opciones = '["Seis años","Dos años","Cuatro años","Ocho años"]',
  respuesta = 2,
  dificultad = 'facil'
WHERE id = 193;

-- Q199: planes indicativos -> Ley 152/1994 Art. 29 (corregido de Art. 9)
UPDATE preguntas
SET
  norma = 'Ley 152/1994',
  articulo = 'Art. 29',
  explicacion = 'El artículo 29 de la Ley 152 de 1994 dispone que todos los organismos de la administración pública nacional deberán elaborar, con base en los lineamientos del Plan Nacional de Desarrollo y de las funciones que les señale la ley, un plan indicativo cuatrienal con planes de acción anuales, que servirá de base para la evaluación de resultados.',
  opciones = '["Cada municipio independientemente","Solo la Presidencia de la República","La Rama Judicial exclusivamente","Los sectores administrativos con funciones similares"]',
  respuesta = 3,
  dificultad = 'dificil'
WHERE id = 199;

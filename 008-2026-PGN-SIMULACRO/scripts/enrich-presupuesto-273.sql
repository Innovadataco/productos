-- Enriquecimiento del tema presupuesto-273 (perfil 273)
-- Fuentes: Constitución Política, Decreto 111 de 1996 (Estatuto Orgánico del Presupuesto),
--          Ley 819 de 2003, Decreto 1068 de 2015 (DUR Sector Hacienda y Crédito Público)
--          y Manual Específico de Funciones de la PGN (versión 10, 10/08/2026).

BEGIN TRANSACTION;

-- Preguntas válidas: corrección de norma, artículo, explicación y reorden de opciones
-- para distribuir respuestas correctas 20-30% por posición en el set final.

UPDATE preguntas SET
  enunciado = 'Según el Estatuto Orgánico del Presupuesto, ¿cuál es el instrumento técnico que define los objetivos, metas y recursos de las entidades públicas para una vigencia fiscal?',
  opciones = '["Presupuesto General de la Nación","Plan Anual de Adquisiciones","Plan de Acción Institucional","Plan Nacional de Desarrollo"]',
  respuesta = 0,
  explicacion = 'El Decreto 111 de 1996, Estatuto Orgánico del Presupuesto, señala que la ley anual sobre el Presupuesto General de la Nación es el instrumento para el cumplimiento de los planes y programas de desarrollo económico y social, definiendo objetivos, metas y recursos.',
  norma = 'Decreto 111/1996',
  articulo = 'Art. 10',
  dificultad = 'medio'
WHERE id = 202;

UPDATE preguntas SET
  enunciado = '¿Cuál es el propósito principal del Presupuesto General de la Nación según la Constitución Política?',
  opciones = '["Regular el mercado cambiario y crediticio","Fijar las tasas de impuestos nacionales","Distribuir los recursos del Estado para el cumplimiento de sus fines constitucionales","Financiar proyectos privados de infraestructura"]',
  respuesta = 2,
  explicacion = 'La Constitución Política (art. 346) y el Estatuto Orgánico del Presupuesto establecen que el presupuesto anual de rentas y gastos distribuye los recursos del Estado para el cumplimiento de sus fines constitucionales y los objetivos del Plan Nacional de Desarrollo.',
  norma = 'Constitución Política',
  articulo = 'Art. 346',
  dificultad = 'medio'
WHERE id = 203;

UPDATE preguntas SET
  enunciado = 'El Decreto 1068 de 2015 es conocido como el:',
  opciones = '["Código Único de Hacienda","Decreto Único Reglamentario del Sector Hacienda y Crédito Público","Estatuto Orgánico del Sistema General de Participaciones","Estatuto Orgánico del Sistema de Regalías"]',
  respuesta = 1,
  explicacion = 'El Decreto 1068 de 2015 es el Decreto Único Reglamentario del Sector Hacienda y Crédito Público; su objeto es compilar la normatividad reglamentaria de dicho sector.',
  norma = 'Decreto 1068/2015',
  articulo = 'Art. 2.1.1',
  dificultad = 'facil'
WHERE id = 204;

UPDATE preguntas SET
  enunciado = '¿Qué entidad del orden nacional coordina la formulación del proyecto de Presupuesto General de la Nación?',
  opciones = '["Procuraduría General de la Nación","Departamento Nacional de Planeación","Contraloría General de la República","Ministerio de Hacienda y Crédito Público"]',
  respuesta = 3,
  explicacion = 'El Ministerio de Hacienda y Crédito Público es la entidad del orden nacional encargada de las decisiones en materia fiscal y de coordinar la formulación del proyecto de Presupuesto General de la Nación, conforme al Estatuto Orgánico del Presupuesto.',
  norma = 'Decreto 111/1996',
  articulo = 'Art. 40',
  dificultad = 'medio'
WHERE id = 206;

UPDATE preguntas SET
  enunciado = 'La Ley 819/2003 tiene por objeto regular:',
  opciones = '["El Presupuesto General de la Nación","La contratación pública estatal","El régimen aduanero y tributario","El Sistema General de Regalías"]',
  respuesta = 0,
  explicacion = 'La Ley 819 de 2003 dicta normas orgánicas en materia de presupuesto, responsabilidad y transparencia fiscal; por tanto, su objeto es regular el Presupuesto General de la Nación y la disciplina fiscal.',
  norma = 'Ley 819/2003',
  articulo = 'Título',
  dificultad = 'facil'
WHERE id = 207;

UPDATE preguntas SET
  enunciado = 'El Decreto 1068/2015 deroga y compila las normas reglamentarias del sector:',
  opciones = '["Educación Nacional","Protección Social","Hacienda y Crédito Público","Defensa Nacional"]',
  respuesta = 2,
  explicacion = 'El Decreto 1068 de 2015 compila y unifica las normas reglamentarias del sector Hacienda y Crédito Público.',
  norma = 'Decreto 1068/2015',
  articulo = 'Art. 2.1.1',
  dificultad = 'medio'
WHERE id = 209;

UPDATE preguntas SET
  enunciado = 'Según la Constitución Política, el proyecto de presupuesto de rentas y ley de apropiaciones debe ser presentado ante el Congreso de la República:',
  opciones = '["A más tardar el 15 de enero de cada año","El 1 de abril de cada año","El 15 de julio de cada año","Dentro de los primeros diez días de cada legislatura"]',
  respuesta = 3,
  explicacion = 'El artículo 346 de la Constitución Política dispone que el Gobierno formulará anualmente el presupuesto de rentas y ley de apropiaciones, el cual será presentado al Congreso dentro de los primeros diez días de cada legislatura.',
  norma = 'Constitución Política',
  articulo = 'Art. 346',
  dificultad = 'dificil'
WHERE id = 210;

UPDATE preguntas SET
  enunciado = 'Según el Decreto 111 de 1996, el Presupuesto General de la Nación se estructura por:',
  opciones = '["Solo inversión pública","Presupuesto de rentas, presupuesto de gastos y disposiciones generales","Solo gastos de funcionamiento","Solo deuda pública interna y externa"]',
  respuesta = 1,
  explicacion = 'El artículo 11 del Decreto 111 de 1996 establece que el Presupuesto General de la Nación se compone del Presupuesto de Rentas, el Presupuesto de Gastos o Ley de Apropiaciones, y las Disposiciones Generales.',
  norma = 'Decreto 111/1996',
  articulo = 'Art. 11',
  dificultad = 'medio'
WHERE id = 213;

UPDATE preguntas SET
  enunciado = 'El Presupuesto General de la Nación debe aprobarse mediante:',
  opciones = '["Ley anual de la República","Resolución del Ministro de Hacienda","Acuerdo municipal o departamental","Decreto del Presidente de la República"]',
  respuesta = 0,
  explicacion = 'La Constitución Política (art. 346) y el Estatuto Orgánico del Presupuesto (Decreto 111/1996, art. 10) establecen que el Presupuesto General de la Nación se aprueba mediante ley anual de la República.',
  norma = 'Constitución Política',
  articulo = 'Art. 346',
  dificultad = 'medio'
WHERE id = 215;

UPDATE preguntas SET
  enunciado = 'Según la Ley 819/2003, las vigencias futuras en el presupuesto se autorizan cuando:',
  opciones = '["Cualquier gasto de funcionamiento sin límite","Gastos de personal de planta","La ejecución se inicia en la vigencia en curso y el objeto se lleva a cabo en cada vigencia futura","Funcionamiento corriente de todas las entidades"]',
  respuesta = 2,
  explicacion = 'El artículo 10 de la Ley 819 de 2003, desarrollado en el artículo 23 del Decreto 111 de 1996, autoriza vigencias futuras cuando la ejecución se inicia con presupuesto de la vigencia en curso y el objeto del compromiso se desarrolla en cada una de ellas, entre otros requisitos.',
  norma = 'Ley 819/2003',
  articulo = 'Art. 10',
  dificultad = 'dificil'
WHERE id = 216;

UPDATE preguntas SET
  enunciado = 'El Decreto 111/1996 fue expedido por:',
  opciones = '["La Corte Constitucional","Las asambleas departamentales","El Congreso de la República","El Presidente de la República"]',
  respuesta = 3,
  explicacion = 'El Decreto 111 de 1996 fue expedido por el Presidente de la República en ejercicio de sus facultades constitucionales y legales, al compilar las leyes orgánicas del presupuesto.',
  norma = 'Decreto 111/1996',
  articulo = 'Art. 1',
  dificultad = 'facil'
WHERE id = 217;

UPDATE preguntas SET
  enunciado = 'La Ley 819/2003 busca garantizar la:',
  opciones = '["Regulación del sistema bancario nacional","Sostenibilidad fiscal y el cumplimiento de metas del Plan Nacional de Desarrollo","Libre competencia comercial en el sector financiero","Protección absoluta de la propiedad privada"]',
  respuesta = 1,
  explicacion = 'La Ley 819 de 2003 establece normas de disciplina fiscal, superávit primario y sostenibilidad de la deuda, alineando la gestión del presupuesto con el logro de los objetivos y metas del Plan Nacional de Desarrollo.',
  norma = 'Ley 819/2003',
  articulo = 'Art. 2',
  dificultad = 'medio'
WHERE id = 218;

UPDATE preguntas SET
  enunciado = 'Según el Decreto 1068/2015, las disponibilidades presupuestales certificadas constituyen requisito previo para:',
  opciones = '["Nombrar funcionarios públicos","Crear empresas industriales y comerciales del Estado","Celebrar contratos y asumir compromisos que afecten recursos del presupuesto","Aprobar proyectos de ley en el Congreso"]',
  respuesta = 2,
  explicacion = 'El artículo 2.8.1.7.1 del Decreto 1068 de 2015 dispone que, previo a contraer compromisos que afecten el presupuesto, los órganos del Presupuesto General de la Nación requieren la expedición de un certificado de disponibilidad presupuestal.',
  norma = 'Decreto 1068/2015',
  articulo = 'Art. 2.8.1.7.1',
  dificultad = 'dificil'
WHERE id = 220;

-- Preguntas inválidas / fuera del alcance documental del tema presupuesto-273:
-- se marcan para reemplazo; la eliminación lógica se hará en el merge final.
UPDATE preguntas SET
  explicacion = 'Pregunta fuera del alcance documental del tema presupuesto-273; reemplazo en data/contenido/reemplazos-presupuesto-273.json',
  norma = 'PENDIENTE REEMPLAZO',
  articulo = '-',
  dificultad = 'media'
WHERE id IN (201, 205, 208, 211, 212, 214, 219);

COMMIT;

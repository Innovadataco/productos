-- Enriquecimiento de preguntas de contratación estatal del perfil 273
-- Generado: 2026-09-14
-- Fuente: Manual Específico de Funciones PGN v.10, Convocatoria 273-2026, Resoluciones de selección
BEGIN TRANSACTION;

UPDATE preguntas
SET opciones = '["Decreto 1082 de 2015", "Ley 80 de 1993", "Ley 1474 de 2011", "Ley 1150 de 2007"]',
    respuesta = 1,
    norma = 'Ley 80/1993',
    articulo = 'Art. 1',
    explicacion = 'La Ley 80 de 1993 es la norma fundamental del régimen de contratación estatal en Colombia; su artículo 1° define el objeto de la ley: reglamentar los contratos celebrados por entidades estatales, estableciendo principios, modalidades de selección y un régimen de responsabilidad que garantice el uso eficiente y transparente de los recursos públicos.',
    dificultad = 'facil'
WHERE id = 61;


UPDATE preguntas
SET opciones = '["Rentabilidad privada","Moralidad","Secreto comercial absoluto","Libertad sin control"]',
    respuesta = 1,
    norma = 'Ley 80/1993',
    articulo = 'Art. 2',
    explicacion = 'El artículo 2° de la Ley 80 de 1993 consagra los principios rectores de la contratación estatal: moralidad, transparencia, economía, igualdad, responsabilidad, publicidad y celeridad. Estos principios deben regir todos los actos contractuales de las entidades públicas y constituyen parámetro de legalidad.',
    dificultad = 'facil'
WHERE id = 62;


UPDATE preguntas
SET opciones = '["Licitación pública","Mínimas cuantías","Concurso de méritos","Contratación directa"]',
    respuesta = 0,
    norma = 'Ley 80/1993',
    articulo = 'Art. 5',
    explicacion = 'La licitación pública es la modalidad ordinaria de selección para contratos cuyo objeto está claramente definido en especificaciones técnicas y cantidades, permitiendo la comparación objetiva de ofertas conforme al artículo 5° de la Ley 80 de 1993.',
    dificultad = 'medio'
WHERE id = 63;


UPDATE preguntas
SET opciones = '["Mínimas cuantías","Concurso de diseño","Licitación pública internacional","Alianza pública-privada"]',
    respuesta = 0,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 5',
    explicacion = 'La Ley 1150 de 2007 incorporó las mínimas cuantías como modalidad simplificada para contratar bienes y servicios cuyo valor no supere los umbrales establecidos por Colombia Compra Eficiente, de conformidad con su artículo 5°.',
    dificultad = 'medio'
WHERE id = 64;


UPDATE preguntas
SET opciones = '["Ministerio de Hacienda","Colombia Compra Eficiente","Contraloría General","Procuraduría General"]',
    respuesta = 1,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 2',
    explicacion = 'Colombia Compra Eficiente es la Unidad Administrativa Especial adscrita al Ministerio de Hacienda y Crédito Público encargada de regular, orientar y promover la gestión de compras públicas, incluyendo el SECOP y el catálogo electrónico, según el artículo 2° de la Ley 1150 de 2007.',
    dificultad = 'facil'
WHERE id = 65;


UPDATE preguntas
SET opciones = '["Art. 41","Art. 35","Art. 2","Art. 25"]',
    respuesta = 3,
    norma = 'Ley 80/1993',
    articulo = 'Art. 25',
    explicacion = 'El artículo 25° de la Ley 80 de 1993 regula los requisitos de participación que deben cumplir los proponentes, garantizando que cuenten con capacidad jurídica, técnica, financiera y operativa para ejecutar el objeto contractual.',
    dificultad = 'dificil'
WHERE id = 66;


-- Pregunta 67 inválida/fuera de tema: se reemplaza por data/contenido/reemplazos-contratacion-273.json

UPDATE preguntas
SET opciones = '["Ley 1475 de 2011","Ley 1474 de 2011","Ley 1150 de 2007","Ley 80 de 1993"]',
    respuesta = 2,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 2',
    explicacion = 'La Ley 1150 de 2007 reformó parcialmente la Ley 80 de 1993 e introdujo mecanismos de compra eficiente como la subasta inversa, las mínimas cuantías, los acuerdos marco de precios y cantidades, y el fortalecimiento del SECOP, conforme a su artículo 2° y disposiciones desarrolladas por Colombia Compra Eficiente.',
    dificultad = 'medio'
WHERE id = 68;


UPDATE preguntas
SET opciones = '["Art. 35","Art. 25","Art. 26","Art. 2"]',
    respuesta = 0,
    norma = 'Ley 80/1993',
    articulo = 'Art. 35',
    explicacion = 'El artículo 35° de la Ley 80 de 1993 establece las causales de inhabilidad e incompatibilidad para contratar con el Estado, como parentesco con funcionarios contratantes, sanciones disciplinarias, conflicto de intereses y participación en la preparación del proceso.',
    dificultad = 'medio'
WHERE id = 69;


UPDATE preguntas
SET opciones = '["Art. 25","Art. 2","Art. 45","Art. 35"]',
    respuesta = 3,
    norma = 'Ley 1474/2011',
    articulo = 'Art. 35',
    explicacion = 'El artículo 35° de la Ley 1474 de 2011 creó el Registro Único de Proponentes (RUP), herramienta mediante la cual los interesados acreditan su idoneidad una sola vez ante el Estado para participar en procesos de contratación.',
    dificultad = 'medio'
WHERE id = 70;


UPDATE preguntas
SET opciones = '["Licitaci\\u00f3n p\\u00fablica", "Concurso de m\\u00e9ritos", "Subasta inversa", "Selecci\\u00f3n abreviada"]',
    respuesta = 3,
    norma = 'Ley 80/1993',
    articulo = 'Art. 7',
    explicacion = 'La selección abreviada es la modalidad en que la entidad invita a varios proponentes para presentar ofertas, previa publicación de las bases y calificación de requisitos mínimos, conforme al artículo 7° de la Ley 80 de 1993.',
    dificultad = 'facil'
WHERE id = 71;


UPDATE preguntas
SET opciones = '["Contrato de comodato","Contrato de consultoría","Contrato de compraventa","Contrato de obra"]',
    respuesta = 2,
    norma = 'Ley 80/1993',
    articulo = 'Art. 131',
    explicacion = 'El contrato de compraventa es la figura contractual utilizada para la adquisición de bienes muebles, mediante la cual la entidad pública adquiere la propiedad a cambio de un precio, según el artículo 131° de la Ley 80 de 1993.',
    dificultad = 'facil'
WHERE id = 72;


UPDATE preguntas
SET opciones = '["Econom\\u00eda", "Proporcionalidad", "Transparencia", "Celeridad"]',
    respuesta = 2,
    norma = 'Ley 80/1993',
    articulo = 'Art. 2',
    explicacion = 'El principio de transparencia impone que los procesos de contratación estatal se realicen con publicidad, acceso a la información y posibilidad de control social, evitando decisiones arbitrarias, según el artículo 2° de la Ley 80 de 1993.',
    dificultad = 'facil'
WHERE id = 73;


UPDATE preguntas
SET opciones = '["Solicitar garantías de seriedad","Usar licitación pública","Dividir un contrato en varios de menor cuantía","Publicar el plan anual de adquisiciones"]',
    respuesta = 2,
    norma = 'Ley 1474/2011',
    articulo = 'Art. 45',
    explicacion = 'El artículo 45° de la Ley 1474 de 2011 prohíbe dividir un mismo objeto contractual en varios contratos de menor cuantía para eludir topes, requisitos o modalidades de selección establecidas por la ley, como práctica anticorrupción.',
    dificultad = 'medio'
WHERE id = 74;


UPDATE preguntas
SET opciones = '["Reducción de garantías","Cambio de objeto","Prórroga automática","Resolución del contrato"]',
    respuesta = 3,
    norma = 'Ley 80/1993',
    articulo = 'Art. 131',
    explicacion = 'Ante el incumplimiento grave por parte del contratista, la entidad pública puede declarar la resolución del contrato, lo que produce la extinción de la relación contractual y acarrea sanciones, conforme al artículo 131° de la Ley 80 de 1993.',
    dificultad = 'medio'
WHERE id = 75;


UPDATE preguntas
SET opciones = '["Acuerdo marco de precios y cantidades","Contratación directa","Concurso de méritos","Licitación pública"]',
    respuesta = 0,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 4',
    explicacion = 'Los acuerdos marco de precios y cantidades permiten que múltiples entidades estatales adquieran bienes y servicios bajo condiciones previamente pactadas por Colombia Compra Eficiente, generando economías de escala, conforme al artículo 4° de la Ley 1150 de 2007.',
    dificultad = 'dificil'
WHERE id = 76;


UPDATE preguntas
SET opciones = '["1 mes","3 meses","15 días hábiles","6 meses"]',
    respuesta = 1,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 13',
    explicacion = 'La Ley 1150 de 2007 establece que la garantía de seriedad de los proponentes no adjudicatarios debe devolverse en un plazo máximo de tres meses contado a partir de la adjudicación del contrato, según su artículo 13°.',
    dificultad = 'dificil'
WHERE id = 77;


UPDATE preguntas
SET opciones = '["Vicio del consentimiento","Falta de objeto lícito","Incapacidad técnica","Conflicto de intereses"]',
    respuesta = 3,
    norma = 'Ley 80/1993',
    articulo = 'Art. 35',
    explicacion = 'El vínculo familiar o económico entre contratista y funcionario contratante configura inhabilidad e incompatibilidad por conflicto de intereses, según el artículo 35° de la Ley 80 de 1993; la celebración del contrato violando dicha inhabilidad puede acarrear su nulidad por inobservancia de requisitos esenciales de participación.',
    dificultad = 'dificil'
WHERE id = 78;


UPDATE preguntas
SET opciones = '["Subasta inversa", "Licitaci\\u00f3n p\\u00fablica", "Selecci\\u00f3n abreviada", "M\\u00ednimas cuant\\u00edas"]',
    respuesta = 0,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 4',
    explicacion = 'La subasta inversa es un mecanismo electrónico en el que los oferentes compiten reduciendo progresivamente el precio de sus ofertas para bienes y servicios estandarizados de bajo valor, regulado por el artículo 4° de la Ley 1150 de 2007.',
    dificultad = 'medio'
WHERE id = 79;


UPDATE preguntas
SET opciones = '["PILA","RUNT","SECOP","RUP"]',
    respuesta = 2,
    norma = 'Ley 1150/2007',
    articulo = 'Art. 2',
    explicacion = 'El SECOP es el Sistema Electrónico de Contratación Pública, plataforma mediante la cual las entidades estatales publican procesos, reciben ofertas y garantizan transparencia y trazabilidad en la contratación, conforme al artículo 2° de la Ley 1150 de 2007.',
    dificultad = 'medio'
WHERE id = 80;


COMMIT;
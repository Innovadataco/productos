-- Enriquecimiento/ajuste de preguntas anticorrupcion-273 del perfil 273
-- Fuentes verificadas: Ley 1474 de 2011 (Estatuto Anticorrupción), Ley 2195 de 2022,
-- Ley 599 de 2000 (Código Penal), Ley 80 de 1993, Ley 87 de 1993, Ley 678 de 2001,
-- Ley 610 de 2000 y Manual de funciones / convocatoria 273-2026.
-- Se mantienen enunciados y opciones; solo se ajustan norma, artículo y explicación.

UPDATE preguntas
SET explicacion = 'El artículo 1 de la Ley 2195 de 2022 dispone que su objeto es adoptar disposiciones para prevenir los actos de corrupción, reforzar la articulación y coordinación de las entidades del Estado y recuperar los daños ocasionados, con el fin de asegurar la cultura de legalidad e integridad.'
WHERE id = 21;

UPDATE preguntas
SET explicacion = 'El artículo 20 del Código Penal amplía la noción de servidor público a miembros de corporaciones públicas, empleados del Estado, miembros de la fuerza pública, particulares que ejercen funciones públicas permanentes o transitorias y quienes administran recursos públicos, lo cual es esencial para tipificar delitos contra la administración pública.'
WHERE id = 22;

UPDATE preguntas
SET explicacion = 'El artículo 1 de la Ley 1474 de 2011 modificó el literal j) del numeral 1 del artículo 8 de la Ley 80 de 1993, estableciendo originalmente una inhabilidad de veinte (20) años para contratar con el Estado para quienes fueran declarados responsables judicialmente por delitos contra la Administración Pública cuya pena principal fuera privativa de la libertad.'
WHERE id = 23;

UPDATE preguntas
SET explicacion = 'El artículo 66 de la Ley 1474 de 2011 crea la Comisión Nacional Ciudadana integrada por representantes de gremios económicos, ONG dedicadas a la lucha contra la corrupción, universidades, medios de comunicación, veedurías ciudadanas, Consejo Nacional de Planeación, organizaciones sindicales y CONFERILEC (Confederación Colombiana de Libertad Religiosa, Conciencia y Culto); no incluye partidos políticos.'
WHERE id = 26;

UPDATE preguntas
SET explicacion = 'El artículo 13 de la Ley 1474 de 2011 modificó el artículo 68A del Código Penal para excluir beneficios y subrogados penales a quienes sean condenados por delitos contra la administración pública, estafa y abuso de confianza que recaigan sobre los bienes del Estado, utilización indebida de información privilegiada, lavado de activos y soborno transnacional.'
WHERE id = 31;

UPDATE preguntas
SET explicacion = 'El artículo 34 de la Ley 1474 de 2011, modificado por la Ley 2195 de 2022, establece que la responsabilidad administrativa sancionatoria de personas jurídicas procede cuando, entre otros supuestos, existe sentencia penal condenatoria ejecutoriada o principio de oportunidad en firme contra administradores o funcionarios por delitos relacionados con la administración pública, el patrimonio público u otras conductas punibles señaladas en la norma, y la persona jurídica se benefició, buscó beneficiarse, consintió o toleró la conducta.'
WHERE id = 34;

UPDATE preguntas
SET explicacion = 'El artículo 397 del Código Penal sanciona al servidor público que se apropie en provecho propio o de tercero de bienes del Estado, empresas o instituciones en que éste tenga parte, fondos parafiscales, o bienes de particulares cuya administración, tenencia o custodia se le haya confiado.'
WHERE id = 35;

UPDATE preguntas
SET articulo = 'Art. 5 (modificado por Ley 2195 de 2022)'
WHERE id = 39;

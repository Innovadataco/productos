/**
 * RESTAURAR LAS 62 PREGUNTAS ORIGINALES
 * Proyecto: pr.innovadataco.com — Simulacro PGN 2026
 *
 * Las 62 preguntas base (ids 1-62) se perdieron al recrear la pestaña.
 * Este script las reinserta SIN TOCAR las 225 preguntas nuevas.
 *
 * COMO USAR:
 *   1. Apps Script > pega este codigo en un archivo nuevo
 *   2. Ejecuta: restaurarOriginales()
 *   3. Verifica: debe quedar en 287 filas de datos
 *
 * Es idempotente: si detecta que los ids 1-62 ya existen, no duplica.
 */

var PREGUNTAS_ORIGINALES = [
 [
  1,
  "Jelkin",
  "Contratación",
  "¿Cuál es la modalidad correcta para contratar el desarrollo de un sistema de información a medida para el Estado?",
  "Licitación pública",
  "Concurso de méritos",
  "Contratación directa",
  "Selección abreviada — subasta inversa",
  1,
  "El desarrollo de software a medida es un servicio de consultoría que requiere conocimiento especializado. Art. 2 Ley 1150/2007.",
  "Ley 1150/2007 — Art. 2",
  "medio"
 ],
 [
  2,
  "Jelkin",
  "Contratación",
  "¿Qué es el Plan Anual de Adquisiciones (PAA)?",
  "El presupuesto aprobado por el Congreso",
  "La lista de contratos que planea celebrar la entidad durante el año",
  "El inventario de bienes de la entidad",
  "El plan de auditoría de contratación",
  1,
  "El PAA debe publicarse al inicio del año y actualizarse. Es obligatorio para todas las entidades estatales.",
  "D. 1082/2015 — Art. 2.2.1.1.1.7",
  "facil"
 ],
 [
  3,
  "Jelkin",
  "Contratación",
  "¿Cuándo procede la contratación directa por prestación de servicios profesionales?",
  "Siempre que la entidad requiera un profesional",
  "Solo cuando hay urgencia manifiesta",
  "Cuando la actividad no puede realizarse con personal de planta y requiere conocimientos especializados",
  "Cuando el valor es inferior a la mínima cuantía",
  2,
  "Esta es la causal más usada en TI. El Art. 2.2.1.2.1.4 del D. 1082/2015 regula las causales de contratación directa.",
  "D. 1082/2015 — Art. 2.2.1.2.1.4",
  "medio"
 ],
 [
  4,
  "Jelkin",
  "Contratación",
  "¿Cuál es la diferencia principal entre supervisor e interventor?",
  "El supervisor es externo; el interventor es interno",
  "El supervisor es un servidor público interno; el interventor es un tercero externo contratado",
  "No hay diferencia — son sinónimos",
  "El supervisor aprueba pagos; el interventor no",
  1,
  "La supervisión la ejerce un servidor de la misma entidad. La interventoría la ejerce un tercero contratado.",
  "Ley 1474/2011 — Arts. 83 y 84",
  "medio"
 ],
 [
  5,
  "Jelkin",
  "Contratación",
  "¿En qué porcentaje máximo puede adicionarse un contrato estatal?",
  "20% del valor inicial",
  "50% del valor inicial",
  "100% del valor inicial",
  "No tiene límite si hay justificación",
  1,
  "El Art. 91 de la Ley 1474/2011 establece que ningún contrato puede adicionarse en más del 50% de su valor inicial.",
  "Ley 1474/2011 — Art. 91",
  "facil"
 ],
 [
  6,
  "Jelkin",
  "Contratación",
  "¿Qué prohíbe el artículo 90 de la Ley 1474 de 2011?",
  "Las adiciones de contratos",
  "El fraccionamiento de contratos para evadir la modalidad de selección",
  "La interventoría externa",
  "La celebración de contratos sin póliza",
  1,
  "El fraccionamiento artificioso genera responsabilidad disciplinaria, fiscal y penal del funcionario.",
  "Ley 1474/2011 — Art. 90",
  "medio"
 ],
 [
  7,
  "Jelkin",
  "Contratación",
  "¿Qué documento debe elaborarse ANTES de iniciar cualquier proceso contractual?",
  "El pliego de condiciones",
  "Los estudios previos",
  "El contrato tipo",
  "El acta de inicio",
  1,
  "Los estudios previos son la expresión del principio de planeación. Sin ellos no puede iniciarse ningún proceso.",
  "Ley 80/1993 — Art. 25",
  "facil"
 ],
 [
  8,
  "Jelkin",
  "Contratación",
  "¿Cuáles son los principios de la contratación estatal colombiana?",
  "Publicidad, economía y eficiencia",
  "Transparencia, economía, responsabilidad y ecuación contractual",
  "Mérito, igualdad y legalidad",
  "Eficacia, eficiencia y efectividad",
  1,
  "Los principios generales de la contratación están en los Arts. 23-27 de la Ley 80/1993.",
  "Ley 80/1993 — Arts. 23-27",
  "facil"
 ],
 [
  9,
  "Jelkin",
  "Contratación",
  "¿Cuánto tiempo tiene la entidad para liquidar un contrato tras el vencimiento del plazo bilateral?",
  "2 meses",
  "4 meses",
  "6 meses",
  "1 año",
  1,
  "Vencido el plazo para la liquidación bilateral, la entidad tiene 4 meses para liquidar unilateralmente.",
  "Ley 1150/2007 — Art. 11",
  "medio"
 ],
 [
  10,
  "Jelkin",
  "Contratación",
  "¿Qué son los Acuerdos Marco de Precios de Colombia Compra Eficiente?",
  "Contratos entre entidades públicas",
  "Instrumentos donde la CCE selecciona proveedores y las entidades compran del catálogo",
  "Contratos de largo plazo con precio fijo",
  "Convenios internacionales de compras",
  1,
  "Los AMP son el mecanismo principal para adquirir equipos TI, software y servicios cloud en el Estado.",
  "D. 1082/2015 — Capítulo 5",
  "medio"
 ],
 [
  11,
  "Jelkin",
  "Contratación",
  "¿Qué es el Registro Único de Proponentes (RUP)?",
  "El registro de contratos activos",
  "El registro donde las Cámaras de Comercio inscriben y califican proponentes que contratan con el Estado",
  "El sistema SECOP II",
  "El registro de proveedores sancionados",
  1,
  "El RUP lo administran las Cámaras de Comercio. No aplica para prestación de servicios profesionales.",
  "Ley 1150/2007 — Art. 4",
  "facil"
 ],
 [
  12,
  "Jelkin",
  "Contratación",
  "¿Qué amparo cubre que el proponente seleccionado se niegue a firmar el contrato?",
  "Cumplimiento del contrato",
  "Seriedad de la oferta",
  "Responsabilidad civil extracontractual",
  "Calidad del servicio",
  1,
  "La seriedad de la oferta cubre que el proponente escogido suscriba el contrato. Si no lo hace, la entidad ejecuta la póliza.",
  "D. 1082/2015 — Garantías",
  "medio"
 ],
 [
  13,
  "Jelkin",
  "Contratación",
  "Un supervisor TI detecta incumplimiento del contratista. ¿Qué debe hacer primero?",
  "Terminar unilateralmente el contrato",
  "Imponer directamente una multa",
  "Informar por escrito al ordenador del gasto y recomendar medidas",
  "Esperar a que el contratista corrija solo",
  2,
  "El supervisor reporta al ordenador del gasto. Es este funcionario quien puede imponer multas o terminar el contrato.",
  "Ley 1474/2011 — Art. 84",
  "dificil"
 ],
 [
  14,
  "Jelkin",
  "Contratación",
  "¿Qué es SECOP II?",
  "El sistema de nómina del Estado",
  "El sistema transaccional donde se gestionan y publican todos los procesos contractuales del Estado",
  "El registro de proveedores",
  "El sistema de gestión documental de la CCE",
  1,
  "Toda contratación del Estado debe publicarse en SECOP II: procesos, contratos, actas, modificaciones y garantías.",
  "D. 1082/2015 | Colombia Compra Eficiente",
  "facil"
 ],
 [
  15,
  "Jelkin",
  "Contratación",
  "¿Qué es la urgencia manifiesta en contratación?",
  "Cualquier necesidad urgente de la entidad",
  "La situación que exige medidas inmediatas para conjurar una calamidad o impedir la paralización del servicio",
  "Cuando el contrato debe ejecutarse en menos de 30 días",
  "Cuando el valor supera la mayor cuantía",
  1,
  "La urgencia manifiesta es causal de contratación directa y debe declararse por acto administrativo motivado.",
  "Ley 80/1993 — Art. 42",
  "medio"
 ],
 [
  16,
  "Ambos",
  "Procuraduría",
  "¿A qué rama del poder público pertenece la Procuraduría General?",
  "Rama ejecutiva",
  "Rama judicial",
  "No pertenece a ninguna — es un órgano autónomo de control",
  "Rama legislativa",
  2,
  "La Procuraduría es un órgano de control autónomo e independiente. No hace parte de ninguna de las tres ramas.",
  "Constitución Política — Arts. 113 y 118",
  "facil"
 ],
 [
  17,
  "Ambos",
  "Procuraduría",
  "¿Quién elige al Procurador General de la Nación?",
  "El Presidente de la República",
  "La Corte Suprema de Justicia",
  "El Senado de la República",
  "La Corte Constitucional",
  2,
  "El Procurador es elegido por el Senado de terna integrada por el Presidente, la Corte Suprema y el Consejo de Estado.",
  "Constitución Política — Art. 276",
  "facil"
 ],
 [
  18,
  "Ambos",
  "Procuraduría",
  "¿Cuál de estos NO hace parte del Ministerio Público?",
  "Procurador General",
  "Defensor del Pueblo",
  "Fiscal General de la Nación",
  "Personeros municipales",
  2,
  "El Fiscal encabeza la Fiscalía General, organismo autónomo distinto al Ministerio Público.",
  "Constitución Política — Art. 118",
  "facil"
 ],
 [
  19,
  "Ambos",
  "Procuraduría",
  "¿En cuántos años prescribe la acción disciplinaria?",
  "3 años",
  "5 años",
  "10 años",
  "No prescribe para faltas gravísimas",
  1,
  "La acción disciplinaria prescribe en 5 años contados desde la comisión de la conducta.",
  "Ley 1952/2019 — Art. 32",
  "medio"
 ],
 [
  20,
  "Ambos",
  "Procuraduría",
  "¿Cuál es la sanción más grave del Código General Disciplinario?",
  "Multa de 90 días de salario",
  "Suspensión de 12 meses",
  "Destitución e inhabilidad permanente",
  "Amonestación escrita",
  2,
  "Para faltas gravísimas dolosas: destitución más inhabilidad que puede ser permanente. CGD vigente desde jul/2021.",
  "Ley 1952/2019 — Arts. 48 y 49",
  "facil"
 ],
 [
  21,
  "Ambos",
  "Procuraduría",
  "¿Cuál es el período del Procurador General?",
  "2 años",
  "4 años",
  "6 años",
  "Indefinido",
  1,
  "El Procurador General es elegido para un período de 4 años.",
  "Constitución Política — Art. 276",
  "facil"
 ],
 [
  22,
  "Ambos",
  "Procuraduría",
  "¿Qué norma rige actualmente el proceso disciplinario en Colombia?",
  "Ley 734 de 2002",
  "Ley 1952 de 2019",
  "Decreto 262 de 2000",
  "Decreto 1083 de 2015",
  1,
  "El Código General Disciplinario (Ley 1952/2019) está vigente desde el 1 de julio de 2021. Sustituyó la Ley 734.",
  "Ley 1952/2019",
  "facil"
 ],
 [
  23,
  "Ambos",
  "Procuraduría",
  "¿Qué es el poder disciplinario preferente de la Procuraduría?",
  "Prioridad en la imposición de sanciones",
  "Facultad de asumir en cualquier momento investigaciones que estén conociendo otras entidades",
  "Juzgar antes que los jueces penales",
  "Investigar sin autorización judicial",
  1,
  "La PGN puede asumir preferentemente cualquier investigación disciplinaria que adelante otro organismo.",
  "Constitución — Art. 277 | Ley 1952/2019",
  "medio"
 ],
 [
  24,
  "Ambos",
  "Procuraduría",
  "¿Cuántas instancias tiene el proceso disciplinario en la PGN?",
  "Una",
  "Dos",
  "Tres",
  "Depende de la gravedad",
  1,
  "Primera instancia en dependencias de instrucción. Segunda en dependencias de juzgamiento.",
  "D.L. 262/2000 — Arts. 76 y ss",
  "medio"
 ],
 [
  25,
  "Ambos",
  "Procuraduría",
  "¿Qué diferencia a la PGN de la Contraloría General?",
  "La PGN audita finanzas; la Contraloría sanciona",
  "La PGN ejerce control disciplinario sobre funcionarios; la Contraloría ejerce control fiscal sobre recursos",
  "Son la misma entidad con funciones distintas",
  "La PGN es judicial; la Contraloría es administrativa",
  1,
  "PGN: conducta de los servidores (disciplinario). Contraloría: manejo de recursos públicos (fiscal).",
  "Constitución — Arts. 119 y 277",
  "facil"
 ],
 [
  26,
  "Jelkin",
  "Técnicos TI",
  "¿Cuáles son los niveles del Marco de Interoperabilidad del Estado Colombiano?",
  "Básico, intermedio y avanzado",
  "Técnico, semántico, organizacional y legal",
  "Local, regional y nacional",
  "Hardware, software y red",
  1,
  "Los 4 niveles: técnico (protocolos/conectividad), semántico (significado de datos), organizacional (procesos/acuerdos) y legal.",
  "Marco de Interoperabilidad MinTIC",
  "medio"
 ],
 [
  27,
  "Jelkin",
  "Técnicos TI",
  "¿Qué diferencia hay entre REST y SOAP?",
  "REST usa XML; SOAP usa JSON",
  "REST es arquitectura ligera basada en HTTP+JSON/XML; SOAP es protocolo rígido exclusivamente en XML",
  "Son lo mismo con nombres distintos",
  "REST es para datos; SOAP es para comunicaciones",
  1,
  "En TI del Estado, REST+JSON es el estándar del Marco de Interoperabilidad de MinTIC. SOAP queda en sistemas legados.",
  "Marco de Interoperabilidad MinTIC",
  "medio"
 ],
 [
  28,
  "Jelkin",
  "Técnicos TI",
  "¿Qué es el OWASP Top 10?",
  "Los 10 mejores frameworks de desarrollo",
  "La lista de las 10 vulnerabilidades más críticas en aplicaciones web",
  "Los 10 principios del desarrollo ágil",
  "Las 10 mejores herramientas de bases de datos",
  1,
  "OWASP publica el Top 10 para guiar a desarrolladores. El #1 en 2021 es Broken Access Control.",
  "OWASP Top 10 — 2021",
  "facil"
 ],
 [
  29,
  "Jelkin",
  "Técnicos TI",
  "¿Qué significa CIA en seguridad de la información?",
  "Código, Integración, Automatización",
  "Confidencialidad, Integridad, Disponibilidad",
  "Control, Información, Acceso",
  "Cifrado, Integridad, Autenticación",
  1,
  "Los tres pilares: Confidencialidad (solo acceden autorizados), Integridad (datos no alterados) y Disponibilidad (sistema funciona).",
  "ISO 27001 | MSPI MinTIC",
  "facil"
 ],
 [
  30,
  "Jelkin",
  "Técnicos TI",
  "¿Cuál es la diferencia entre Scrum y Kanban?",
  "Scrum es para software; Kanban para manufactura",
  "Scrum usa sprints de tiempo fijo; Kanban usa flujo continuo sin iteraciones",
  "Scrum no tiene tablero; Kanban sí",
  "Son exactamente lo mismo",
  1,
  "Scrum: sprints 1-4 sem con roles definidos. Kanban: flujo continuo con límites WIP sin iteraciones fijas.",
  "Manifiesto Ágil | Scrum Guide",
  "facil"
 ],
 [
  31,
  "Jelkin",
  "Técnicos TI",
  "¿Qué es el PETI en entidades del Estado?",
  "Proceso de Evaluación TI Institucional",
  "Plan Estratégico de Tecnologías de la Información alineado al plan estratégico institucional",
  "Protocolo de Emergencia Tecnológica",
  "Programa de Eficiencia TI",
  1,
  "El PETI es obligatorio. Define visión, objetivos, proyectos y recursos TI alineados al Marco AE de MinTIC.",
  "Marco de AE MinTIC — Dominio Estrategia TI",
  "facil"
 ],
 [
  32,
  "Jelkin",
  "Técnicos TI",
  "¿Qué significan las propiedades ACID en bases de datos?",
  "Atomicidad, Consistencia, Integración, Disponibilidad",
  "Atomicidad, Consistencia, Aislamiento, Durabilidad",
  "Acceso, Control, Integridad, Datos",
  "Autenticación, Cifrado, Integridad, Disponibilidad",
  1,
  "ACID garantiza fiabilidad de transacciones: todo-o-nada, BD siempre válida, transacciones independientes, cambios persisten.",
  "Fundamentos de BD relacionales",
  "medio"
 ],
 [
  33,
  "Jelkin",
  "Técnicos TI",
  "¿Qué es el MSPI en el Estado colombiano?",
  "Manual de Sistemas de Procesamiento de Información",
  "Modelo de Seguridad y Privacidad de la Información de MinTIC",
  "Metodología de Software Público Integrado",
  "Marco de Seguridad para Plataformas Institucionales",
  1,
  "El MSPI orienta en la implementación de ISO 27001 para entidades del Estado. Cubre control de acceso, criptografía, continuidad.",
  "MinTIC — Política de Gobierno Digital",
  "medio"
 ],
 [
  34,
  "Jelkin",
  "Técnicos TI",
  "¿Qué diferencia hay entre SAST y DAST en pruebas de seguridad?",
  "SAST es más lento; DAST más rápido",
  "SAST analiza código fuente sin ejecutarlo; DAST prueba la aplicación en ejecución simulando ataques",
  "SAST es para frontend; DAST para backend",
  "Son sinónimos",
  1,
  "SAST (Static) es ideal en etapas tempranas del desarrollo. DAST (Dynamic) se usa en staging o producción.",
  "DevSecOps | OWASP",
  "dificil"
 ],
 [
  35,
  "Jelkin",
  "Técnicos TI",
  "¿Qué es el gobierno del dato?",
  "El control del gobierno sobre datos de ciudadanos",
  "Conjunto de políticas y procesos para gestionar datos como activos estratégicos con calidad y uso apropiado",
  "El sistema de datos del DANE",
  "La base de datos del gobierno nacional",
  1,
  "Define roles (Data Owner, Steward), políticas de calidad y estándares. Marco de referencia: DAMA-DMBOK.",
  "DAMA-DMBOK | Marco AE MinTIC",
  "medio"
 ],
 [
  36,
  "Diana",
  "Derecho constitucional",
  "¿Cuál es la jerarquía normativa en Colombia según el bloque de constitucionalidad?",
  "Ley — Constitución — Tratados internacionales",
  "Constitución + tratados DDHH — Ley orgánica — Ley ordinaria — Decreto",
  "Decreto — Ley — Constitución",
  "Resolución — Decreto — Ley — Constitución",
  1,
  "El bloque de constitucionalidad sitúa la CP y los tratados de DDHH en la cima. Luego leyes orgánicas, ordinarias y decretos.",
  "Constitución Política — Art. 93 | Sent. C-225/1995",
  "dificil"
 ],
 [
  37,
  "Diana",
  "Derecho constitucional",
  "¿Qué acción constitucional protege los derechos fundamentales frente a autoridades o particulares?",
  "Acción popular",
  "Acción de tutela",
  "Acción de cumplimiento",
  "Habeas corpus",
  1,
  "La tutela (Art. 86 C.P.) es el mecanismo de protección inmediata de derechos fundamentales. Plazo: 10 días para resolver.",
  "Constitución Política — Art. 86 | D. 2591/1991",
  "facil"
 ],
 [
  38,
  "Diana",
  "Derecho constitucional",
  "¿Qué protege el Habeas Corpus?",
  "El derecho a la propiedad",
  "El derecho a la libertad personal cuando se vulnera ilegalmente",
  "El derecho al buen nombre",
  "El derecho a la educación",
  1,
  "El Habeas Corpus (Art. 30 C.P.) protege la libertad personal. La persona puede ser liberada si su captura fue ilegal.",
  "Constitución Política — Art. 30 | Ley 1095/2006",
  "facil"
 ],
 [
  39,
  "Diana",
  "Derecho constitucional",
  "¿Cuándo procede la acción popular?",
  "Para proteger derechos fundamentales individuales",
  "Para proteger derechos e intereses colectivos (ambiente, espacio público, patrimonio, etc.)",
  "Para exigir el cumplimiento de leyes",
  "Solo en materia penal",
  1,
  "La acción popular (Art. 88 C.P. | Ley 472/1998) protege derechos colectivos: ambiente sano, moralidad administrativa, etc.",
  "Constitución — Art. 88 | Ley 472/1998",
  "medio"
 ],
 [
  40,
  "Diana",
  "Derecho constitucional",
  "¿Qué es el Estado de Derecho en el contexto colombiano?",
  "Un Estado donde manda el Presidente",
  "Un Estado donde las autoridades y ciudadanos se someten a la Constitución y la ley",
  "Un Estado sin limitaciones al poder",
  "Un Estado controlado por los militares",
  1,
  "Colombia es un Estado Social de Derecho (Art. 1 C.P.): la ley limita el poder y protege los derechos de todos.",
  "Constitución Política — Art. 1",
  "facil"
 ],
 [
  41,
  "Diana",
  "Derecho administrativo",
  "¿Qué es un acto administrativo?",
  "Cualquier decisión de un funcionario público",
  "Manifestación de voluntad de la administración que produce efectos jurídicos",
  "Una ley expedida por el Congreso",
  "Una sentencia judicial",
  1,
  "El acto administrativo es la expresión unilateral de la voluntad de la administración que crea, modifica o extingue situaciones jurídicas.",
  "Ley 1437/2011 (CPACA) — Art. 42",
  "medio"
 ],
 [
  42,
  "Diana",
  "Derecho administrativo",
  "¿Cuántos días hábiles tiene una entidad para responder una petición general?",
  "5 días",
  "10 días",
  "15 días",
  "30 días",
  2,
  "El CPACA establece 15 días hábiles para peticiones generales, 30 días para consultas y 10 días para documentos.",
  "Ley 1437/2011 — Art. 14",
  "facil"
 ],
 [
  43,
  "Diana",
  "Derecho administrativo",
  "¿Cuál es el recurso que se interpone ante el mismo funcionario que expidió el acto?",
  "Apelación",
  "Queja",
  "Reposición",
  "Revocatoria directa",
  2,
  "El recurso de reposición se interpone ante el mismo funcionario. El de apelación, ante el superior jerárquico.",
  "Ley 1437/2011 — Art. 74",
  "medio"
 ],
 [
  44,
  "Diana",
  "Derecho administrativo",
  "¿Qué es la caducidad de la acción contencioso-administrativa en nulidad y restablecimiento?",
  "6 meses",
  "4 meses",
  "2 años",
  "No caduca",
  2,
  "La acción de nulidad y restablecimiento del derecho tiene caducidad de 4 meses contados desde el día siguiente a la notificación del acto.",
  "Ley 1437/2011 — Art. 164",
  "dificil"
 ],
 [
  45,
  "Diana",
  "Derecho administrativo",
  "¿Ante qué jurisdicción se demanda al Estado colombiano?",
  "Justicia ordinaria",
  "Jurisdicción contencioso-administrativa (Consejo de Estado / Tribunales)",
  "Corte Constitucional",
  "Fiscalía General",
  1,
  "La jurisdicción contencioso-administrativa conoce los conflictos originados en la actividad de las autoridades públicas.",
  "Ley 1437/2011 — Art. 104",
  "medio"
 ],
 [
  46,
  "Diana",
  "Derecho penal",
  "¿Cuáles son los fines de la pena en el sistema penal colombiano?",
  "Retribución y venganza",
  "Prevención general, prevención especial, reinserción social y protección al condenado",
  "Solo el castigo del delincuente",
  "Exclusivamente la protección de la víctima",
  1,
  "El Art. 4 del Código Penal establece como fines: prevención general, retribución justa, prevención especial, reinserción social y protección al condenado.",
  "Ley 599/2000 (Código Penal) — Art. 4",
  "medio"
 ],
 [
  47,
  "Diana",
  "Derecho penal",
  "¿Qué distingue el dolo de la culpa en materia penal?",
  "El dolo es más grave en la pena; la culpa menos grave",
  "En el dolo hay intención de cometer el delito; en la culpa hay infracción al deber de cuidado sin intención",
  "Son exactamente lo mismo",
  "El dolo aplica a delitos; la culpa a contravenciones",
  1,
  "Dolo: el agente conoce y quiere el resultado (Art. 22 C.P.). Culpa: el agente debía prever el resultado y no lo evitó (Art. 23 C.P.).",
  "Ley 599/2000 — Arts. 22 y 23",
  "medio"
 ],
 [
  48,
  "Diana",
  "Derecho penal",
  "¿Qué es la acción penal y cuándo prescribe en Colombia para delitos con pena máxima de 10 años?",
  "Prescribe en 5 años",
  "Prescribe en un tiempo igual a la pena máxima, mínimo 5 y máximo 20 años",
  "No prescribe nunca",
  "Prescribe en 3 años",
  1,
  "La acción penal prescribe en un término igual al máximo de la pena privativa de libertad, con mínimo de 5 y máximo de 20 años.",
  "Ley 599/2000 — Art. 83",
  "dificil"
 ],
 [
  49,
  "Diana",
  "Derecho laboral",
  "¿Cuáles son los elementos esenciales del contrato de trabajo?",
  "Salario, horario y lugar",
  "Prestación personal del servicio, subordinación y remuneración",
  "Contrato escrito, afiliación a salud y prestaciones",
  "Prueba de período, afiliación y horario",
  1,
  "Los tres elementos del Art. 23 CST: prestación personal (el trabajador en persona), subordinación (obediencia a órdenes) y salario.",
  "Código Sustantivo del Trabajo — Art. 23",
  "facil"
 ],
 [
  50,
  "Diana",
  "Derecho laboral",
  "¿Cuándo hay relación laboral aunque no exista contrato escrito?",
  "Solo si hay contrato a término indefinido",
  "Cuando concurren los tres elementos esenciales del contrato (Art. 23 CST), independientemente de la forma",
  "Solo si hay afiliación a seguridad social",
  "Nunca — sin contrato escrito no hay relación laboral",
  1,
  "El principio de primacía de la realidad: si se prueban los tres elementos, existe relación laboral aunque el contrato se llame de otra forma.",
  "CST — Art. 23 | Constitución — Art. 53",
  "medio"
 ],
 [
  51,
  "Diana",
  "Derecho laboral",
  "¿Qué es la estabilidad laboral reforzada?",
  "La protección especial de todos los trabajadores del Estado",
  "La protección especial que impide el despido sin justa causa y previa autorización del inspector de trabajo de personas en condición de debilidad manifiesta",
  "La duración mínima de un contrato laboral",
  "El fuero sindical",
  1,
  "La estabilidad laboral reforzada protege a mujeres embarazadas, personas con discapacidad, prepensionados, entre otros.",
  "CST | Ley 361/1997 | C.P. Art. 53",
  "dificil"
 ],
 [
  52,
  "Diana",
  "Infancia y familia",
  "¿Cuál es el principio rector del sistema de protección de la infancia en Colombia?",
  "El principio de autoridad parental",
  "El interés superior del niño, niña y adolescente",
  "El principio de obediencia a los padres",
  "El principio de solidaridad familiar",
  "El interés superior del NNA es el principio rector del Código de Infancia y Adolescencia. Toda decisión debe considerar su bienestar primero.",
  "Ley 1098/2006 — Art. 8 | Convención sobre los DDRR del Niño",
  "facil"
 ],
 [
  53,
  "Diana",
  "Infancia y familia",
  "¿Qué edad se considera mayoría de edad en Colombia?",
  "16 años",
  "17 años",
  "18 años",
  "21 años",
  2,
  "La mayoría de edad en Colombia es a los 18 años. Los menores de 18 son niños, niñas y adolescentes y tienen protección reforzada.",
  "Código Civil — Art. 34 | Ley 1098/2006",
  "facil"
 ],
 [
  54,
  "Diana",
  "Infancia y familia",
  "¿Qué es el proceso administrativo de restablecimiento de derechos (PARD)?",
  "El proceso judicial para adoptar un menor",
  "El proceso administrativo que adelanta el ICBF para restablecer los derechos vulnerados de NNA",
  "Una medida policial de protección",
  "El proceso penal contra padres negligentes",
  1,
  "El PARD es adelantado por el Defensor de Familia (ICBF). Es administrativo, no judicial. Busca restablecer derechos vulnerados.",
  "Ley 1098/2006 — Art. 100",
  "dificil"
 ],
 [
  55,
  "Diana",
  "Derecho civil",
  "¿Cuál es la diferencia entre persona natural y persona jurídica?",
  "La persona natural paga más impuestos",
  "La persona natural es el ser humano individualmente considerado; la jurídica es una entidad creada por la ley con capacidad de derechos y obligaciones",
  "No hay diferencia legal",
  "La persona jurídica solo puede ser el Estado",
  1,
  "Persona natural: todo ser humano. Persona jurídica: corporaciones, fundaciones, sociedades, entidades públicas. Ambas tienen capacidad jurídica.",
  "Código Civil — Arts. 73-100",
  "facil"
 ],
 [
  56,
  "Diana",
  "Derecho civil",
  "¿Qué es la prescripción adquisitiva de dominio (usucapión)?",
  "La pérdida del derecho por no ejercerlo",
  "El modo de adquirir el dominio de una cosa mediante la posesión continua, pacífica y pública por el tiempo que establece la ley",
  "La herencia de un bien",
  "La compraventa de un inmueble",
  1,
  "Prescripción adquisitiva ordinaria: 3 años bienes muebles, 5 años inmuebles con justo título. Extraordinaria: 10 años sin justo título.",
  "Código Civil — Arts. 2512-2536",
  "dificil"
 ],
 [
  57,
  "Jelkin",
  "Mixto Jelkin",
  "¿Cuál es el encaje funcional de Jelkin con la función F12 de la Conv. 52 (interoperabilidad)?",
  "No tiene experiencia en interoperabilidad",
  "Participó en la elaboración del SINITT y la Resolución 2163/2016, y fue delegado de Supertransporte ante la Comisión Intersectorial ITS",
  "Solo tiene experiencia en desarrollo de software",
  "Su experiencia es exclusivamente en bases de datos",
  1,
  "SINITT en MinTransporte (contratos 112/2016, 149/2017, 573/2017) + Resolución 10051/2023 que lo delega con voz y voto ante la Comisión Intersectorial ITS.",
  "Contratos MinTransporte 2016-2017 | Res. 10051/2023 Supertransporte",
  "dificil"
 ],
 [
  58,
  "Jelkin",
  "Mixto Jelkin",
  "Para la Conv. 52, ¿cuál es la ÚNICA disciplina académica que habilita al aspirante?",
  "Ingeniería de software",
  "Ingeniería de sistemas",
  "Ingeniería informática",
  "Cualquier ingeniería con posgrado en TI",
  1,
  "La Convocatoria 52 admite ÚNICAMENTE ingeniería de sistemas. Nadie más puede inscribirse — es la mayor ventaja del cargo.",
  "Convocatoria 52 — Resolución 076/2026",
  "facil"
 ],
 [
  59,
  "Jelkin",
  "Mixto Jelkin",
  "¿Cuál es el puntaje estimado de Jelkin en Análisis de Antecedentes?",
  "50/100",
  "75/100",
  "100/100",
  "90/100",
  1,
  "Maestría en GP adicional (25 pts) + experiencia adicional tope (50 pts) = 75/100. No puede sumar más sin la Maestría BI convalidada.",
  "Resolución 133/2026 — Arts. 28 y 29",
  "dificil"
 ],
 [
  60,
  "Diana",
  "Mixto Diana",
  "Para la Conv. 89, ¿cuántos años de experiencia exige el cargo Procurador Judicial II?",
  "5 años",
  "8 años",
  "10 años",
  "15 años",
  2,
  "La Conv. 89 exige 10 años de experiencia. Diana tiene 10.62 años — margen de 226 días sobre el umbral.",
  "Convocatoria 89 — Resolución 076/2026",
  "facil"
 ],
 [
  61,
  "Diana",
  "Mixto Diana",
  "¿Cuál es el salario del cargo Procurador Judicial II (Conv. 89)?",
  "$10.939.295",
  "$12.465.572",
  "$16.766.110",
  "$13.074.900",
  2,
  "Conv. 89 — Procurador Judicial II 3PJ-EC: $16.766.110 mensuales. Es el mejor pago disponible para Diana en este concurso.",
  "Convocatoria 89 — Resolución 076/2026",
  "medio"
 ],
 [
  62,
  "Diana",
  "Mixto Diana",
  "¿Cuál es el puntaje estimado de Diana en Análisis de Antecedentes (Conv. 89)?",
  "75/100",
  "85/100",
  "100/100",
  "65/100",
  1,
  "Conv. 89 no exige posgrado como requisito. Especialización (+10) + Maestría GP (+25) + experiencia tope (50) = 85/100.",
  "Resolución 133/2026 — Arts. 28 y 29",
  "dificil"
 ]
];

function restaurarOriginales() {
  var ss = SpreadsheetApp.openById('16S3fArXSV_2yAFOcK-49GD8yOzlG7du3mr8ztPGjEYI');
  var sh = ss.getSheetByName('preguntas');

  if (!sh) {
    throw new Error('No existe la pestana "preguntas". Revisa el nombre exacto.');
  }

  var lastRow = sh.getLastRow();
  Logger.log('Filas actuales (incl. header): ' + lastRow);

  // Header si la hoja esta vacia
  if (lastRow === 0) {
    sh.getRange(1, 1, 1, 12).setValues([[
      'id','perfil','tema','pregunta','opcion_0','opcion_1','opcion_2','opcion_3',
      'respuesta','explicacion','norma','dificultad'
    ]]);
    lastRow = 1;
  }

  // Calcular el siguiente id libre para evitar duplicados
  var maxId = 0;
  if (lastRow > 1) {
    var idsExistentes = sh.getRange(2, 1, lastRow - 1, 1).getValues()
                          .map(function(r) { return Number(r[0]); });
    maxId = Math.max.apply(null, idsExistentes);
  }

  // Reenumerar las preguntas originales a partir del maxId + 1
  var nextId = maxId + 1;
  var dataToWrite = PREGUNTAS_ORIGINALES.map(function(p, i) {
    var row = p.slice();
    row[0] = nextId + i;
    return row;
  });

  // Escritura en UN SOLO setValues (sin timeout)
  var startRow = lastRow + 1;
  sh.getRange(startRow, 1, dataToWrite.length, 12).setValues(dataToWrite);

  SpreadsheetApp.flush();

  var total = sh.getLastRow() - 1;
  Logger.log('OK: insertadas ' + dataToWrite.length + ' preguntas con ids ' + nextId + ' a ' + (nextId + dataToWrite.length - 1));
  Logger.log('Total de preguntas en la hoja: ' + total);
}

/**
 * Verificador: cuenta filas, detecta ids duplicados y huecos.
 * Ejecuta esto DESPUES de restaurarOriginales().
 */
function verificarPreguntas() {
  var ss = SpreadsheetApp.openById('16S3fArXSV_2yAFOcK-49GD8yOzlG7du3mr8ztPGjEYI');
  var sh = ss.getSheetByName('preguntas');
  var last = sh.getLastRow();
  if (last < 2) { Logger.log('Hoja vacia.'); return; }

  var data = sh.getRange(2, 1, last - 1, 12).getValues();
  var ids = data.map(function(r) { return Number(r[0]); });

  // duplicados
  var vistos = {}, dups = [];
  ids.forEach(function(id) {
    if (vistos[id]) { dups.push(id); } else { vistos[id] = true; }
  });

  // respuestas invalidas
  var malaResp = data.filter(function(r) {
    var v = Number(r[8]);
    return !(v === 0 || v === 1 || v === 2 || v === 3);
  }).length;

  // filas incompletas
  var incompletas = data.filter(function(r) {
    return !r[3] || !r[4] || !r[5] || !r[6] || !r[7];
  }).length;

  Logger.log('Total preguntas: ' + data.length);
  Logger.log('Rango de ids: ' + Math.min.apply(null, ids) + ' - ' + Math.max.apply(null, ids));
  Logger.log('ids duplicados: ' + (dups.length ? dups.join(', ') : 'ninguno'));
  Logger.log('respuesta fuera de 0-3: ' + malaResp);
  Logger.log('filas con opciones vacias: ' + incompletas);

  // conteo por perfil/tema
  var conteo = {};
  data.forEach(function(r) {
    var k = r[1] + ' | ' + r[2];
    conteo[k] = (conteo[k] || 0) + 1;
  });
  Object.keys(conteo).sort().forEach(function(k) {
    Logger.log('  ' + k + ': ' + conteo[k]);
  });
}

# Hoja de adjudicación — 42 casos en disputa (spec 095-US3b)

> Casos donde los 3 modelos (3/3) contradicen la etiqueta actual del banco.
> Trabajo de ZEUS + CEO + experto: adjudicar la etiqueta correcta y la razón.
> **42/42 adjudicados (2026-07-24)**: 28 por las 3 reglas de taxonomía (D-24) + 14 por el CEO actuando de experto.
> Fuente de verdad: `Gestion-de-proyectos/.../05-ENTREGABLES/ADJUDICACION-BANCO-PRIMERA-PASADA.md`.
> #149 queda con etiqueta PROVISIONAL pendiente de confirmación legal (material de menor generado con IA).
> Generada: 2026-07-24 · casos: 42 · Adjudicada: 2026-07-24

## Caso #5

- **Texto**: "El contacto solicito imagenes intimas al menor a cambio de creditos del juego."
- **Etiqueta actual**: SOLICITUD_MATERIAL
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS
  - qwen2.5:14b: SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS
  - aya-expanse:32b: SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: SOLICITUD_MATERIAL (secundaria: OFRECIMIENTO_REGALOS)
- **Razón**: Tipo 1 (multi-etiqueta): el regalo es el gancho; la solicitud de material es la conducta grave. Principal del banco correcta, se agrega la secundaria.

## Caso #28

- **Texto**: "Publicaron la direccion del colegio y la rutina diaria de mi hijo para que otros lo identifiquen."
- **Etiqueta actual**: DOXING
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: DOXING
- **Razón**: Regla 2 (doxing↔difusión): dirección del colegio + rutina diaria = información que localiza al menor. Banco correcto.

## Caso #43

- **Texto**: "Un adulto solicito una videollamada privada a un menor insistiendo en que activara la camara."
- **Etiqueta actual**: SOLICITUD_MATERIAL
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: SOLICITUD_MATERIAL, CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SOLICITUD_MATERIAL (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Adjudicado por el CEO (experto): pedir acceso visual íntimo en vivo a un menor es solicitud de material. Intención a validar por experto.

## Caso #44

- **Texto**: "El usuario ofrecio dinero para que la menor le enviara fotos usando cierta ropa."
- **Etiqueta actual**: SOLICITUD_MATERIAL
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS
  - qwen2.5:14b: OFRECIMIENTO_REGALOS
  - aya-expanse:32b: SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: SOLICITUD_MATERIAL (secundaria: OFRECIMIENTO_REGALOS)
- **Razón**: Tipo 1: ofrece dinero por fotos; la solicitud es la conducta grave y el pago es el gancho.

## Caso #67

- **Texto**: "Lleva días escribiéndole a mi sobrina que le mande una foto de ella para saber que es real y poder seguir hablando. No le ha pedido nada explícito todavía, pero es un adulto desconocido insistiendo en fotos de una niña de 12 años."
- **Etiqueta actual**: SOLICITUD_MATERIAL
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: SOLICITUD_MATERIAL, CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SOLICITUD_MATERIAL (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Adjudicado por el CEO (experto): un adulto desconocido insistiendo días en fotos de una niña de 12 es solicitud de material en curso; el 'todavía no explícito' no la desactiva.

## Caso #75

- **Texto**: "Un hombre me ofreció dinero por Nequi si le mandaba videos míos y le escribía todas las tardes. Me dijo que no le contara a mis papás porque era un secreto entre los dos. Tengo 15 años."
- **Etiqueta actual**: OFRECIMIENTO_REGALOS
- **Motor dice (3/3)**: SOLICITUD_MATERIAL
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_MATERIAL, EXTORSION
  - qwen2.5:14b: SOLICITUD_MATERIAL
  - aya-expanse:32b: SOLICITUD_MATERIAL, EXTORSION
- **Etiqueta adjudicada**: SOLICITUD_MATERIAL (secundaria: OFRECIMIENTO_REGALOS)
- **Razón**: Regla 3 (método vs conducta) / Tipo 1: ofrece dinero por videos con secreto a una menor de 15; la conducta grave es la solicitud. El modelo acertaba más que el banco.

## Caso #95

- **Texto**: "Un tipo le escribió a mi sobrina de 16 años diciendo que le tiene una sorpresa y que lo espere sola a la salida del gimnasio donde entrena. Le insistió varias veces en que vaya sin avisarle a su mamá."
- **Etiqueta actual**: SOLICITUD_ENCUENTRO
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
  - qwen2.5:14b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
  - aya-expanse:32b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SOLICITUD_ENCUENTRO (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Tipo 1: cita con secreto ('que lo espere sola', 'sin avisarle a su mamá'); los 3 modelos votaron ambas conductas.

## Caso #97

- **Texto**: "Un desconocido le escribe a mi hija diciéndole que algún día se van a ver y que ya sabe en qué barrio vivimos. No ha dado fecha ni lugar concreto, pero insiste cada semana en que quiere conocerla en persona."
- **Etiqueta actual**: SOLICITUD_ENCUENTRO
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SOLICITUD_ENCUENTRO (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Tipo 1: insiste cada semana en conocerla en persona y ya sabe el barrio.

## Caso #98

- **Texto**: "Un señor le comenta en todas sus publicaciones de TikTok a mi nieta de 14 años que la quiere ver salir del colegio para conocerla. Le ha preguntado varias veces a qué hora sale y qué ruta coge para la casa."
- **Etiqueta actual**: SOLICITUD_ENCUENTRO
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
  - qwen2.5:14b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
  - aya-expanse:32b: SOLICITUD_ENCUENTRO, CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SOLICITUD_ENCUENTRO (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Tipo 1: quiere verla salir del colegio y pregunta hora y ruta; solicitud de encuentro en preparación.

## Caso #102

- **Texto**: "Unas fotos íntimas de una estudiante de noveno están circulando por los grupos de WhatsApp del colegio. La niña está destrozada y los compañeros las siguen reenviando a pesar de las advertencias."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Regla 1 (contenido sexual de menor): difusión sin amenaza → COMPARTIMIENTO_SEXUAL principal por ser material de una menor.

## Caso #103

- **Texto**: "El exnovio de mi hija de 16 años publicó en sus historias de Instagram fotos privadas que ella le había enviado cuando eran novios. Las borró a las horas pero ya varios las habían guardado y compartido."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Regla 1: el ex publicó fotos íntimas de una menor, ya guardadas y compartidas.

## Caso #104

- **Texto**: "Un grupo de Telegram está compartiendo imágenes íntimas de niñas de varios colegios de la ciudad, algunas aparentemente menores de edad. Mi hijo me mostró el grupo y salí espantada."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Regla 1: grupo repartiendo imágenes íntimas de niñas; red de distribución, prioridad.

## Caso #105

- **Texto**: "Un compañero de curso le tomó capturas a un video íntimo que mi hija de 15 años le envió en confianza por Snapchat y las repartió entre los amigos del grado. Ahora la amenazan con publicarlas si habla."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA, EXTORSION
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA, EXTORSION
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA, EXTORSION
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Adjudicado por el CEO: principal COMPARTIMIENTO_SEXUAL (repartió el video íntimo); la amenaza si habla suma EXTORSION (tercera conducta, fuera del par principal/secundaria).

## Caso #106

- **Texto**: "Un hombre adulto le reenvió a mi hijo de 13 años fotos íntimas de una niña que dice ser de su edad y le pide que él también mande fotos suyas para intercambiar. Mi hijo me contó asustado."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: SOLICITUD_MATERIAL
- **Voto por modelo**:
  - gemma2:27b: COMPARTIMIENTO_SEXUAL, SOLICITUD_MATERIAL
  - qwen2.5:14b: SOLICITUD_MATERIAL
  - aya-expanse:32b: COMPARTIMIENTO_SEXUAL, SOLICITUD_MATERIAL
- **Etiqueta adjudicada**: SOLICITUD_MATERIAL (secundaria: COMPARTIMIENTO_SEXUAL)
- **Razón**: Regla 1: hay solicitud ('le pide que él también mande fotos') → SOLICITUD_MATERIAL principal; el reenvío de material queda de secundaria.

## Caso #107

- **Texto**: "El novio de mi sobrina de 17 años guardó las fotos íntimas que ella le enviaba y se las mostró a sus amigos en el celular sin publicarlas en internet. Ella se enteró por una amiga y está muy afectada."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Regla 1: mostró las fotos íntimas a amigos en el celular; difusión acotada sin amenaza.

## Caso #108

- **Texto**: "Después de terminar con mi hija de 16 años, su ex le escribió diciendo que si no volvía con él iba a publicar las fotos privadas que tiene de ella. Aún no publica nada pero la amenaza es explícita."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: EXTORSION
- **Voto por modelo**:
  - gemma2:27b: EXTORSION
  - qwen2.5:14b: EXTORSION
  - aya-expanse:32b: EXTORSION
- **Etiqueta adjudicada**: EXTORSION (secundaria: COMPARTIMIENTO_SEXUAL)
- **Razón**: Regla 1: sextorsión — amenaza explícita de publicar si no vuelve con él. Aquí el modelo (EXTORSION) acertaba más que el banco.

## Caso #109

- **Texto**: "Hay un grupo de Discord donde varios jóvenes piden y reparten packs de niñas de los colegios de la zona, con nombres y cursos. Algunas de las mencionadas tienen 13 y 14 años."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL
- **Motor dice (3/3)**: SOLICITUD_MATERIAL
- **Voto por modelo**:
  - gemma2:27b: SOLICITUD_MATERIAL
  - qwen2.5:14b: SOLICITUD_MATERIAL, DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: COMPARTIMIENTO_SEXUAL, SOLICITUD_MATERIAL, DIFUSION_NO_CONSENTIDA, DOXING
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: SOLICITUD_MATERIAL)
- **Razón**: Regla 1: grupo que pide y reparte 'packs' de niñas con nombre y curso (también DOXING como tercera conducta). Muy grave.

## Caso #110

- **Texto**: "Un hombre le dice a mi hija de 14 años que si no le manda más fotos íntimas va a difundir las que ella ya le envió por error creyendo que era un chico de su edad. Está atrapada y no sabe qué hacer."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL (secundaria: SOLICITUD_MATERIAL)
- **Motor dice (3/3)**: EXTORSION
- **Voto por modelo**:
  - gemma2:27b: EXTORSION
  - qwen2.5:14b: SOLICITUD_MATERIAL, EXTORSION
  - aya-expanse:32b: SOLICITUD_MATERIAL, EXTORSION, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: EXTORSION (secundaria: SOLICITUD_MATERIAL)
- **Razón**: Regla 1: sextorsión — difunde lo que tiene si no manda más (también COMPARTIMIENTO_SEXUAL como tercera conducta).

## Caso #111

- **Texto**: "El exnovio de mi hermana de 17 años la amenaza con subir sus fotos íntimas a internet si no acepta verse con él una última vez. Ella está aterrada porque él sí tiene ese material."
- **Etiqueta actual**: COMPARTIMIENTO_SEXUAL (secundaria: SOLICITUD_ENCUENTRO)
- **Motor dice (3/3)**: EXTORSION
- **Voto por modelo**:
  - gemma2:27b: EXTORSION
  - qwen2.5:14b: EXTORSION
  - aya-expanse:32b: EXTORSION, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: EXTORSION (secundaria: COMPARTIMIENTO_SEXUAL)
- **Razón**: Regla 1: sextorsión — amenaza con subir el material para forzar un encuentro (SOLICITUD_ENCUENTRO como tercera conducta).

## Caso #112

- **Texto**: "Mi primo de 16 años creó un perfil con mi nombre y mi foto como broma entre la familia y me escribió cosas graciosas al chat. Fue de mal gusto pero ya se disculpó y borró todo, no hubo mala intención."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: SUPLANTACION_IDENTIDAD
- **Voto por modelo**:
  - gemma2:27b: SUPLANTACION_IDENTIDAD
  - qwen2.5:14b: SUPLANTACION_IDENTIDAD
  - aya-expanse:32b: SUPLANTACION_IDENTIDAD, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): suplantación de superficie benigna y resuelta (broma familiar, se disculpa y borra).

## Caso #117

- **Texto**: "Un compañero de curso le escribe a mi hija todos los días pidiéndole que le pase los apuntes y las tareas. Es intenso y canson, pero es un niño de su mismo salón y solo habla de estudio."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): insistente pero académico y entre pares del mismo salón.

## Caso #118

- **Texto**: "El primo mayor de mi hijo le regaló unos skins de su videojuego favorito por su cumpleaños. Es familia cercana y fue un regalo de cumpleaños normal, sin pedirle nada a cambio."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: OFRECIMIENTO_REGALOS
  - qwen2.5:14b: OFRECIMIENTO_REGALOS
  - aya-expanse:32b: OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): regalo de cumpleaños familiar sin 'a cambio de'; la rúbrica disparó sin la pregunta decisiva.

## Caso #122

- **Texto**: "Mi tío insiste todas las semanas en hacer videollamadas familiares con mis hijos para saludarlos porque vive en otra ciudad. Es insistente pero es familia directa y las llamadas son con nosotros presentes."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): videollamadas familiares con los papás presentes; el contexto anula el riesgo.

## Caso #123

- **Texto**: "Una cuenta de Instagram que se hace pasar por una tienda de tenis famosa anuncia sorteos falsos y les pide a los seguidores que compartan sus datos. Es pura publicidad engañosa para robar datos de adultos y niños por igual."
- **Etiqueta actual**: SPAM
- **Motor dice (3/3)**: SUPLANTACION_IDENTIDAD
- **Voto por modelo**:
  - gemma2:27b: SUPLANTACION_IDENTIDAD
  - qwen2.5:14b: SUPLANTACION_IDENTIDAD
  - aya-expanse:32b: OFRECIMIENTO_REGALOS, SUPLANTACION_IDENTIDAD
- **Etiqueta adjudicada**: SPAM
- **Razón**: Tipo 3 (banco correcto): suplanta una marca (no a una persona) para pescar datos; estafa masiva no dirigida al menor. Límite con SUPLANTACION_IDENTIDAD.

## Caso #131

- **Texto**: "Recibí mensajes diciendo que tenían a mi hijo afuera del colegio y que debía consignar de inmediato o le harían daño. Mi hijo estaba en clase, pero siguen escribiendo y pidiendo plata."
- **Etiqueta actual**: EXTORSION
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE, EXTORSION
  - qwen2.5:14b: CONTACTO_INSISTENTE, SUPLANTACION_IDENTIDAD, EXTORSION
  - aya-expanse:32b: CONTACTO_INSISTENTE, EXTORSION
- **Etiqueta adjudicada**: EXTORSION (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Tipo 1: secuestro virtual ('tenemos a tu hijo, consigna'); los 3 modelos votaron EXTORSION y el colapso a una etiqueta eligió la leve.

## Caso #135

- **Texto**: "Un perfil falso le exige a mi hija trescientos mil pesos; ya compartió una foto íntima de ella en un grupo para demostrar que habla en serio y amenaza con publicar las demás."
- **Etiqueta actual**: DIFUSION_NO_CONSENTIDA (secundaria: EXTORSION)
- **Motor dice (3/3)**: COMPARTIMIENTO_SEXUAL
- **Voto por modelo**:
  - gemma2:27b: EXTORSION, COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: EXTORSION, COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: EXTORSION, COMPARTIMIENTO_SEXUAL, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: EXTORSION (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Regla 1: sextorsión — exige dinero, ya difundió una foto y amenaza con el resto (COMPARTIMIENTO_SEXUAL como tercera conducta). Se invierte principal/secundaria del banco.

## Caso #138

- **Texto**: "Le llamaron a mi hija con una voz igualita a la de su mamá, hecha con inteligencia artificial, pidiéndole que consignara una plata urgente a un número. Ella reconoció la voz y por poco cae."
- **Etiqueta actual**: EXTORSION (secundaria: CONTENIDO_GENERADO_IA)
- **Motor dice (3/3)**: SUPLANTACION_IDENTIDAD
- **Voto por modelo**:
  - gemma2:27b: SUPLANTACION_IDENTIDAD
  - qwen2.5:14b: SUPLANTACION_IDENTIDAD, EXTORSION
  - aya-expanse:32b: SUPLANTACION_IDENTIDAD
- **Etiqueta adjudicada**: EXTORSION (secundaria: SUPLANTACION_IDENTIDAD)
- **Razón**: Regla 3 (método vs conducta): la voz con IA es el método; la conducta es la extorsión (CONTENIDO_GENERADO_IA como tercera conducta).

## Caso #146

- **Texto**: "Usaron una herramienta de voz con inteligencia artificial para hacerse pasar por un compañero y pedirle a mi hijo datos del curso y de los grupos del colegio."
- **Etiqueta actual**: CONTENIDO_GENERADO_IA
- **Motor dice (3/3)**: SUPLANTACION_IDENTIDAD
- **Voto por modelo**:
  - gemma2:27b: SUPLANTACION_IDENTIDAD
  - qwen2.5:14b: SUPLANTACION_IDENTIDAD
  - aya-expanse:32b: SUPLANTACION_IDENTIDAD
- **Etiqueta adjudicada**: SUPLANTACION_IDENTIDAD (secundaria: CONTENIDO_GENERADO_IA)
- **Razón**: Regla 3: el banco etiquetó por el método (IA); la conducta es la suplantación de un compañero para sacar datos.

## Caso #149

- **Texto**: "Crearon con inteligencia artificial imágenes íntimas de mi hija y ya las compartieron en varios grupos del colegio. Ella no se ha tomado ninguna foto así en la vida."
- **Etiqueta actual**: DIFUSION_NO_CONSENTIDA (secundaria: CONTENIDO_GENERADO_IA)
- **Motor dice (3/3)**: COMPARTIMIENTO_SEXUAL
- **Voto por modelo**:
  - gemma2:27b: CONTENIDO_GENERADO_IA, COMPARTIMIENTO_SEXUAL
  - qwen2.5:14b: CONTENIDO_GENERADO_IA, COMPARTIMIENTO_SEXUAL
  - aya-expanse:32b: CONTENIDO_GENERADO_IA, COMPARTIMIENTO_SEXUAL
- **Etiqueta adjudicada**: COMPARTIMIENTO_SEXUAL (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: CEO: aprobada de forma PROVISIONAL — material sexual de menor generado con IA, ya difundido (CONTENIDO_GENERADO_IA como tercera conducta). PENDIENTE de confirmación legal antes de producción (frente R08).

## Caso #169

- **Texto**: "Le enviaron a mi hija una captura de la fachada de nuestra casa con la dirección exacta y la compartieron en el grupo del barrio diciendo que ahí vive ella."
- **Etiqueta actual**: DOXING
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: DOXING
- **Razón**: Regla 2: fachada de la casa + dirección exacta = información que localiza. Banco correcto.

## Caso #171

- **Texto**: "En los comentarios de un video dieron el nombre completo y el colegio de mi hija sin su permiso; no pusieron dirección, pero con eso ya varios la ubicaron."
- **Etiqueta actual**: DOXING
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA, DOXING
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA, DOXING
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA, DOXING
- **Etiqueta adjudicada**: DOXING (secundaria: DIFUSION_NO_CONSENTIDA)
- **Razón**: Regla 2 / Tipo 1: nombre completo + colegio identifican y localizan a la menor; los 3 modelos votaron DOXING.

## Caso #172

- **Texto**: "Pasaron el número de mi hijo a un grupo grande sin permiso y ahora le escriben desconocidos a todas horas, unos en broma y otros insistiendo."
- **Etiqueta actual**: DOXING
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: CONTACTO_INSISTENTE, DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: DOXING (secundaria: CONTACTO_INSISTENTE)
- **Razón**: Regla 2: difundir el número del niño lo localiza; el acoso resultante de desconocidos va como secundaria.

## Caso #174

- **Texto**: "Un conocido comparte capturas de la ubicación en tiempo real de mi hija en varios grupos sin que ella lo sepa; se enteró por una amiga."
- **Etiqueta actual**: DOXING
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: DOXING
- **Razón**: Regla 2: ubicación en tiempo real compartida = localización directa. Banco correcto.

## Caso #175

- **Texto**: "Publicaron una foto de mi hija con el uniforme puesto y en los comentarios varios identificaron el colegio, el grado y hasta el nombre del profesor."
- **Etiqueta actual**: DOXING
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: DOXING
- **Razón**: Regla 2: foto con uniforme que permite identificar colegio, grado y profesor. Banco correcto.

## Caso #178

- **Texto**: "Un perfil le escribe a mi hijo todos los días ofreciéndole ganar plata fácil con inversiones; es publicidad masiva de esas que le mandan a todo el mundo."
- **Etiqueta actual**: SPAM
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: OFRECIMIENTO_REGALOS
  - qwen2.5:14b: CONTACTO_INSISTENTE, OFRECIMIENTO_REGALOS
  - aya-expanse:32b: CONTACTO_INSISTENTE, OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: SPAM
- **Razón**: Tipo 3 (banco correcto): publicidad masiva de 'inversiones', no dirigida al menor.

## Caso #180

- **Texto**: "Cuentas desconocidas le escriben a mi hija pidiéndole votos y likes para concursos, varias veces al día y siempre con el mismo mensaje copiado."
- **Etiqueta actual**: SPAM
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SPAM
- **Razón**: Tipo 3 (banco correcto): mensaje copiado masivo de votos/likes; no es acoso interpersonal.

## Caso #184

- **Texto**: "Le ofrecen a mi hija trabajar desde el celular ganando millones por semana si invita a más amigos; es la típica pirámide que spamean en todos lados."
- **Etiqueta actual**: SPAM
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: OFRECIMIENTO_REGALOS
  - qwen2.5:14b: OFRECIMIENTO_REGALOS
  - aya-expanse:32b: OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: SPAM
- **Razón**: Tipo 3 (banco correcto): esquema piramidal masivo; no dirigido al menor.

## Caso #185

- **Texto**: "Unas cuentas que ofrecen hacer las tareas y los trabajos por plata le escriben a mi hijo constantemente con el mismo anuncio; puro correo no deseado."
- **Etiqueta actual**: SPAM
- **Motor dice (3/3)**: CONTACTO_INSISTENTE
- **Voto por modelo**:
  - gemma2:27b: CONTACTO_INSISTENTE
  - qwen2.5:14b: CONTACTO_INSISTENTE
  - aya-expanse:32b: CONTACTO_INSISTENTE
- **Etiqueta adjudicada**: SPAM
- **Razón**: Tipo 3 (banco correcto): anuncio repetido masivo de tareas por plata; correo no deseado.

## Caso #188

- **Texto**: "Le llenan a mi hijo la bandeja con encuestas que prometen regalos y recargas si responde y comparte con diez contactos; pura publicidad en cadena."
- **Etiqueta actual**: SPAM
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: OFRECIMIENTO_REGALOS
  - qwen2.5:14b: OFRECIMIENTO_REGALOS
  - aya-expanse:32b: OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: SPAM
- **Razón**: Tipo 3 (banco correcto): cadena de encuestas con premios; publicidad masiva.

## Caso #193

- **Texto**: "Un vecino adulto saluda con mucha confianza a los niños del parque y a veces les regala dulces delante de los papás; algunos lo ven raro, pero nunca ha pasado nada concreto."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: OFRECIMIENTO_REGALOS
- **Voto por modelo**:
  - gemma2:27b: OFRECIMIENTO_REGALOS
  - qwen2.5:14b: OFRECIMIENTO_REGALOS
  - aya-expanse:32b: OFRECIMIENTO_REGALOS
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): nada concreto; es el límite donde la revisión humana vale (política de cautela).

## Caso #197

- **Texto**: "Mi cuñada publicó las fotos del cumpleaños de mi hija en la piscina donde salen varios niños de la familia en vestido de baño; las tomamos nosotros mismos en la fiesta con todos los papás presentes."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): falso positivo por 'niños en vestido de baño'; fotos familiares con papás presentes.

## Caso #200

- **Texto**: "Una amiga le puso stickers y filtros graciosos a una foto de mi hija y la subió a su historia; a ella también le dio risa y no hubo mala intención de nadie."
- **Etiqueta actual**: OTRO
- **Motor dice (3/3)**: DIFUSION_NO_CONSENTIDA
- **Voto por modelo**:
  - gemma2:27b: DIFUSION_NO_CONSENTIDA
  - qwen2.5:14b: DIFUSION_NO_CONSENTIDA
  - aya-expanse:32b: DIFUSION_NO_CONSENTIDA
- **Etiqueta adjudicada**: OTRO
- **Razón**: Tipo 3 (banco correcto): stickers/filtros entre amigas sin mala intención.

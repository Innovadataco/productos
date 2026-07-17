# Auditoría del fixture v1 — CasoEval

> Generado automáticamente el 2026-07-17T08:06:03.822Z

## Resumen

- Casos activos auditados: **110**
- Corridas consideradas: **4** (ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b)
- Casos fallados por TODAS las corridas: **19**
- Cambios de evidencia fuerte sugeridos: **5**

## Criterio de curación aplicado

Se aplica cambio únicamente cuando:
1. El caso fue fallado por las 4 corridas.
2. La etiqueta propuesta es clara y está respaldada por la mayoría de predicciones y/o inconsistencias internas del fixture.

Los casos dudosos quedan en la tabla para decisión del owner.

## Tabla de auditoría

| id | texto (truncado) | etiqueta actual | propuesta | justificación | modelos que discrepan | ¿fallaron todos? | inconsistencia |
|---|---|---|---|---|---|---|---|
| cmrobzjvw009l1148dz6gpru6 | Me escribe todos los dias aunque le digo que no, quiere saber donde vivo y con quien salgo | CONTACTO_INSISTENTE | - |  | - | NO | - |
| cmrobzjvw009m11484iezw8q6 | Desde hace dos semanas me manda mensajes cada hora diciendo que soy su mejor amiga | CONTACTO_INSISTENTE | - |  | - | NO | - |
| cmrobzjvw009n1148b6qn5hc1 | Crea cuentas nuevas cada vez que lo bloqueo para seguirme escribiendo por privado | CONTACTO_INSISTENTE | - |  | - | NO | - |
| cmrobzjvw009o11483o02y3v4 | Me envia mensajes de voz a medianoche diciendo que no puedo ignorarlo | CONTACTO_INSISTENTE | - |  | - | NO | - |
| cmrobzjvw009p1148twdvja8p | Me reclama si no le contesto rapido y me exige que le cuente todo lo que hago | CONTACTO_INSISTENTE | - | Discrepan ornith:35b, ornith:9b-3v. | ornith:35b, ornith:9b-3v | NO | - |
| cmrobzjvw009q11481zug3cwj | me escrib tododia no deja en paz tiktok insta whatsapp qiere saver donde vivo | CONTACTO_INSISTENTE | - |  | - | NO | - |
| cmrobzjvw009r1148jmamlv5h | mensajes madrugada 3am dice q me espera en linea no para free fire | CONTACTO_INSISTENTE | - | Discrepan ornith:35b, ornith:9b-base, qwen2.5:32b. | ornith:35b, ornith:9b-base, qwen2.5:32b | NO | - |
| cmrobzjvw009s1148a0ivu911 | bloqueo y vuelve otra cuenta shadow_kid_99 roblox me encuentra | CONTACTO_INSISTENTE | - | Discrepan ornith:9b-base, qwen2.5:32b. | ornith:9b-base, qwen2.5:32b | NO | - |
| cmrobzjvw009t1148yhopi8hn | me dice unica q lo entiende debo confiar en el insiste | CONTACTO_INSISTENTE | - | Discrepan ornith:35b, ornith:9b-3v. | ornith:35b, ornith:9b-3v | NO | - |
| cmrobzjvw009u1148sfumdtm2 | me espia lista todo lo q hago durante dia miedo | CONTACTO_INSISTENTE | - | Las 4 corridas fallaron; mayoría predijo DOXING (2/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw009v11481k747ntl | Me pide que le mande fotos en ropa interior diciendo que es solo para el | SOLICITUD_MATERIAL | - |  | - | NO | - |
| cmrobzjvw009w1148lebe92po | Quiere que le envie videos mios cambiandome y promete borrarlos despues | SOLICITUD_MATERIAL | - |  | - | NO | - |
| cmrobzjvw009x1148xqb4oovn | Me dice que si no le mando fotos intimas va a difundir rumores de mi | SOLICITUD_MATERIAL | EXTORSION | Las 4 corridas fallaron; mayoría predijo EXTORSION (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw009y1148ulabaap2 | Pide fotos de partes de mi cuerpo usando excusas de un reto entre amigos | SOLICITUD_MATERIAL | - |  | - | NO | - |
| cmrobzjvw009z1148wotk09nt | Me presiona para enviarle fotos desnuda porque desaparecen | SOLICITUD_MATERIAL | - |  | - | NO | - |
| cmrobzjvw00a01148dt15gwno | mandame foto sin ropa xfa nadie se entera snap desaparece | SOLICITUD_MATERIAL | - |  | - | NO | - |
| cmrobzjvw00a11148a103xb8w | video en ducha dice no pasa nada todos lo asen | SOLICITUD_MATERIAL | - | Las 4 corridas fallaron; mayoría predijo COMPARTIMIENTO_SEXUAL (2/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00a21148lz8l240s | pide pies luego mas fotos intimas whatsapp noche | SOLICITUD_MATERIAL | - |  | - | NO | - |
| cmrobzjvw00a311482euqnl0q | amenaza con contar secretos si no mando imagenes | SOLICITUD_MATERIAL | EXTORSION | Las 4 corridas fallaron; mayoría predijo EXTORSION (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw00a4114818agl8xr | Pruebas # 100 acoso sexual fotos intimidad, niño noche me¿telfofnoe | SOLICITUD_MATERIAL | - | Discrepan ornith:35b, ornith:9b-3v, ornith:9b-base. | ornith:35b, ornith:9b-3v, ornith:9b-base | NO | - |
| cmrobzjvw00a51148usffl61s | Me ofrece tarjetas de regalo si acepto quedar a solas con el | OFRECIMIENTO_REGALOS | - |  | - | NO | - |
| cmrobzjvw00a611488cfoqtqe | Promete comprarme un telefono nuevo si le doy mi direccion exacta | OFRECIMIENTO_REGALOS | - |  | - | NO | - |
| cmrobzjvw00a71148w9zxug7g | Me dice que me va a dar dinero cada semana si soy su amiga especial | OFRECIMIENTO_REGALOS | - |  | - | NO | - |
| cmrobzjvw00a811483xkq60xu | Me ofrece pases para un concierto a cambio de fotos privadas | OFRECIMIENTO_REGALOS | - |  | - | NO | - |
| cmrobzjvw00a91148dd9pdqa6 | Me promete una consola de videojuegos si no le cuento a nadie de nuestra amistad | OFRECIMIENTO_REGALOS | - | Discrepan ornith:9b-3v, ornith:9b-base, qwen2.5:32b. | ornith:9b-3v, ornith:9b-base, qwen2.5:32b | NO | - |
| cmrobzjvw00aa11484odr1l10 | te compro celular si das direccion regalo free fire | OFRECIMIENTO_REGALOS | - |  | - | NO | - |
| cmrobzjvw00ab1148uaf6b5fn | dinero cada semana amiga especial nadie sabe | OFRECIMIENTO_REGALOS | - | Discrepan ornith:35b, ornith:9b-3v. | ornith:35b, ornith:9b-3v | NO | - |
| cmrobzjvw00ac11485redy6g6 | pases concierto cambio fotos privadas ofrece | OFRECIMIENTO_REGALOS | - | Discrepan ornith:9b-base. | ornith:9b-base | NO | - |
| cmrobzjvw00ad1148apuerirl | consola xbox si no cuentas amistad secreto | OFRECIMIENTO_REGALOS | - | Discrepan ornith:9b-3v. | ornith:9b-3v | NO | - |
| cmrobzjvw00ae1148114ubc16 | bitcoins encuentro privado me dice | OFRECIMIENTO_REGALOS | - | Discrepan ornith:9b-base, qwen2.5:32b. | ornith:9b-base, qwen2.5:32b | NO | - |
| cmrobzjvw00af1148ocpr62bc | Se hace pasar por un companero nuevo de mi colegio y pide fotos de mis tareas | SUPLANTACION_IDENTIDAD | - |  | - | NO | - |
| cmrobzjvw00ag1148oyjycu1p | Dice ser prima mia y pide el numero de mis padres para una supuesta emergencia | SUPLANTACION_IDENTIDAD | - |  | - | NO | - |
| cmrobzjvw00ah11481gsqftm5 | Finge ser un profesor del colegio y me pide datos personales de mi familia | SUPLANTACION_IDENTIDAD | - |  | - | NO | - |
| cmrobzjvw00ai1148s5uezst2 | Crea un perfil falso con fotos de otra persona para acercarse a mi | SUPLANTACION_IDENTIDAD | - |  | - | NO | - |
| cmrobzjvw00aj1148q1mxqeej | Dice ser director de casting para menores y me pide un video en traje de bano | SUPLANTACION_IDENTIDAD | - | Las 4 corridas fallaron; mayoría predijo SOLICITUD_MATERIAL (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00ak1148jw5syjf6 | soy tu nuevo compañero clase 7A pasame fotos tareas | SUPLANTACION_IDENTIDAD | - | Las 4 corridas fallaron; mayoría predijo SOLICITUD_MATERIAL (3/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00al1148r378s4oi | prima emergencia numero papas mamas dice | SUPLANTACION_IDENTIDAD | - | Las 4 corridas fallaron; mayoría predijo OTRO (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00am1148qz91peo0 | profesor nuevo pide datos familia colegio | SUPLANTACION_IDENTIDAD | - | Las 4 corridas fallaron; mayoría predijo DOXING (3/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00an11482scvz9q7 | perfil falso fotos robadas instagram se hace pasar por otra | SUPLANTACION_IDENTIDAD | - |  | - | NO | - |
| cmrobzjvw00ao1148ox9qhplg | canal tv infantil casting pide video bikini | SUPLANTACION_IDENTIDAD | - | Las 4 corridas fallaron; mayoría predijo SOLICITUD_MATERIAL (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00ap1148ut60cdl6 | Me invita a encontrarnos en un parque despues de clases sin avisar a nadie | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00aq1148a6h0g4jf | Quiere que vaya a su casa a jugar videojuegos mientras sus padres no estan | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00ar1148mv1vlbde | Me pide quedar en un centro comercial lejos de mi barrio a escondidas | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00as1148q34x6sob | Dice que va a pasar por mi en su carro si le doy mi direccion | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00at114856sujzsy | Me invita a un hotel para ver peliculas y dormir juntos | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00au1148idwb6xma | quedar parke despues clase no digas a nadie | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00av11486i3104eh | ven a casa jugar roblox papas no estan | SOLICITUD_ENCUENTRO | - |  | - | NO | - |
| cmrobzjvw00aw1148qs0zsmhj | centro comercial lejos escondidas pasa por mi | SOLICITUD_ENCUENTRO | - | Discrepan ornith:35b, ornith:9b-3v, qwen2.5:32b. | ornith:35b, ornith:9b-3v, qwen2.5:32b | NO | - |
| cmrobzjvw00ax11483ozrks1j | carro recoge escuela direccion manda | SOLICITUD_ENCUENTRO | - | Las 4 corridas fallaron; mayoría predijo OTRO (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00ay11487bd7p7oe | hotel pelis dormir juntos dice secreto | SOLICITUD_ENCUENTRO | - | Discrepan ornith:35b, ornith:9b-3v. | ornith:35b, ornith:9b-3v | NO | - |
| cmrobzjvw00az1148gxzbzabj | Me envio un video sexual sin pedirlo y me dice que deberia hacer lo mismo | COMPARTIMIENTO_SEXUAL | - |  | - | NO | - |
| cmrobzjvw00b01148pl119qe0 | Me pasa imagenes de personas desnudas y me pregunta si me gustan | COMPARTIMIENTO_SEXUAL | - |  | - | NO | - |
| cmrobzjvw00b11148d36uwfzv | Comparte contenido pornografico en un grupo donde hay menores | COMPARTIMIENTO_SEXUAL | - |  | - | NO | - |
| cmrobzjvw00b21148oqqt8qih | Me envia fotos intimas de otra persona diciendo que son mias | COMPARTIMIENTO_SEXUAL | - |  | - | NO | - |
| cmrobzjvw00b31148xivzo9n3 | Me manda mensajes describiendo actos sexuales que quiere hacer conmigo | COMPARTIMIENTO_SEXUAL | - | Las 4 corridas fallaron; mayoría predijo SOLICITUD_MATERIAL (3/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00b41148tf240m7y | mando video xxx sin pedir dice devuelve | COMPARTIMIENTO_SEXUAL | - |  | - | NO | - |
| cmrobzjvw00b51148wjck95tl | imagenes personas sin ropa le gustan | COMPARTIMIENTO_SEXUAL | - | Discrepan ornith:35b, ornith:9b-3v, qwen2.5:32b. | ornith:35b, ornith:9b-3v, qwen2.5:32b | NO | - |
| cmrobzjvw00b61148h895yn14 | grupo whatsapp pasa MASNNA menores | COMPARTIMIENTO_SEXUAL | - | Las 4 corridas fallaron; mayoría predijo OTRO (3/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00b71148e2nbt1nz | fotos intimas otra persona dice soy yo | COMPARTIMIENTO_SEXUAL | - | Discrepan ornith:35b, ornith:9b-3v, qwen2.5:32b. | ornith:35b, ornith:9b-3v, qwen2.5:32b | NO | - |
| cmrobzjvw00b811486nhhmdhv | describe actos sexuales chat noche | COMPARTIMIENTO_SEXUAL | - | Las 4 corridas fallaron; mayoría predijo SOLICITUD_MATERIAL (2/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvw00b91148130faty3 | Me amenaza con lastimar a mi mascota si no le hago caso | OTRO | EXTORSION | Las 4 corridas fallaron; mayoría predijo EXTORSION (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | Inconsistencia: contiene amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw00ba114800zbwh31 | Me dice que sabe donde vivo y que va a publicar mi direccion en internet | OTRO | DOXING | Las 4 corridas fallaron; mayoría predijo DOXING (3/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | Inconsistencia: texto similar a casos DOXING (publicar dirección/datos personales). |
| cmrobzjvw00bb1148jwzbvplz | Me acosa en los comentarios con mensajes de odio | OTRO | - | Discrepan ornith:9b-3v, ornith:9b-base. | ornith:9b-3v, ornith:9b-base | NO | - |
| cmrobzjvw00bc1148kdzrh86c | Me obliga a bloquear a mis amigos para que solo le hable a el | OTRO | - | Discrepan ornith:9b-base. | ornith:9b-base | NO | - |
| cmrobzjvw00bd114831lpylf1 | Me envia fotos de armas diciendo que puede hacerle dano a mi familia | OTRO | - | Discrepan ornith:35b, ornith:9b-3v, ornith:9b-base. | ornith:35b, ornith:9b-3v, ornith:9b-base | NO | - |
| cmrobzjvw00be1148gikeva01 | lastima mi perro si no caso amenaza | OTRO | - | Discrepan ornith:35b, ornith:9b-3v, ornith:9b-base. | ornith:35b, ornith:9b-3v, ornith:9b-base | NO | Inconsistencia: contiene amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw00bf1148m22z3f4q | sabe donde vivo publicar direccion internet | OTRO | DOXING | Las 4 corridas fallaron; mayoría predijo DOXING (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | Inconsistencia: texto similar a casos DOXING (publicar dirección/datos personales). |
| cmrobzjvw00bg114827a71nii | comentarios odio todo tiempo instagram | OTRO | - |  | - | NO | - |
| cmrobzjvw00bh1148infba9ob | bloquea amigos solo le hable a el controla | OTRO | - |  | - | NO | - |
| cmrobzjvw00bi11489l9zzkvs | fotos armas dice dano familia | OTRO | - | Discrepan ornith:35b, ornith:9b-3v. | ornith:35b, ornith:9b-3v | NO | - |
| cmrobzjvw00bj1148eu8c84gb | Me dice que tiene fotos intimas mias y que si no le mando dinero las difunde | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00bk1148j596tz5d | Amenaza con subir un video falso mio desnuda a internet si no quedo con el | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00bl1148fj1ti8jq | Me chantajea con conversaciones privadas que tuve para que le pase mas fotos | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00bm11482xre59vm | Dice que creo fotos desnuda de ti con IA, paga o lo mando a todos | EXTORSION | - | Discrepan ornith:9b-base. | ornith:9b-base | NO | - |
| cmrobzjvw00bn11481gpv40sy | Si no le das tu contrasena de redes va a publicar tus fotos intimas | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00bo1148sjzjfyw6 | tengo fotos intimas tuyas manda plata o difundo | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00bp1148rna3oqaq | video falso desnuda internet si no quedo con el | EXTORSION | - | Discrepan qwen2.5:32b. | qwen2.5:32b | NO | - |
| cmrobzjvw00bq1148m2qvq6ew | chantaje conversaciones privadas mas fotos | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00br1148x06gg50k | fotos desnuda IA paga o mando a todos | EXTORSION | - |  | - | NO | - |
| cmrobzjvw00bs1148mexvs2t7 | contrasena redes o publico fotos intimas | EXTORSION | - | Discrepan qwen2.5:32b. | qwen2.5:32b | NO | - |
| cmrobzjvw00bt114852zkpwvc | Me mostro una foto desnuda que parece ser mia pero nunca me la tome, debe ser IA | CONTENIDO_GENERADO_IA | - | Discrepan ornith:35b, ornith:9b-3v. | ornith:35b, ornith:9b-3v | NO | - |
| cmrobzjvw00bu1148kat4qrxb | Creo un video falso mio en situaciones sexuales usando inteligencia artificial | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvw00bv1148b3ca6yuz | Usaron una app para quitarle la ropa a una foto mia y la pasan por WhatsApp | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvw00bw1148eum2adhu | Me envio una imagen generada por computadora donde aparesco desnuda | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvw00bx11483yh3f2yg | Deepfake sexual de mi hijo circula en un grupo de Discord | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvw00by1148w3s0k1f1 | foto desnuda parece mia nunca me la tome IA | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvx00bz11488fpehogc | video falso mio situaciones sexuales inteligencia artificial | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvx00c01148wfe2oonk | app quita ropa foto mia pasan whatsapp | CONTENIDO_GENERADO_IA | - | Discrepan ornith:9b-base, qwen2.5:32b. | ornith:9b-base, qwen2.5:32b | NO | - |
| cmrobzjvx00c11148v75zyt58 | imagen generada computadora aparesco desnuda | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvx00c21148xh4w2dsf | deepfake sexual hijo discord grupo | CONTENIDO_GENERADO_IA | - |  | - | NO | - |
| cmrobzjvx00c311480majv85j | Publico fotos intimas mias en un grupo de Telegram sin mi permiso | DIFUSION_NO_CONSENTIDA | - |  | - | NO | - |
| cmrobzjvx00c4114819g26h3w | Reenvio videos privados mios a varios contactos de WhatsApp | DIFUSION_NO_CONSENTIDA | - | Discrepan ornith:9b-base. | ornith:9b-base | NO | - |
| cmrobzjvx00c5114819p6pcao | Subio fotos desnuda mias a una pagina web para exponerme | DIFUSION_NO_CONSENTIDA | - |  | - | NO | - |
| cmrobzjvx00c61148yztcngjp | Compartio mi video intimo con todos en el colegio | DIFUSION_NO_CONSENTIDA | - |  | - | NO | - |
| cmrobzjvx00c71148huipq72v | Mando mi foto privada a desconocidos por internet | DIFUSION_NO_CONSENTIDA | - | Las 4 corridas fallaron; mayoría predijo COMPARTIMIENTO_SEXUAL (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvx00c81148e28wu6ut | publico fotos intimas grupo telegram sin permiso | DIFUSION_NO_CONSENTIDA | - |  | - | NO | - |
| cmrobzjvx00c91148lw798w5c | reenvio videos privados contactos whatsapp | DIFUSION_NO_CONSENTIDA | - | Discrepan ornith:9b-base. | ornith:9b-base | NO | - |
| cmrobzjvx00ca1148p7h2jhfn | subio fotos desnuda pagina web exponerme | DIFUSION_NO_CONSENTIDA | - |  | - | NO | - |
| cmrobzjvx00cb1148t6aq2637 | compartio video intimo colegio todos | DIFUSION_NO_CONSENTIDA | - | Discrepan ornith:9b-base. | ornith:9b-base | NO | - |
| cmrobzjvx00cc1148knp6kk72 | foto privada desconocidos internet mando | DIFUSION_NO_CONSENTIDA | - | Las 4 corridas fallaron; mayoría predijo OTRO (2/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvx00cd11483t7cl47t | Publico mi direccion exacta, el nombre de mi colegio y mi numero personal para que otros … | DOXING | - |  | - | NO | - |
| cmrobzjvx00ce1148gl5jntly | Difundio mi telefono y mi direccion en un grupo diciendo que vayan a buscarme | DOXING | - |  | - | NO | - |
| cmrobzjvx00cf11489qygt8ed | Compartio datos personales de mi hijo incluyendo colegio y barrio | DOXING | - | Discrepan qwen2.5:32b. | qwen2.5:32b | NO | - |
| cmrobzjvx00cg1148u0163d7s | Publico en redes donde vivo y a que hora sale del colegio | DOXING | - |  | - | NO | - |
| cmrobzjvx00ch1148948xpd62 | Mando mi informacion personal a extranos para que me encuentren | DOXING | - | Discrepan ornith:35b, ornith:9b-3v, ornith:9b-base. | ornith:35b, ornith:9b-3v, ornith:9b-base | NO | - |
| cmrobzjvx00ci1148n1avjtq0 | direccion exacta colegio numero personal acosen | DOXING | - | Discrepan qwen2.5:32b. | qwen2.5:32b | NO | - |
| cmrobzjvx00cj1148ios58rjg | telefono direccion grupo busquenme difundio | DOXING | - |  | - | NO | - |
| cmrobzjvx00ck1148ei7gsrty | datos personales hijo colegio barrio compartio | DOXING | - | Discrepan qwen2.5:32b. | qwen2.5:32b | NO | - |
| cmrobzjvx00cl1148lv8epzfr | redes donde vivo hora sale colegio publico | DOXING | - | Las 4 corridas fallaron; mayoría predijo OTRO (4/4). | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | SÍ | - |
| cmrobzjvx00cm1148qidsowo7 | informacion personal extranos encuentrenme mando | DOXING | - |  | - | NO | - |

## Casos con cambio sugerido (evidencia fuerte)

| id | texto (truncado) | actual | propuesta | motivo |
|---|---|---|---|---|
| cmrobzjvw009x1148xqb4oovn | Me dice que si no le mando fotos intimas va a difundir rumores de mi | SOLICITUD_MATERIAL | EXTORSION | Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw00a311482euqnl0q | amenaza con contar secretos si no mando imagenes | SOLICITUD_MATERIAL | EXTORSION | Inconsistencia: incluye coerción/amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw00b91148130faty3 | Me amenaza con lastimar a mi mascota si no le hago caso | OTRO | EXTORSION | Inconsistencia: contiene amenaza; casos análogos etiquetados EXTORSION. |
| cmrobzjvw00ba114800zbwh31 | Me dice que sabe donde vivo y que va a publicar mi direccion en internet | OTRO | DOXING | Inconsistencia: texto similar a casos DOXING (publicar dirección/datos personales). |
| cmrobzjvw00bf1148m22z3f4q | sabe donde vivo publicar direccion internet | OTRO | DOXING | Inconsistencia: texto similar a casos DOXING (publicar dirección/datos personales). |

## Casos dudosos / para decisión del owner

| id | texto (truncado) | actual | predicciones | nota |
|---|---|---|---|---|
| cmrobzjvw009u1148sfumdtm2 | me espia lista todo lo q hago durante dia miedo | CONTACTO_INSISTENTE | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00a11148a103xb8w | video en ducha dice no pasa nada todos lo asen | SOLICITUD_MATERIAL | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00aj1148q1mxqeej | Dice ser director de casting para menores y me pide un video en traje de bano | SUPLANTACION_IDENTIDAD | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00ak1148jw5syjf6 | soy tu nuevo compañero clase 7A pasame fotos tareas | SUPLANTACION_IDENTIDAD | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00al1148r378s4oi | prima emergencia numero papas mamas dice | SUPLANTACION_IDENTIDAD | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00am1148qz91peo0 | profesor nuevo pide datos familia colegio | SUPLANTACION_IDENTIDAD | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00ao1148ox9qhplg | canal tv infantil casting pide video bikini | SUPLANTACION_IDENTIDAD | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00ax11483ozrks1j | carro recoge escuela direccion manda | SOLICITUD_ENCUENTRO | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00b31148xivzo9n3 | Me manda mensajes describiendo actos sexuales que quiere hacer conmigo | COMPARTIMIENTO_SEXUAL | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00b61148h895yn14 | grupo whatsapp pasa MASNNA menores | COMPARTIMIENTO_SEXUAL | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvw00b811486nhhmdhv | describe actos sexuales chat noche | COMPARTIMIENTO_SEXUAL | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvx00c71148huipq72v | Mando mi foto privada a desconocidos por internet | DIFUSION_NO_CONSENTIDA | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvx00cc1148knp6kk72 | foto privada desconocidos internet mando | DIFUSION_NO_CONSENTIDA | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |
| cmrobzjvx00cl1148lv8epzfr | redes donde vivo hora sale colegio publico | DOXING | ornith:35b, ornith:9b-3v, ornith:9b-base, qwen2.5:32b | - |

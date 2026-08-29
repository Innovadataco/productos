# Convenio de Transmisión y Tratamiento de Datos Personales

> ✅ **CERRADO internamente — 2026-08-12.** Las 15 cláusulas, los roles (Colegio = Responsable,
> Innovadataco = Encargado), las obligaciones de ambas partes, el régimen de NNA y el fundamento
> legal completo (Ley 1581/2012, Decreto 1377/2013, Ley 1098/2006, Constitución art. 44, Sentencia
> C-748/2011) ya están redactados. **No quedan pendientes de redacción de nuestro lado.** Lo que
> falta es exclusivamente jurídico: los 5 campos `[ABOGADO: …]` (calificación de roles, plazo de
> notificación de incidentes, plazo de supresión, duración de confidencialidad, régimen de
> responsabilidad y jurisdicción) y luego completar los datos de cada colegio (`[NOMBRE DEL
> COLEGIO]`, NIT, domicilio) antes de firmar.

> ⚠️ **BORRADOR para revisión de un abogado.** No es un contrato final ni asesoría legal.
> Cubre la pieza (3) de BL-1 que hoy no existía ni como documento: el convenio de tratamiento de
> datos con cada colegio cliente. Se apoya en la estructura de la [Política de Tratamiento de
> Datos](BORRADOR-BL1-POLITICA-TRATAMIENTO-DATOS.md) y en el [Documento
> Maestro](DOCUMENTO-MAESTRO-PROTECCION-INFANTIL.md). Los campos marcados `[ABOGADO: …]` requieren
> decisión o redacción jurídica antes de publicarse; el resto es propuesta de contenido lista para
> revisión.

| Campo | Valor |
|-------|-------|
| **Proyecto** | Protección Infantil (PI) — módulo Colegios |
| **Partes** | INNOVADATACO S.A.S. (Encargado del Tratamiento) y el Colegio (Responsable del Tratamiento) |
| **Estado** | v0.1 · Borrador de trabajo |

---

## Preámbulo

Entre **INNOVADATACO S.A.S.**, identificada con NIT 902.033.085-1, con domicilio en Bogotá D.C.,
Colombia (en adelante "INNOVADATACO" o el "Encargado del Tratamiento"), y **[NOMBRE DEL COLEGIO]**,
identificado con NIT `[___]`, con domicilio en `[___]` (en adelante el "Colegio" o el "Responsable
del Tratamiento"), se celebra el presente Convenio de Transmisión y Tratamiento de Datos Personales
(el "Convenio"), sujeto a las siguientes cláusulas.

> **`[ABOGADO:`** confirmar la calificación de roles (Colegio = Responsable, Innovadataco =
> Encargado) para los datos de alumnos cargados por el Colegio, conforme al art. 3 de la Ley
> 1581/2012 y el Decreto 1377/2013. El borrador asume esta calificación porque es el Colegio quien
> decide cargar los datos de su comunidad y obtiene la autorización de los acudientes; Innovadataco
> los trata únicamente para prestar el servicio contratado.**`]`**

## 1. Objeto

El presente Convenio regula la transmisión de datos personales de estudiantes, docentes y
administradores del Colegio hacia la plataforma "Protección Infantil" (`pi.innovadataco.com`), y
el tratamiento que INNOVADATACO realiza sobre dichos datos en su calidad de Encargado del
Tratamiento, exclusivamente para las finalidades autorizadas en este Convenio y en la Política de
Tratamiento de Datos Personales de INNOVADATACO.

## 2. Definiciones

Para efectos de este Convenio aplican las definiciones de la Ley 1581 de 2012 y el Decreto 1377 de
2013: Titular, Dato Personal, Dato Sensible, Tratamiento, Autorización, Responsable del Tratamiento
y Encargado del Tratamiento. Adicionalmente:

- **Datos de la Comunidad Educativa:** nombre, curso/grado, identificadores digitales (nick,
  número, usuario de plataforma) y demás datos de estudiantes que el Colegio decida cargar a la
  plataforma, así como los datos de administradores y docentes que gestionan el módulo institucional.
- **Alerta:** notificación agregada y anonimizada que la plataforma envía al Colegio cuando un
  identificador vinculado a un estudiante de su comunidad aparece en un reporte, sin revelar el
  contenido del reporte ni la identidad de quien lo presentó.

## 3. Datos objeto del Convenio

| Categoría | Datos incluidos | Origen |
|---|---|---|
| Estudiantes | Nombre, curso/grado, identificadores digitales vinculados (nick, número, usuario) | Cargados por el Colegio |
| Docentes y administradores | Nombre, correo institucional, rol dentro del módulo | Cargados por el Colegio |
| Alertas generadas | Vínculo agregado entre identificador reportado y estudiante — sin contenido del reporte ni identidad del denunciante | Generados por la plataforma |

INNOVADATACO no accede, bajo ningún supuesto, al contenido de los reportes vinculados a un
identificador del Colegio más allá de la alerta agregada definida en este Convenio; esa
información permanece bajo las reglas de anonimización y revisión humana descritas en la Política
de Tratamiento de Datos.

## 4. Finalidades autorizadas

INNOVADATACO tratará los Datos de la Comunidad Educativa única y exclusivamente para:

- Prestar el servicio del módulo institucional contratado (gestión de cursos, alumnos y profesores,
  alertas, informes).
- Generar alertas cuando un identificador vinculado a un estudiante del Colegio aparezca en un
  reporte procesado por la plataforma.
- Producir informes agregados y anonimizados para el Colegio (tablero, informe PDF mensual,
  patrones institucionales, cuando estén disponibles).
- Cumplir obligaciones legales y atender requerimientos de autoridad competente.

**Queda expresamente prohibido** todo tratamiento de los Datos de la Comunidad Educativa para
fines distintos a los aquí autorizados, incluyendo fines comerciales, publicitarios, de
perfilamiento o de venta/cesión a terceros no previstos en este Convenio.

## 5. Obligaciones del Encargado (INNOVADATACO)

1. Tratar los Datos de la Comunidad Educativa exclusivamente conforme a las instrucciones del
   Colegio y las finalidades de este Convenio.
2. Guardar confidencialidad sobre los Datos de la Comunidad Educativa, incluso después de
   terminado el Convenio.
3. Implementar y mantener las medidas técnicas y administrativas de seguridad descritas en la
   Política de Tratamiento de Datos: cifrado en reposo, anonimización, aislamiento multi-tenant
   entre instituciones, control de acceso por rol y auditoría de cada cambio de estado.
4. No transferir ni transmitir los Datos de la Comunidad Educativa a un tercero sin autorización
   previa y escrita del Colegio, salvo a los subencargados de infraestructura estrictamente
   necesarios para prestar el servicio (§8) y bajo las mismas obligaciones de este Convenio.
5. Notificar al Colegio cualquier incidente de seguridad que comprometa los Datos de la Comunidad
   Educativa en un plazo máximo de `[ABOGADO: definir — se sugiere 72 horas]` desde su detección,
   con el detalle disponible del incidente y las medidas de contención adoptadas.
6. Permitir al Colegio verificar el cumplimiento de este Convenio, incluyendo la posibilidad de
   solicitar evidencia de las medidas de seguridad implementadas.
7. Suprimir o devolver los Datos de la Comunidad Educativa al terminar el Convenio, según lo
   dispuesto en la cláusula 10, salvo obligación legal de conservación.

## 6. Obligaciones del Responsable (el Colegio)

1. Contar con la autorización previa, expresa e informada de los padres, madres o acudientes (o
   del representante legal del menor, según aplique) para el tratamiento de los datos de cada
   estudiante cargado a la plataforma, conforme al régimen especial de datos de niños, niñas y
   adolescentes.
2. Garantizar la veracidad, exactitud y actualización de los Datos de la Comunidad Educativa que
   carga a la plataforma.
3. Informar a la comunidad educativa (estudiantes, familias, docentes) sobre el uso de la
   plataforma como herramienta de prevención y detección temprana, incluyendo que no sustituye la
   ruta de atención de la Ley 1620 de 2013 ni la denuncia formal ante las autoridades competentes.
4. Designar un administrador institucional responsable del módulo, con acceso controlado y
   trazable.
5. Notificar oportunamente a INNOVADATACO cualquier solicitud de un titular (padre, acudiente o
   estudiante mayor de edad) para ejercer sus derechos de habeas data sobre datos gestionados a
   través del módulo institucional.

## 7. Régimen especial de datos de niños, niñas y adolescentes (NNA)

El tratamiento de datos de NNA bajo este Convenio se realiza de forma excepcional, atendiendo al
interés superior del niño (Constitución Política, art. 44; Sentencia C-748 de 2011; Ley 1098 de
2006 — Código de Infancia y Adolescencia) y respetando sus derechos fundamentales. INNOVADATACO no publica ni expone la identidad de ningún estudiante,
no genera perfiles de riesgo sobre estudiantes, y limita el acceso a los Datos de la Comunidad
Educativa al personal estrictamente necesario para prestar el servicio.

> **`[ABOGADO:`** precisar el régimen de autorización del representante legal para NNA en el
> contexto específico del módulo de colegios — en particular si basta la autorización
> institucional general del colegio (p. ej. incorporada al proceso de matrícula) o si se requiere
> autorización individual y expresa por cada acudiente al momento de vincular a cada estudiante.**`]`**

## 8. Subencargados de infraestructura

INNOVADATACO podrá apoyarse en proveedores de infraestructura tecnológica (alojamiento del
servidor de aplicación y base de datos) estrictamente necesarios para prestar el servicio,
imponiéndoles contractualmente obligaciones de confidencialidad y seguridad equivalentes a las de
este Convenio. El procesamiento de inteligencia artificial sobre el contenido de los reportes se
realiza en infraestructura local controlada por INNOVADATACO — los textos de los reportes no se
envían a proveedores externos de IA.

## 9. Medidas de seguridad

Como mínimo, INNOVADATACO mantiene: cifrado de la información sensible en reposo (AES-256-GCM),
direcciones IP almacenadas en forma hasheada e irreversible, aislamiento estricto entre
instituciones (multi-tenant), control de acceso por rol, registro de auditoría de cada cambio de
estado sobre un caso, y separación de la infraestructura de facturación respecto del núcleo de
datos sensibles.

## 10. Vigencia, terminación y destino de los datos

Este Convenio está atado a la vigencia de la suscripción del Colegio al módulo institucional.
Terminada la relación contractual (por vencimiento, no renovación o terminación anticipada),
INNOVADATACO deberá, a elección del Colegio: (a) suprimir de forma segura e irreversible los Datos
de la Comunidad Educativa dentro de un plazo de `[ABOGADO: definir — se sugiere 30 días
calendario]`, o (b) devolverlos en un formato exportable, salvo que exista obligación legal de
conservación por un período mayor.

> **`[ABOGADO:`** confirmar si aplica algún período mínimo de conservación por obligación legal
> (p. ej. requerimientos de autoridades educativas o de protección de menores) antes de autorizar
> la supresión total.**`]`**

## 11. Derechos de los titulares (Habeas Data)

Los padres, madres, acudientes o estudiantes mayores de edad podrán ejercer sus derechos de
conocer, actualizar, rectificar y suprimir sus datos, así como revocar la autorización otorgada, a
través del canal habilitado por INNOVADATACO: **gerencia@innovadataco.com**. El Colegio se
compromete a divulgar este canal a su comunidad educativa.

## 12. Confidencialidad

Ambas partes se obligan a mantener confidencialidad sobre la información técnica, operativa y de
negocio de la otra parte a la que tengan acceso con ocasión de este Convenio, durante su vigencia
y por un período adicional de `[ABOGADO: definir — se sugiere 2 años]` tras su terminación.

## 13. Responsabilidad

> **`[ABOGADO:`** redactar el régimen de responsabilidad y, de ser pertinente, un límite de
> responsabilidad económica — esta es una decisión que debe tomar el abogado junto con el CEO,
> considerando el perfil de riesgo del dominio (datos de menores) y la capacidad de la compañía de
> asumir contingencias.**`]`**

## 14. Ley aplicable y solución de controversias

Este Convenio se rige por las leyes de la República de Colombia, en especial la Ley 1581 de 2012,
el Decreto 1377 de 2013 y las normas que las modifiquen o sustituyan.

> **`[ABOGADO:`** definir el mecanismo de solución de controversias (jurisdicción ordinaria,
> cláusula compromisoria de arbitraje, etc.) según la práctica habitual de la firma que revise el
> contrato.**`]`**

## 15. Firmas

En señal de conformidad, las partes suscriben el presente Convenio en dos ejemplares del mismo
tenor.

```
_________________________________          _________________________________
Por INNOVADATACO S.A.S.                     Por [NOMBRE DEL COLEGIO]
Nombre:                                     Nombre:
Cargo:                                      Cargo:
Fecha:                                      Fecha:
```

---
> **📋 Control del documento** · v0.2 (BORRADOR) · 2026-08-12 · Autor: Claude (a partir de la
> Política de Tratamiento de Datos v0.2 y el Documento Maestro del producto). *Pendiente de
> validación por abogado antes de firmarse con cualquier colegio. Los campos `[ABOGADO: …]` son
> decisiones o redacciones que requieren criterio jurídico. Versión Word equivalente disponible en
> `Convenio-Tratamiento-Datos-Colegios.docx`.*
> _v0.2: añade la Ley 1098 de 2006 (Código de Infancia y Adolescencia) como fundamento del interés
> superior del niño en §7, siguiendo la recomendación #2 de
> [ANALISIS-COMPARATIVO-PRODUCTO-VS-NORMATIVIDAD.md](ANALISIS-COMPARATIVO-PRODUCTO-VS-NORMATIVIDAD.md)._
> **Cierre de revisión interna: 2026-08-12.** Este documento pasa a estado "listo para abogado" —
> el trabajo de redacción interna terminó aquí; los siguientes cambios solo deberían venir de
> retroalimentación jurídica o de completar los datos de cada colegio al firmar.

# Política de Tratamiento de Datos Personales y Aviso de Privacidad · Protección Infantil

> ✅ **CERRADO internamente — 2026-08-12.** Este documento ya cubrió todo lo que se podía definir sin
> criterio jurídico: responsable, canal de habeas data, propuesta de retención, propuesta de régimen
> de autorización NNA, y el marco legal completo (Ley 1581, Decreto 1377/2013, Ley 1098/2006, y el
> contexto de Ley 2489/2025, Decreto 0769/2026, Ley 2564/2026). **No quedan pendientes de redacción
> de nuestro lado.** Lo único que falta es externo: que un abogado valide/ajuste los campos
> `[ABOGADO: …]` y que se registre la base de datos ante la SIC (RNBD). Ese trabajo ya no depende de
> más iteración interna — depende de agendar con el abogado.

> ⚠️ **BORRADOR para revisión de un abogado.** No es asesoría legal ni un documento final.
> Actualiza el borrador v0.2 (2026-08-02): añade una propuesta concreta de retención (§13) y de
> régimen de autorización para NNA en el módulo de colegios (§6), donde antes solo había espacios
> en blanco. **v0.4** añade la Ley 1098 de 2006 al marco legal (§2), siguiendo la recomendación #2 del
> [análisis comparativo producto vs. normatividad](ANALISIS-COMPARATIVO-PRODUCTO-VS-NORMATIVIDAD.md).
> Los campos `[ABOGADO: …]` requieren validación o decisión jurídica antes de publicarse.

| Campo | Valor |
|---|---|
| **Proyecto** | Protección Infantil (PI) |
| **Estado** | v0.4 · Borrador — actualiza v0.3 (2026-08-12) |
| **Pendiente** | Validación de abogado + registro RNBD (SIC) |

---

## Estado de las decisiones del CEO

| Decisión | Estado |
|---|---|
| Responsable del tratamiento | ✅ INNOVADATACO S.A.S. · NIT 902.033.085-1 · Bogotá D.C. |
| Canal habeas data | ✅ `gerencia@innovadataco.com` — responsable: Gerencia |
| Retención | 🟡 Propuesta redactada en §13 — pendiente de validación del abogado |
| Convenio con colegios | 🟡 Borrador disponible por separado: [Convenio-Tratamiento-Datos-Colegios.md](Convenio-Tratamiento-Datos-Colegios.md) |
| Validación legal + RNBD | ⏳ Pendiente — siguiente paso antes de publicar esta política |

## 1. Responsable del tratamiento

**INNOVADATACO S.A.S.**, NIT **902.033.085-1**, con domicilio en **Bogotá D.C., Colombia** (en
adelante, "la Plataforma" o "Protección Infantil"), es responsable del tratamiento de los datos
personales recolectados a través de `pi.innovadataco.com`. Contacto para asuntos de datos
personales (habeas data): **gerencia@innovadataco.com**.

## 2. Marco legal

Ley 1581 de 2012, Decreto 1377 de 2013 y demás normas concordantes de Colombia; régimen de especial
protección de los datos de niños, niñas y adolescentes (NNA) y el principio del interés superior
del niño (Constitución art. 44; Sentencia C-748/2011; **Ley 1098 de 2006 — Código de Infancia y
Adolescencia**). Adicionalmente, esta política se enmarca en el contexto de la Ley 2489 de 2025, el
Decreto 0769 de 2026 y la Ley 2564 de 2026 (vigente desde el 8 de enero de 2026, tipifica 6
conductas de violencia digital: grooming, sexting, sextorsión, stalking, ciberacoso y happy
slapping), que rigen la protección de menores en entornos digitales en Colombia.

## 3. Definiciones

Titular, dato personal, dato sensible, tratamiento, autorización, encargado y responsable, según la
Ley 1581/2012.

## 4. Datos que se recolectan y tratan

- **Usuarios (adultos):** identificación básica, correo, credenciales (cifradas) y datos de
  contacto del "círculo de confianza".
- **Colegios:** datos de la institución, de administradores y **datos de alumnos** (nombre, curso,
  identificadores digitales) cargados por el colegio bajo su responsabilidad, conforme al Convenio
  de Transmisión y Tratamiento de Datos suscrito con cada institución.
- **Reportes:** el **texto del reporte** (posible información sensible sobre NNA) y los
  identificadores reportados. El texto se almacena **cifrado en reposo (AES-256-GCM)** y se
  **anonimiza/purga** según el estado del reporte.
- **Técnicos:** dirección IP (**almacenada hasheada de forma irreversible**, no en claro) y
  registros de auditoría (sin el contenido de los reportes).

## 5. Finalidades del tratamiento

(a) Recibir y clasificar reportes de posibles conductas de riesgo contra NNA en entornos digitales;
(b) permitir la consulta pública **agregada** (sin exponer identidades ni "score" de personas);
(c) alertar a familias y colegios suscritos; (d) facilitar la canalización hacia autoridades y
canales oficiales (Línea 141 ICBF, CAI Virtual, Te Protejo); (e) prevención (contenido educativo);
(f) seguridad, auditoría y cumplimiento legal.

## 6. Tratamiento de datos de niños, niñas y adolescentes (NNA)

La Plataforma trata datos de NNA **de forma excepcional**, atendiendo al **interés superior del
niño** y a sus derechos fundamentales. La Plataforma **no expone públicamente** la identidad de un
NNA ni califica a personas; **clasifica conductas**, no personas (presunción de inocencia).

**Propuesta de régimen de autorización (para validación del abogado):** (i) para reportes
ciudadanos sobre un identificador, no se trata como dato del NNA reportante sino como relato de un
tercero, bajo las reglas de anonimización de la sección 7; (ii) para el módulo de colegios, la
autorización se obtiene de dos formas posibles — autorización institucional incorporada al proceso
de matrícula o manual de convivencia del colegio (si el colegio así lo decide y lo documenta), o
autorización individual del acudiente al vincular a cada estudiante.

> **`[ABOGADO:`** validar cuál de las dos vías de autorización (institucional vs. individual) es
> jurídicamente suficiente para el módulo de colegios, o si deben coexistir; y confirmar el
> tratamiento de los relatos de reportes que mencionan a un NNA sin que este haya autorizado
> nada.**`]`**

## 7. Datos sensibles y del reporte

El texto del reporte puede contener datos sensibles. Se trata bajo medidas reforzadas: **cifrado en
reposo**, **anonimización** de víctima y denunciante, **acceso restringido** y auditado, y **purga**
del texto en los estados terminales que no lo requieren.

## 8. Derechos del titular (Habeas Data)

Conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; ser informado del
uso; presentar quejas ante la SIC; **revocar** la autorización y solicitar la **supresión** cuando
proceda.

## 9. Canal y procedimiento para ejercer derechos

- **Canal:** **gerencia@innovadataco.com** · Responsable: **Gerencia, INNOVADATACO S.A.S.**
- **Consultas:** atendidas en **máximo 10 días hábiles** (prorrogables 5 más, informando).
- **Reclamos:** atendidos en **máximo 15 días hábiles** (prorrogables 8 más, informando).
  *(Plazos de la Ley 1581; el abogado confirma.)*

## 10. Autorización

La autorización del titular se obtiene de forma previa, expresa e informada.

> **`[ABOGADO:`** precisar el momento exacto de recolección de la autorización (registro / al
> reportar / casilla de aceptación) y el texto exacto de la casilla, para cada flujo del producto
> (reporte ciudadano, registro de usuario, carga de alumnos por el colegio).**`]`**

## 11. Seguridad de la información

Cifrado de credenciales y del texto del reporte en reposo; IP hasheada; aislamiento por institución
(multi-tenant); control de acceso por rol; registro de auditoría; respaldo controlado de la llave de
cifrado (fuera de la infraestructura).

## 12. Transmisión y transferencia

- **A colegios:** los datos de alumnos se tratan bajo el **Convenio de Transmisión y Tratamiento de
  Datos** firmado con cada institución (encargado del tratamiento).
- **A autoridades:** solo por los canales oficiales y a solicitud legítima; la Plataforma no
  sustituye la denuncia formal.

## 13. Retención y supresión — propuesta para validación

| Dato | Propuesta de retención (sujeta a validación del abogado) |
|---|---|
| Texto del reporte (identificable) | Cifrado y anonimizado/purgado según el estado; no se conserva identificable más allá de lo necesario para la revisión humana y el mecanismo de disputa. |
| Dato agregado/clasificación (anonimizado) | Se conserva mientras exista la finalidad de protección (valor histórico para conectar señales en el tiempo). |
| Cuentas de usuario | Mientras estén activas + 2 años tras la última interacción; supresión a solicitud del titular en cualquier momento. |
| Datos de alumnos (colegios) | Atados a la vigencia del Convenio con el colegio; supresión dentro de 30 días calendario tras su terminación, salvo obligación legal de conservación. |
| Registros de auditoría (sin contenido de reportes) | 2 años desde su generación. |
| Dirección IP (hasheada) | Igual al ciclo de vida del reporte o cuenta asociada; nunca se almacena en claro. |

> **`[ABOGADO:`** confirmar o ajustar cada uno de los períodos propuestos en la tabla anterior; son
> una propuesta de trabajo, no una decisión legal firme.**`]`**

## 14. Vigencia

Esta política rige desde `[FECHA de publicación]`. La base de datos tendrá vigencia indefinida
mientras persistan las finalidades y el marco legal aplicable.

---

## Aviso de Privacidad (versión corta, para el momento de recolección)

> **INNOVADATACO S.A.S.** (NIT 902.033.085-1) tratará tus datos para recibir y clasificar reportes
> de protección de NNA y funciones asociadas. Puedes conocer, actualizar, rectificar y suprimir tus
> datos, y revocar tu autorización, escribiendo a **gerencia@innovadataco.com**. Consulta la
> Política de Tratamiento completa en `[URL — p. ej. pi.innovadataco.com/politica-datos]`.

---
> **📋 Control del documento** · v0.4 (BORRADOR) · 2026-08-12 · Autor: Claude · *Actualiza v0.2
> (2026-08-02, datos del responsable cargados por el CEO). Añade propuesta de retención (§13) y de
> régimen de autorización NNA (§6) para acelerar la revisión del abogado. Requiere validación legal
> + registro RNBD (SIC) antes de publicarse. Versión Word equivalente disponible en
> `Politica-Tratamiento-Datos-v0.4.docx`.*
> _v0.4: añade la Ley 1098 de 2006 al marco legal (§2) y precisa la vigencia y las 6 conductas
> tipificadas de la Ley 2564, corrigiendo la referencia genérica de v0.3._
> **Cierre de revisión interna: 2026-08-12.** Este documento pasa a estado "listo para abogado" —
> el trabajo de redacción interna terminó aquí; los siguientes cambios solo deberían venir de
> retroalimentación jurídica.

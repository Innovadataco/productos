# SPEC-940 · I-452 · Tras la 1.ª cita consumida: PI deja de intermediar Y reabre el contacto al padre

**Status**: IMPLEMENTADO

**Rama:** `work/pi-SPEC-940-contacto-tras-primera-cita`, desde la punta de #932 (SPEC-934). (Número SPEC-940 asignado por el CEO; «938b» de los primeros borradores era inválido para `verificar_base` — rama = entero puro.)
**Reemplaza** el enfoque solo-bloqueo del PR #934 (cerrado): bloquear sin reabrir el contacto era la trampa de
754-en-reversa (el aviso manda a «coordinar directo» con el canal cerrado).

## Regla (VEREDICTO Jelkin, brief A-75 v2.0 §4/§9)

De la 2.ª cita en adelante PI no cobra ni intermedia; el padre coordina DIRECTO con el profesional. Para que eso
sea posible, al CONSUMIR la 1.ª cita con ese profesional se le REABRE al padre el contacto de ese profesional —
UNIDIRECCIONAL: el profesional NO recibe el contacto del padre.

«1.ª cita consumida» = **{CONFIRMADA, CUMPLIDA, NO_ASISTIO_PADRE}** (set chico, VEREDICTO CEO). NO entran
`NO_ASISTIO_PROFESIONAL` (falló el profesional → el padre reasigna a otro, D-103(h)) ni `REUBICADA` (la cita se
movió a otro profesional, art. 19/SPEC-814). Es EXACTAMENTE el set que bloquea la 2.ª cita por PI → invariante
**contacto visible ⟺ 2.ª cita bloqueada**.

## Cambio

1. **Reversión 🔴 de SPEC-754, acotada y por DIRECCIÓN** (`contacto-visible.ts`): la fuente era SIMÉTRICA — el mismo
   gate exponía el contacto del profesional al padre Y el correo del padre al profesional. Se parte en
   `contactoVisiblePorSesion(estado, direccion)`:
   - `padre_ve_profesional` → true si `primeraCitaConsumida(estado)`.
   - `profesional_ve_padre` → **false SIEMPRE** (754 sigue en esa dirección; minimización H-2 · Ley 2375/2024).
   Los 3 llamadores pasan su dirección: `debeExponerContacto` (padre), `toCitaParaProfesional` y el calendario del
   profesional (profesional, cerrado). El override VENCIDO/SUSPENDIDO de `debeExponerContacto` manda por encima.
2. **Bloqueo de la 2.ª cita por PI** (`crearSolicitudCita` → 409) con el MISMO set (`ESTADOS_PRIMERA_CITA_CONSUMIDA`,
   fuente única en `segunda-cita.ts`, usada por el repo y por el gate). La ficha muestra el aviso en vez del panel.
   Las no consumidas no cuentan; otro profesional permitido; reprogramación por su ruta (pago heredado).
3. **a-fixes (mentiras de la tarifa):** sin fallback a `pro.tarifaConsultaCOP` en `crearSolicitudCita` (sin precio
   estándar → falla en cerrado). Panel del profesional: «El padre paga» pasa de tarifa+% a ESTÁNDAR+% (lo que PI
   cobra y gira); la tarifa declarada queda informativa, aparte («de la 2.ª cita; la red no la cobra»); el desglose
   es `null` si el precio estándar no está sembrado (resiliente, nunca un número inventado). Ficha/tarjeta/perfil:
   la tarifa va con la aclaración informativa.

## Copy (FORMA Diseño · Gestión `169bd6fc`, SPEC-938 v2.0) — aplicado

- **(a) bloqueo 2.ª cita:** `mensajeSegundaCitaFueraDePi(nombreProfesional)` — interpola el nombre y apunta al canal
  real («tienes sus datos en el panel de tu cita»); por la invariante, cuando aparece el contacto ya es visible.
- **(b) perfil/panel/tarjeta:** la 2.ª cita se arregla DIRECTO con el profesional; su tarifa es informativa, la red
  no la cobra (sin servicio sumado).
- **(c) panel del profesional:** se QUITÓ la fila mentirosa «El padre paga = tarifa». Muestra la tarifa declarada
  (directa, de la 2.ª cita) + prosa: la 1.ª la cobra PI al precio estándar + servicio ({{%}}). `porCobrar` expone
  `tarifaDeclarada` + `porcentajeServicio` (ya no un desglose basado en la tarifa).
- **(d) NUEVO bloque «Datos del profesional»** en `EsperaCitaPanel` (componente `DatosProfesionalCita`): email
  siempre + teléfono opcional + marcador tú; solo cuando el DTO trae el contacto. Dirección única (el profesional no
  ve los datos del padre).

## Corrección de lógica (borde VENCIDO) — plan A

El bloqueo de la 2.ª cita se alineó al predicado COMPLETO de exponibilidad: bloquear ⟺ contacto exponible = cita
consumida Y perfil NO cerrado (`ESTADOS_PERFIL_CONTACTO_CERRADO = {VENCIDO, SUSPENDIDO}`, fuente única compartida por
`debeExponerContacto` y el repo). Antes el bloqueo miraba solo el estado de la cita → en vencido+CONFIRMADA quedaba
bloqueado=true pero visible=false y el invariante se rompía justo donde (a) promete «tenés sus datos». Ahora en
vencido NO se bloquea (y el padre igual no puede agendar: `obtenerPublicoPorId` filtra ACTIVO/vigente en
`crearSolicitudCita` → rechazo upstream, sin hueco) y tampoco se muestra contacto → **NI bloqueado NI visible**,
invariante intacto. (No se usó la variante de mensaje plan B.)

## Candados

- `contacto-tras-primera-cita.candado.test.ts` (🔴 núcleo): por el DTO real — el padre ve el contacto SOLO en el
  set consumido y en NINGUNO de los otros 6; el profesional NUNCA ve el correo del padre en los 9 estados
  (unidireccional); VENCIDO/SUSPENDIDO cierra aunque esté CONFIRMADA; invariante visible ⟺ bloqueado (misma
  constante en repo y gate). Mutaciones probadas: abrir la dirección profesional→padre → rojo; ampliar el set → rojo.
- `contacto-visible.test.ts` (valor por dirección) · `contacto-fuente-unica.candado.test.ts` (mecanismo, mock 2
  args) · `dto.test.ts` (reapertura padre, override) · `segunda-cita.candado.test.ts` (bloqueo + reprogramar) ·
  panel `route.test.ts` (desglose sobre el estándar, tarifa declarada informativa).

## Candados (añadidos)

- `segunda-cita.candado.test.ts`: borde VENCIDO — con 1.ª cita CONFIRMADA pero perfil VENCIDO, `existeCitaConfirmada…`
  = false (no bloquea) y `debeExponerContacto` = false (no visible). Mutación probada: quitar el filtro de perfil del
  bloqueo → el borde VENCIDO rompe.
- `contacto-tras-primera-cita.candado.test.ts`: repo y gate comparten `ESTADOS_PERFIL_CONTACTO_CERRADO` (block ⟺
  exponible, borde incluido).
- `DatosProfesionalCita.test.tsx`: (d) copy + teléfono opcional + dirección única.

## Certificación

Diseño certifica el render de las 4 superficies (contacto en la cita, aviso del bloqueo, panel, tarjeta) contra el
commit desplegado de #936. Revisión adversarial: reabre un canal que 754 cerró a propósito.

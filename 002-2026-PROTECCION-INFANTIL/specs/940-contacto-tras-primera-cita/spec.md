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

## Copy

**PLACEHOLDER** (perfil/panel/tarjeta/bloqueo): lo define la FORMA nueva de Diseño. El mensaje del bloqueo
(`MENSAJE_SEGUNDA_CITA_FUERA_DE_PI`) y «la red no la cobra» son provisionales.

## Candados

- `contacto-tras-primera-cita.candado.test.ts` (🔴 núcleo): por el DTO real — el padre ve el contacto SOLO en el
  set consumido y en NINGUNO de los otros 6; el profesional NUNCA ve el correo del padre en los 9 estados
  (unidireccional); VENCIDO/SUSPENDIDO cierra aunque esté CONFIRMADA; invariante visible ⟺ bloqueado (misma
  constante en repo y gate). Mutaciones probadas: abrir la dirección profesional→padre → rojo; ampliar el set → rojo.
- `contacto-visible.test.ts` (valor por dirección) · `contacto-fuente-unica.candado.test.ts` (mecanismo, mock 2
  args) · `dto.test.ts` (reapertura padre, override) · `segunda-cita.candado.test.ts` (bloqueo + reprogramar) ·
  panel `route.test.ts` (desglose sobre el estándar, tarifa declarada informativa).

## Certificación

Diseño certifica el render (contacto en la cita, aviso del bloqueo, panel, tarjeta) contra el commit desplegado.
Revisión adversarial fuerte: esto reabre un canal que 754 cerró a propósito.

# SPEC-596 · Rediseño del resultado vacío de la consulta pública (decisión CEO)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: orden CEO (Jelkin), 06-09-2026. Rama `work/pi-SPEC-596-consulta-vacia`.

## Impacto en arquitectura: no

Cambio 100 % de UI en un componente existente (`ConsultaVaciaBloque`) y sus dos
puntos de montaje. Sin endpoints nuevos, sin cambios de contrato: el DTO
`bloqueVacia` (disclaimer/señales/acciones desde parámetros curados) queda idéntico.

## El problema

El resultado vacío de la consulta pública (buscar un identificador sin reportes)
acumulaba demasiados elementos con el mismo peso: disclaimer, enlace a un modal,
CTA «Reportar una conducta», canales oficiales y las señales/acciones escondidas
tras el modal. El CEO, en su recorrido de la app (06-09-2026), ordenó el
rediseño con tres decisiones exactas:

1. **Quitar** de la pantalla de resultado vacío el bloque de canales
   telefónicos/oficiales (141, CAI Virtual, Te Protejo, MinTIC/Fiscalía) y el
   CTA «Reportar una conducta».
2. **El contenido informativo pasa a ser el protagonista visual**: una tarjeta
   destacada y expandida con «Señales de alerta a las que estar atento»
   (5 ítems) y «Qué puedes hacer» (3 ítems). Solo informativo.
3. **Diseño más visual y más importante** que el estado anterior.

## Decisión de constitución (deliberada y documentada)

La constitución exige: «toda interfaz de reporte muestra de forma visible
Línea 141 ICBF, CAI Virtual y Te Protejo». Esa regla aplica a los **flujos de
REPORTE**, no a la consulta. Verificado en esta spec:

- `/reportar` sigue montando `<CanalesOficiales />`
  (`src/app/reportar/page.tsx`) — sin cambios.
- La portada sigue montando `<CanalesOficiales />` ANTES de la consulta
  (candado `portada-sin-alarma.candado.test.ts`, SPEC-456) — sin cambios.
- El candado `canales-oficiales-neutro.candado.test.ts` (SPEC-477) protege la
  neutralidad cromática del componente `CanalesOficiales.tsx`; no fija dónde se
  monta, así que no se toca.

La consulta vacía queda limpia: mensaje descriptivo + disclaimer + tarjeta
informativa. Presunción de inocencia intacta (lenguaje descriptivo, nunca
«es seguro/peligroso»).

## Alcance

- **Componente `ConsultaVaciaBloque`** (único archivo de lógica):
  - SALE: CTA «Reportar una conducta» (con su handoff por sessionStorage y su
    evento analítico `consulta_vacia_cta_reportar`), `<CanalesOficiales />`,
    el modal y el enlace «Ver señales de alerta y qué puedes hacer».
  - ENTRA: tarjeta protagonista expandida siempre (sin interacción necesaria),
    con encabezado destacado y las dos secciones con sus ítems completos.
  - El prop `identificador` desaparece: solo existía para el CTA de reporte.
- **Montajes**: `ConsultaEnriquecidaClient` y `LandingHero` dejan de pasar
  `identificador` al bloque.
- **Sin cambios**: API `/api/consulta` (el DTO `bloqueVacia` es el mismo),
  parámetros curados (`consulta.vacia.*`), endpoint de analítica
  `/api/consulta/evento` (queda sin emisor del evento CTA; se conserva el
  contrato), portada, `/reportar`, canales oficiales en cualquier flujo de
  reporte.

## Functional Requirements

- **FR-001**: El resultado vacío de la consulta pública NO DEBE mostrar el CTA
  «Reportar una conducta» ni el bloque de canales oficiales (141, CAI Virtual,
  Te Protejo).
- **FR-002**: El resultado vacío DEBE mostrar la tarjeta «Señales de alerta y
  qué puedes hacer» como elemento visual protagonista: expandida de entrada,
  sin modal, enlace ni interacción previa, con las secciones «Señales de
  alerta a las que estar atento» y «Qué puedes hacer» y todos sus ítems
  visibles.
- **FR-003**: El contenido de la tarjeta DEBE seguir viniendo 100 % de los
  parámetros curados (`consulta.vacia.senales` / `consulta.vacia.acciones` /
  `consulta.vacia.disclaimer`), sin texto hardcodeado de ítems; la degradación
  limpia (secciones ausentes omitidas) se conserva.
- **FR-004**: El disclaimer (cuando el parámetro existe) DEBE mantenerse
  visible sobre la tarjeta.
- **FR-005**: Los flujos de REPORTE y la portada DEBEN conservar los canales
  oficiales visibles exactamente como hoy (`/reportar`, candado SPEC-456).

## Criterios de aceptación

- [x] Test unitario de `ConsultaVaciaBloque` verde: tarjeta protagonista con
  ambas secciones visibles sin click; CTA y canales ausentes; degradación
  limpia; sección única.
- [x] Tests de `LandingHero` y `ConsultaEnriquecidaClient` verdes (montaje sin
  prop `identificador`).
- [x] Candados `portada-sin-alarma` y `canales-oficiales-neutro` en verde sin
  modificación.
- [x] `/reportar` sigue mostrando `CanalesOficiales` (verificado en fuente).
- [x] `tsc --noEmit` verde; ESLint verde en archivos tocados; `npm run build`
  verde.
- [x] Tono neutro sin voseo en textos nuevos.

## Implementación

- `src/components/modules/ConsultaVaciaBloque.tsx` — rewrite: tarjeta
  protagonista (sección `aria-labelledby` por accesibilidad), sale CTA/canales/
  modal/handoff; tokens de marca (ambar/papel/tinta/pino), sin color crudo.
- `src/components/modules/ConsultaVaciaBloque.test.tsx` — rewrite al nuevo
  contrato (4 tests; los dos tests del CTA/handoff mueren con el CTA).
- `src/components/modules/ConsultaEnriquecidaClient.tsx` y `LandingHero.tsx` —
  dejan de pasar `identificador` al bloque.
- Artefactos: `specs/596-consulta-vacia/{spec,plan,tasks}.md`; índice
  `specs/README.md` regenerado con `scripts/specs/generar-readme.ts`.

## Deuda / notas

- El endpoint `/api/consulta/evento` conserva el literal `consulta_vacia_cta_reportar`
  en su schema aunque ya ningún componente lo emita: es contrato de API y su
  test sigue verde. Si en una limpieza futura se retira el evento, retirar el
  literal en el mismo cambio.
- Si el CEO pide devolver un acceso a /reportar desde la consulta vacía, la
  vía correcta es el handoff por sessionStorage (nunca query string — candado
  `url-privacy`), reintroduciendo el patrón previo.

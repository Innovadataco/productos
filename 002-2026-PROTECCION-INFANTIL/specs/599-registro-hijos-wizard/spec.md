# SPEC-599 · Wizard de registro de hijo con círculo de confianza vivo

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-08 · **Origen**: aprobación del dueño (Jelkin) sobre el mockup navegable `design/padre-hijos-registro-mockup.html` (checkout principal). Rama `work/pi-SPEC-599-registro-hijos-wizard`.

## Impacto en arquitectura: no

Sin endpoints, rutas, schema ni cambios de proxy/navegación: es un cambio de UI del módulo padre. El contrato del backend queda INTACTO (POST `/api/padre/hijos` con el mismo payload de SPEC-589). El enlace "Ir a mi círculo de confianza" apunta a la ruta existente `/dashboard/padre/circulo-confianza`.

## El problema

El alta de hijo ("A quién protejo") era un formulario plano: pide los datos pero no muestra QUÉ se gana con ellos ni cómo se verá el hijo dentro de la metáfora central del producto (el círculo de confianza). El dueño pidió enriquecer el flujo con la calidad del mockup aprobado: wizard de 4 pasos, preview vivo del círculo mientras se completan los datos, chips de edad y un simulador del tono ámbar como parte del onboarding.

## Alcance

- **Reemplazo del formulario plano de alta** en `MisHijos.tsx` por el wizard `RegistroHijoWizard` (4 pasos: bienvenida → datos del hijo → tu círculo → listo).
- **Componentes nuevos** en `src/components/modules/padre/registro-hijo/`: orquestador, stepper, chips de edad, preview vivo del círculo (SVG coherente con `circulo/IlustracionCirculo.tsx`), paso de círculo con simulador, resumen de confirmación y tipos compartidos.
- **Lógica de negocio intacta**: validaciones (`documento-menor.ts`), alta múltiple de identificadores con plataformas (badges), payload del POST sin documento (SPEC-589) y recarga de la lista tras el alta.
- **Edición de un hijo existente** (`HijoCard`) NO se toca.
- **Simulador de reporte** (switch verde→ámbar del paso 3): queda como parte del onboarding, decisión explícita del dueño.
- **Alineación con el formulario real (SPEC-589)**: nombre/apellidos obligatorios; edad 5-17 opcional como chips (el mockup decía 0-17; se corrige al catálogo real `edadesMenor()`); sexo e identificadores opcionales.

## Decisión de diseño

- Solo el paso activo se monta (paneles condicionales): cada panel re-entra con `animate-floatUp` (curva única del sistema) y el foco va al título del paso (`tabIndex=-1`), que anuncia el cambio de paso.
- El stepper permite volver a un paso visitado; nunca saltar hacia adelante (`maxVisitado`).
- La validación es amable e inline (nombre de campo + `aria-invalid`), misma filosofía que SPEC-361/F7; el error del servidor se muestra con `role="alert"` y devuelve al paso de datos.
- Cero color crudo: todos los colores por token del sistema de diseño (pino/cielo/ambar/rubi/papel/tinta); ámbar como alerta, nunca rojo. Texto de estado con las utilidades `text-estado-*` (contraste AA verificado en SPEC-157).
- El preview del paso 1 usa datos ficticios explícitos ("Sara Valentina (ejemplo)") con nota al pie.

## Functional Requirements

- **FR-001**: El sistema DEBE guiar el alta en 4 pasos (bienvenida, datos del hijo, vista en el círculo, confirmación) con un indicador de progreso que permita volver a pasos visitados.
- **FR-002**: El sistema DEBE mostrar una vista previa viva del círculo de confianza que refleje nombre, edad y número de cuentas mientras el padre completa el formulario.
- **FR-003**: El alta DEBE conservar el contrato de SPEC-589 (sin documento; nombre/apellidos obligatorios; edad/sexo/identificadores opcionales) y el payload del POST `/api/padre/hijos` sin cambios.
- **FR-004**: El paso 3 DEBE incluir un simulador (switch accesible) que muestre el tono ámbar ("1 reporte en revisión") como parte del onboarding.
- **FR-005**: El sistema DEBE enfocar el título del paso al cambiar de paso y anunciar los errores con `role="alert"`.
- **FR-006**: El sistema DEBE ofrecer "Registrar a otro hijo" tras confirmar, con reset completo del wizard.
- **FR-007**: El sistema NO DEBE usar color crudo fuera de los tokens del sistema de diseño.

## Criterios de aceptación

- [x] Wizard navegable de 4 pasos con stepper (tests de navegación).
- [x] Validación: nombre/apellidos vacíos bloquean con mensaje inline; edad opcional permite avanzar.
- [x] Preview vivo refleja iniciales, nombre y detalle (edad · cuentas).
- [x] Simulador cambia el estado visual a ámbar (aria-checked + píldora "1 reporte en revisión").
- [x] POST con payload correcto (sin documento, `anioNacimiento` derivado de la edad, identificadores con y sin plataforma) y recarga de la lista.
- [x] «Registrar a otro hijo» resetea al paso de datos.
- [x] Tests existentes actualizados (MisHijos + candado SPEC-555) y candado SPEC-565 intacto en verde.
- [x] `npx tsc --noEmit`, `npm run lint` (0 errores), `npm run test` y `npm run build` verdes.

## Implementación

- Nuevos: `src/components/modules/padre/registro-hijo/{types,WizardStepper,ChipEdad,PreviewCirculoVivo,PasoBienvenidaRegistro,PasoDatosHijo,PasoCirculoConfianza,ResumenRegistro,RegistroHijoWizard}.tsx` (+ `RegistroHijoWizard.test.tsx`).
- Modificados: `src/components/modules/padre/MisHijos.tsx` (el alta pasa a ser el wizard; carga, cupo y acciones de tarjetas se conservan), `src/components/modules/padre/MisHijos.test.tsx` (los tests del alta navegan el wizard; el POST se dispara en "Confirmar registro"), `src/components/modules/padre/mis-hijos-plataforma.candado.test.tsx` (misma navegación; las aserciones del candado no cambian).
- Reuso: `Input`, `Select`, `Button`, `Badge`, `GlassCard` (ui/), `SEXOS` (HijoCard), `iniciales` (circulo/tipos), `edadesMenor`/`anioDesdeEdad`/`validarEdadMenor` (documento-menor).
- Mockup aprobado (referencia visual, no se commitea al worktree): `design/padre-hijos-registro-mockup.html` en el checkout principal.
- Desviaciones vs. mockup: edad 5-17 (catálogo real, no 0-17); tipografía serif del mockup vía `font-serif` (Instrument Serif, ya en el sistema); animaciones con las utilidades existentes (`animate-floatUp`, `anim-pulso`, `ease-barrido`) en lugar de keyframes nuevos.

## Deuda técnica

- Ninguna conocida.

# SPEC-599 · Plan de implementación

## Enfoque

Cambio de UI puro sobre el módulo padre. El backend (POST `/api/padre/hijos`, SPEC-589) queda intacto: el wizard es una nueva piel del alta que conserva validaciones, alta múltiple de identificadores y payload. Implementación bottom-up: piezas atómicas (tipos, stepper, chips, preview) → pasos → orquestador → integración en `MisHijos` → tests.

## Decisiones técnicas

1. **Solo el paso activo se monta** (render condicional por `paso`): evita controles duplicados ocultos en el DOM (mejor para a11y y para los tests por rol) y re-entra con `animate-floatUp`.
2. **Estado centralizado en `RegistroHijoWizard`**: `form`, `nuevos`, `borrador`, `errores`, `paso`, `maxVisitado`, `guardando`. Los pasos son presentacionales y reciben callbacks.
3. **Foco al título** con `useEffect` sobre `paso` (solo foco, sin setState en el effect; la regla del repo prohíbe setState sincrónico en effects, no el foco).
4. **Preview vivo compartido**: `PreviewCirculoVivo` se usa en los pasos 1 (datos ficticios), 2 (reactivo) y 3 (con tono del simulador); geometría copiada de `IlustracionCirculo` (viewBox 360×220, puesto fijo del hijo arriba).
5. **Stepper con `maxVisitado`**: volver sí, saltar adelante no; `aria-current="step"` en el activo.
6. **Simulador como estado local** de `PasoCirculoConfianza` (`useState` + `role="switch"`): es demostrativo, no persiste nada.
7. **Errores**: inline por campo en el paso 2 (`error` de `Input`, token `rubi`); error de servidor con `role="alert"` sobre el wizard y retorno al paso de datos.
8. **Tests**: archivo nuevo del wizard (navegación, validación, preview, simulador, POST, reset) + ajuste de los tests del alta en `MisHijos.test.tsx` y del candado SPEC-555 para navegar el wizard (aserciones de contrato sin cambios). El candado SPEC-565 (edición) no se toca.

## Riesgos

- Bajo. El contrato del POST está cubierto por tests existentes (API) y nuevos (wizard + MisHijos); los candados de la zona se corren en el gate.

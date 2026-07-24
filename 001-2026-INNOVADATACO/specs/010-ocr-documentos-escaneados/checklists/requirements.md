# Specification Quality Checklist: OCR de documentos escaneados

**Purpose**: Validar la completitud y calidad de la especificación antes de planificar
**Created**: 2026-07-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sin detalles de implementación innecesarios (lenguajes, frameworks, APIs)
- [x] Centrada en el valor para el usuario y la necesidad de negocio
- [x] Redactada para interlocutores no técnicos
- [x] Todas las secciones obligatorias completas

> El motor de reconocimiento **no** se elige aquí a propósito: queda como pregunta abierta 1
> para el plan, porque es la decisión que determina si hace falta un modelo grande (y por tanto
> el tamaño del turno). Nombrar Tesseract o un modelo de visión en la spec habría cerrado por
> la puerta de atrás una decisión de arquitectura que le toca a ZEUS.

## Requirement Completeness

- [x] No quedan marcadores [NEEDS CLARIFICATION]
- [x] Requisitos verificables y sin ambigüedad
- [x] Criterios de éxito medibles, con línea base declarada (21/25 buscables → 25/25)
- [x] Criterios de éxito independientes de la tecnología
- [x] Todos los escenarios de aceptación definidos
- [x] Casos límite identificados (PDF mixto, 400 páginas, escaneo sucio, idioma)
- [x] Alcance delimitado (Out of Scope + frontera con la spec 003)
- [x] Dependencias y supuestos identificados
- [x] **Preguntas abiertas listadas explícitamente** (5, para el plan)

## Feature Readiness

- [x] Todo requisito funcional tiene criterio de aceptación
- [x] Las historias cubren los flujos primarios
- [x] La feature satisface los criterios medibles definidos
- [x] No se filtran detalles de implementación a la especificación

## Gobernanza (ADR_002) — específico de esta spec

- [x] Identificado que la ejecución es **trabajo pesado**
- [x] Marcadas las historias que exigen turno (US1, US4) con 🔥
- [x] Tabla explícita de **qué exige turno y qué no**, para poder avanzar el trabajo frío sin
      tocar la máquina compartida
- [x] Declarado que la suite debe pasar **sin** el motor instalado (SC-008), de modo que el
      código sea integrable sin ejecutar carga
- [x] Recogida la restricción de "un solo modelo grande a la vez" (RZ-1) y la de IA local
      (RZ-6, §0.6)

## Riesgo declarado en la propia spec

- [x] **Un OCR malo es peor que no tener texto**: convierte un hueco visible en un dato falso
      invisible dentro de un corpus normativo. De ahí US3 (calidad y revisión humana) como
      requisito, no como mejora opcional.
- [x] Cero pérdida (RZ-5) y protección de la capa nativa (RZ-2) están como restricciones, no
      como buenas intenciones.

## Estado

**Draft listo para revisión de ZEUS.** No implementable: compuerta propia + turno de Jelkin.

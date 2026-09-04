# Plan · SPEC-425 — El panel del profesional (L5)

## Lo que se leyó antes de escribir

| Fuente | Qué se sacó |
|---|---|
| Mockup aprobado, sección «Lo que ve el profesional» | Los 8 bloques, sus textos y sus contadores. Se copia, no se inventa. |
| Brief A-75 §7 (tabla de lotes) | **L5 lista** los casos por cerrar; el **cierre es L6** y **la plata L7**. Manda sobre el mockup. |
| Brief A-75 §3 | El marcador no cuenta `SIN_CONFIRMAR`. |
| Brief A-75 §9 | Los expedientes compartidos son solo lectura y se abren con código. |
| `profesional/cita/cita.service.ts` | Existe `confirmarPorProfesional` y `rechazarPorProfesional`. **No** existe reprogramación del profesional. |
| Barrido de `CUMPLIDA` / `NO_ASISTIO_PADRE` en `src/` | **Nadie los escribe.** Solo se leen en contadores. El cierre no existe. |
| `solicitud-cita.ts:65` | `listarPorProfesional` tiene `take: 100` — el marcador no puede calcularse ahí. |
| `api/padre/citas/route.ts:16` | El porcentaje de servicio era una constante privada de esa ruta. |
| `proxy.ts:195` y `auth/home-para-rol.ts` | Los dos mapas de aterrizaje, ninguno con `PROFESIONAL`. La cabecera pide tocarlos juntos. |

## La decisión de diseño

El mockup dibuja el destino final; el brief dice qué entrega este lote. **Manda el brief.** Donde el mockup pinta un control que L5 no puede sostener, va una frase que dice qué falta — no un botón apagado, que sigue prometiendo.

## Orden de trabajo

1. Barrer el motor: qué acción existe y cuál no. (Es lo que decidió el alcance.)
2. Sacar el porcentaje a un módulo compartido, sin cambiar el cálculo.
3. Contadores del marcador en el repositorio (no sobre la lista capada).
4. Servicio de agregación → endpoint → pantalla.
5. Los dos mapas de aterrizaje.
6. Candados + integración contra BD + prueba negativa de la regla §3.

# Documento de diseño — Spec 016 Círculo de Confianza

> **Fase:** revisión obligatoria antes de tareas/código.
> Este documento analiza amenazas, verifica que no se filtre información más allá de la consulta pública autenticada, y define interacciones con reportes dados de baja y anonimización.

---

## 1. Análisis de amenaza por actor

| Actor | Qué gana | Qué NO gana | Mitigación implementada |
|---|---|---|---|
| **Padre/madre legítimo** | Vigilancia centralizada de adultos cercanos a su hijo; alerta temprana si alguien del círculo aparece reportado. | No gana información nueva sobre terceros fuera de su círculo. | Login obligatorio; datos solo de sus contactos. |
| **Agresor que se auto-vigila** | Ve si su propio identificador tiene reportes (pero ya podía verlo en consulta pública autenticada). | **No gana:** textos de reportes, quién reportó, cantidad exacta si la consulta pública la oculta, ubicación exacta si la consulta pública la agrega. El email es ciego. El detalle exige login. | Mismas reglas de visibilidad que `/api/consulta`; email ciego; sin PII en notificaciones. |
| **Acosador vigilando a un tercero** | Podría intentar agregar el identificador de la víctima para espiarlo. | **No gana:** nada que no obtenga ya de la consulta pública (que es anónima y agregada). El tope de contactos y rate limit dificultan el scraping masivo. | Tope `circulo.max_contactos`, rate limit `circulo_contacto`, auditoría de altas. |
| **Scraper / actor coordinado** | Podría crear muchas cuentas para ampliar el侦察. | **No gana:** capacidad de escalar masivamente; cada cuenta tiene tope y rate limit; cada alta queda auditada con `(usuarioId, identificador, fecha)`. | Tope por cuenta, rate limit por cuenta/IP, auditoría, login obligatorio. |
| **Usuario curioso** | Ve el estado agregado de sus contactos. | **No gana:** estadísticas globales ni datos de otros usuarios. | Vista agregada estrictamente sobre contactos propios; panorama nacional es enlace separado al dashboard público. |

### Renglón explícito: ¿qué obtiene un agresor que se agrega a sí mismo al círculo?

**Respuesta: nada que no tenga ya.**

- Antes del Círculo, un agresor podía consultar su propio identificador en `/api/consulta` estando autenticado y obtener: total de reportes, score, nivel de riesgo, categorías, ubicaciones agregadas, timeline mensual.
- El Círculo organiza esa misma información por contacto y agrega un email ciego. El email no contiene identificador, categoría, fecha ni ubicación.
- El agresor no obtiene: textos de reportes, datos del reportante, direcciones exactas, ni información sobre otras víctimas.
- Conclusión: el Círculo no amplía la superficie de información para un actor que ya tiene acceso a la consulta pública autenticada.

---

## 2. Verificación de no-filtración

### 2.1 Estado por contacto

El detalle de un contacto llama a la misma lógica que `/api/consulta` con usuario autenticado. Por lo tanto:

| Dato | ¿Expuesto en consulta pública autenticada? | ¿Expuesto en Círculo? |
|---|---|---|
| Total de reportes | Sí | Sí (mismo dato) |
| Score / nivel de riesgo | Sí (autenticado) | Sí (mismo dato) |
| Categorías agregadas | Sí | Sí (mismo dato) |
| Plataformas agregadas | Sí | Sí (mismo dato) |
| Ubicaciones agregadas (ciudad/país) | Sí | Sí (mismo dato) |
| Timeline mensual | Sí | Sí (mismo dato) |
| Textos de reportes | **No** | **No** |
| Nombre/edad del reportante | **No** | **No** |
| Dirección exacta | **No** | **No** |
| Datos de otros identificadores | **No** | **No** |

### 2.2 Notificación email

Contenido propuesto:

```
Asunto: Novedades en tu Círculo de Confianza

Hay novedades en tu Círculo de Confianza. Ingresá para revisar:
https://<app-url>/dashboard/circulo-confianza
```

Verificación:

| Dato | ¿En el email? |
|---|---|
| Identificador del contacto | No |
| Etiqueta del contacto | No |
| Categoría de reporte | No |
| Fecha/hora | No |
| Ciudad/país | No |
| Score/nivel de riesgo | No |
| Link a la app | Sí (genérico) |

### 2.3 Vista agregada de Mi Círculo

La vista agregada suma reportes de los contactos activos del usuario. Solo expone:

- Totales y conteos por país/departamento.
- Distribución por nivel de riesgo/categoría.
- Timeline mensual.

Todo esto son agregados sobre un conjunto restringido (contactos propios). No se muestran identificadores individuales ni textos.

---

## 3. Riesgo de inferencia por resta

### Escenario de riesgo

Un usuario crea un círculo con **un solo contacto**. La vista agregada mostraría mapas/conteos que, en la práctica, geolocalizan un caso puntual.

### Mitigación propuesta

1. **Umbral mínimo de agregación:** la vista agregada solo muestra conteos por país/departamento si hay **≥ 2 contactos con reportes** o **≥ 3 reportes** en total. Si no se alcanza, muestra:
   > "Agregá más contactos o esperá a que haya más reportes para ver el mapa agregado."

2. **No mostrar identificadores en la vista agregada:** solo totales y categorías.

3. **Timeline mensual agrupado:** no se muestran fechas exactas de incidentes, solo conteos por mes.

4. **Enlace explícito al dashboard público:** el panorama nacional se consulta en el dashboard público general, separado del círculo, para evitar confusión entre datos propios y globales.

### Verificación de mitigación

| Escenario | Resultado esperado |
|---|---|
| Círculo con 1 contacto y 1 reporte | Vista agregada muestra mensaje de insuficiencia; detalle del contacto solo dentro de la app. |
| Círculo con 3 contactos y reportes en 2 países | Mapa/conteos por país visibles; no se revela qué contacto está en qué país. |
| Email tras cambio de estado | Ciego; sin datos identificables. |

---

## 4. Interacción con reportes dados de baja (Spec 012)

- El Círculo **excluye** reportes con `eliminado: true` en todas sus consultas.
- Si un contacto tenía reportes que luego se dan de baja, su estado puede cambiar de "con reportes" a "sin reportes".
- No se notifica específicamente que un reporte fue dado de baja; solo se notifica cambios de estado agregado del círculo.
- Si un reporte dado de baja se reactiva, el estado del contacto se recalcula con normalidad.

---

## 5. Interacción con anonimización

- El Círculo no accede al texto original ni al texto anonimizado de los reportes.
- Usa solo metadatos: estado, categoría, plataforma, ciudad, país, fecha.
- La anonimización de PII no afecta al Círculo porque este nunca muestra nombres, direcciones exactas ni textos.

---

## 6. Interacción con apelaciones (Spec 015 Fase C)

- Una apelación aceptada puede dar de baja reportes como `REPORTE_FALSO`.
- El Círculo reflejará esa baja en el estado del contacto.
- La pausa de visibilidad pública no afecta al Círculo: el usuario propietario del contacto sigue viendo el estado real dentro de la app.

---

## 7. Decisiones de diseño pendientes de confirmación

| Pregunta | Propuesta | Necesita OK del owner |
|---|---|---|
| ¿Umbral mínimo de agregación en vista agregada? | ≥ 2 contactos con reportes o ≥ 3 reportes | Sí |
| ¿Cooldown de notificación? | 24 horas por usuario | Sí |
| ¿Tope de contactos default? | 20 | Sí |
| ¿El tope es por contactos activos o totales? | Activos (los inhabilitados no cuentan) | Sí |
| ¿Preferencia de notificación por usuario como campo booleano o JSON? | Campo booleano `Usuario.notificacionesCirculo` | Sí |
| ¿Se envía email también cuando un contacto pasa de "en revisión" a "clasificado"? | Sí, si cambia el estado agregado del círculo | Sí |

---

## 8. Conclusión de diseño

El Círculo de Confianza no amplía la superficie de información expuesta por la plataforma. Reorganiza para el usuario autenticado la misma información que ya obtiene de `/api/consulta`, agrega una notificación ciego y aplica controles anti-abuso (tope, rate limit, auditoría, umbrales de agregación).

**Próximo paso:** aprobación del owner de este diseño antes de generar `tasks.md` y escribir código.

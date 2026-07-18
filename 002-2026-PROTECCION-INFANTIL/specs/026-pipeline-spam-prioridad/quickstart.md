> # Quickstart — Pipeline de spam + prioridad + reintentos

## Escenario A: Reporte real no es marcado como spam por contenido

**Prerrequisitos**: Heurística de contenido eliminada; IA con RAG entrenado.

1. Crear reporte anónimo con texto real:
```json
{
  "identificador": "3001112222",
  "plataforma": "whatsapp",
  "texto": "Este usuario le escribió a mi hija ofreciéndole regalos si le enviaba fotos."
}
```

2. Esperar procesamiento.

**Validación**: El reporte se clasifica como `OFRECIMIENTO_REGALOS` (no `SPAM`) y pasa a `CLASIFICADO`.

**Esperado**: Reporte real no se bloquea por heurística de contenido.

---

## Escenario B: Reporte de spam va a revisión humana

**Prerrequisitos**: IA detecta spam.

1. Crear reporte con texto claramente spam:
```json
{
  "identificador": "3009998888",
  "plataforma": "whatsapp",
  "texto": "Compra relojes baratos viagra cripto dinero fácil 100% gratis"
}
```

2. Esperar procesamiento.

**Validación**:
- `ClasificacionIA.categoria = SPAM` con `confianza >= umbral_spam`.
- `Reporte.estado = POSIBLE_SPAM` (o `REVISION_MANUAL`).
- Aparece en `GET /api/admin/spam/pendientes`.

**Esperado**: Spam no se autodestruye; queda en revisión.

---

## Escenario C: Operador marca spam como válido

**Prerrequisitos**: Reporte en `POSIBLE_SPAM` asignado a operador.

1. Operador revisa y decide que es un reporte real mal clasificado.
2. Llamar `POST /api/admin/spam/[id]/resolver` con `{ "esSpam": false, "categoria": "OTRO" }`.

**Validación**:
- Reporte pasa a `CLASIFICADO` con categoría `OTRO`.
- Se registra transición en `TransicionReporte`.

**Esperado**: `200`.

---

## Escenario D: Operador confirma spam

**Prerrequisitos**: Reporte en `POSIBLE_SPAM`.

1. Llamar `POST /api/admin/spam/[id]/resolver` con `{ "esSpam": true }`.

**Validación**:
- Reporte se da de baja con `motivoBaja = RETIRO_LIMPIEZA` (o estado final definido).
- Se registra en `DatasetEntrenamiento` como ejemplo de spam (`clasificacionCorrecta = SPAM`, `fuente = spam_revisado`).

**Esperado**: `200`.

---

## Escenario E: Prioridad alta para autenticados

**Prerrequisitos**: Cola con varios reportes pendientes.

1. Crear reporte anónimo y reporte autenticado casi simultáneamente.

**Validación**: El reporte autenticado (`esAnonimo=false`) se procesa antes o con prioridad mayor en la cola.

**Esperado**: `prioridadAlta = true` para autenticados.

---

## Escenario F: Anónimo con keyword de alto riesgo sube a prioridad alta

**Prerrequisitos**: Keywords de alto riesgo configurados.

1. Crear reporte anónimo con texto que incluya una keyword de alto riesgo (ej. "secuestro", "doxing").

**Validación**:
- `Reporte.keywordsDetectadas` incluye la keyword.
- `Reporte.prioridadAlta = true`.

**Esperado**: Se procesa antes que otros anónimos.

---

## Escenario G: Historial de reintentos visible para operador

**Prerrequisitos**: Reporte que falló procesamiento 2 veces antes de llegar a operador.

1. Operador abre detalle del caso.
2. Verifica sección "Historial de intentos".

**Validación**: Muestra 2 intentos con fecha/hora y error de cada uno.

**Esperado**: Datos obtenidos de `ReintentoReporte`.

---

## Escenario H: Heurística solo frena volumen, no contenido

**Prerrequisitos**: Rate-limit configurado.

1. Enviar 10 reportes desde el mismo fingerprint en 1 minuto.

**Validación**:
- Los primeros N reportes se aceptan.
- Los siguientes reciben `429` por rate limit (volumen).
- Ninguno es rechazado por "no menciona palabras de una lista".

**Esperado**: Protección contra ráfagas sin juicio de contenido.

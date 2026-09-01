# Contract · `GET/POST /api/padre/expedientes/[id]/analisis`

## Autoridad

- Sesión: PARENT dueña del expediente (verificada vía cookie de sesión).
- Cualquier otro rol / no autenticado: `403 FORBIDDEN`.
- Expediente inexistente o no pertenece al padre: `404 NOT_FOUND`.

---

## `GET`

Devuelve el análisis vigente más el estado actual de la cadena y de la cola.

### Response 200 (JSON)

```jsonc
{
  "vigente": {
    "versionSecuencial": 3,
    "texto": "Se observa una concentración de contactos entre 9 y 11 p. m.…",
    "corteN": 5,
    "categoriaDominanteLabel": "Contacto insistente",
    "generadoEn": "2026-08-31T16:12:00-05:00",
    "guiaAccion": {
      "tituloEmocional": "Qué puedes hacer ahora",
      "pasos": [ /* pasos publicados de GuiaAccionCategoria */ ]
    }
  } | null,        // null si nunca hubo análisis publicado

  "hashActual": "a1b2c3…",  // hash calculado ahora sobre las 3 columnas del Expediente
  "coincide": true,          // hashActual === vigente.hashCadena — camino barato
  "hechosNuevosDesde": 0,    // numEventos actual - vigente.corteN (siempre ≥ 0)

  "estado": "PUBLICADO" | "GENERANDO" | "FALLIDO" | "SIN_ANALISIS",
  "cola": {                  // presente solo si estado = GENERANDO
    "posicion": 2,           // hay 2 jobs por delante (incluye el mío)
    "estimadoSeg": 180       // posicion * padre.analisis.tiempo_estimado_seg
  } | null,
  "colaLlena": false,        // true si la cola alcanzó padre.analisis.tope_fila
                             // y no se pudo encolar → el UI muestra
                             // "La cola está llena — vuelve a intentar…"

  "cooldown": {              // control de "Actualizar"
    "puedeActualizar": false,
    "faltanSeg": 210
  }
}
```

### Comportamiento (side-effects — sí, GET encola)

- Si el expediente tiene ≥ 1 hecho analizable Y (`vigente == null` O
  `!coincide` O el vigente es más viejo que `padre.analisis.ttl_horas`) Y
  no hay job vivo con `(expedienteId, hashActual)` Y la cola no supera
  `padre.analisis.tope_fila` → **encola UN job** con `disparador: "APERTURA"`.
- Si la cola está llena, devuelve `estado="SIN_ANALISIS"` (o el vigente) con
  bandera `colaLlena: true` para que el UI muestre *"La cola está llena — vuelve
  a intentar en unos minutos"*.

**Nota**: normalmente un GET no muta. Acá lo hacemos porque el brief dice
"al abrir el expediente" el sistema pregunta y encola. El efecto es
IDEMPOTENTE por `(expedienteId, hashActual)` a nivel de cola y modelo, así
que dos GETs seguidos no generan dos jobs.

### Códigos

| Código | Cuándo |
|--------|--------|
| 200    | Éxito. |
| 401    | Sin sesión. |
| 403    | Sesión no PARENT o no dueña del expediente. |
| 404    | Expediente no existe o no pertenece al padre. |
| 500    | Error interno (no revela detalles). |

---

## `POST` (Actualizar análisis a mano)

### Request

Body vacío. La acción se deriva de la sesión + el `id` de la ruta.

### Response 200

```jsonc
// Caso A: se encoló un job nuevo
{
  "encolado": true,
  "estado": "GENERANDO",
  "cola": { "posicion": 1, "estimadoSeg": 90 }
}

// Caso B: cadena no cambió → no gasta modelo
{
  "encolado": false,
  "motivo": "ya_al_dia",
  "cooldownReiniciadoSeg": 300
}

// Caso C: cool-down activo
{
  "encolado": false,
  "motivo": "cooldown",
  "faltanSeg": 240
}

// Caso D: cola llena
{
  "encolado": false,
  "motivo": "cola_llena",
  "topeFila": 50
}
```

### Reglas

- FR-018: mientras `now() - vigente.generadoEn < cooldown_min`, devuelve
  caso C sin evaluar el hash.
- FR-019: cool-down cumplido + hash coincide → caso B, **reinicia** el
  cool-down.
- FR-020: cool-down cumplido + hash NO coincide + cola con espacio →
  caso A (encola con `disparador: "ACTUALIZAR"`).
- FR-008-ter: cola llena → caso D.

### Códigos

| Código | Cuándo |
|--------|--------|
| 200    | Cualquiera de los 4 casos. |
| 401 / 403 / 404 | Igual que GET. |
| 500    | Error interno. |

# Contract: Simulación de carga (entrada ampliada)

**Spec**: [specs/071-correccion-fidelidad-simulacion-070/spec.md](../spec.md)

**Date**: 2026-07-20

---

## Overview

Este documento describe los cambios en el formato de entrada de la simulación para hacerlo idéntico al formulario anónimo de reportes. No se crean nuevos endpoints; se actualiza el contenido esperado por el endpoint existente `POST /api/admin/ia/simulaciones`.

---

## Endpoint afectado

- `POST /api/admin/ia/simulaciones` (existente desde Spec 070)
  - El body no cambia: sigue siendo `{ modelo, archivo, formato }`.
  - El contenido de `archivo` ahora debe incluir los campos reales de un reporte anónimo.

---

## Formato CSV

### Cabecera obligatoria

```csv
texto,plataforma,identificador,fechaIncidente,ciudad,pais
```

### Cabecera completa (con campos opcionales)

```csv
texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada
```

### Reglas

- `texto`: string, 20-5000 caracteres.
- `plataforma`: string, no vacío, debe coincidir con la clave de una `Plataforma` existente en BD.
- `identificador`: string, 3-100 caracteres, único dentro del set de la corrida.
- `fechaIncidente`: string en formato ISO 8601 datetime; la fecha no puede ser futura.
- `ciudad`: string, 1-100 caracteres, no vacío.
- `pais`: string, 1-100 caracteres, no vacío.
- `edadVictima`: entero opcional, 0-120. Si viene vacío, se guarda como null.
- `categoriaEsperada`: string opcional, máximo 100 caracteres. Solo se usa para medir aciertos; no se pasa al modelo.

### Ejemplo

```csv
texto,plataforma,identificador,fechaIncidente,ciudad,pais,edadVictima,categoriaEsperada
"Este es un texto de prueba con más de veinte caracteres",whatsapp,contacto_001,2026-01-15T10:00:00Z,Bogotá,Colombia,14,ACOSO
"Otro texto de prueba válido",instagram,usuario_002,2026-02-20T15:30:00Z,Medellín,Colombia,12,CIBERBULLYING
"Caso sin edad ni categoría esperada",tiktok,nick_003,2026-03-10T08:00:00Z,Cali,Colombia,,
```

---

## Formato JSON

### Estructura

```json
[
  {
    "texto": "string (20-5000 chars)",
    "plataforma": "string",
    "identificador": "string (3-100 chars)",
    "fechaIncidente": "ISO 8601 datetime no futura",
    "ciudad": "string (1-100 chars)",
    "pais": "string (1-100 chars)",
    "edadVictima": 14,
    "categoriaEsperada": "string (opcional)"
  }
]
```

### Reglas

- El JSON debe ser un array de objetos.
- Cada objeto se valida con las mismas reglas que el CSV.
- `edadVictima` y `categoriaEsperada` son opcionales.
- Si `edadVictima` se omite, se guarda como null.

### Ejemplo

```json
[
  {
    "texto": "Este es un texto de prueba con más de veinte caracteres",
    "plataforma": "whatsapp",
    "identificador": "contacto_001",
    "fechaIncidente": "2026-01-15T10:00:00Z",
    "ciudad": "Bogotá",
    "pais": "Colombia",
    "edadVictima": 14,
    "categoriaEsperada": "ACOSO"
  }
]
```

---

## Errores de validación

- `400 Bad Request` con detalle por línea/índice cuando un caso no cumple las reglas.
- El mensaje indica el índice (línea del CSV o posición del array JSON), el campo y el mensaje de error.
- Ejemplo de respuesta:

```json
{
  "ok": false,
  "errores": [
    { "indice": 3, "campo": "texto", "mensaje": "El texto debe tener al menos 20 caracteres" },
    { "indice": 5, "campo": "fechaIncidente", "mensaje": "La fecha del incidente no puede ser futura" }
  ],
  "mensaje": "Se encontraron 2 errores de validación"
}
```

---

## Cambios respecto al Spec 070

| Aspecto | Spec 070 | Spec 071 |
|---------|----------|----------|
| Campos por caso | `texto`, `plataforma`, `identificador`, `categoriaEsperada` | `texto`, `plataforma`, `identificador`, `fechaIncidente`, `ciudad`, `pais`, `edadVictima`, `categoriaEsperada` |
| `fechaIncidente` | No existía; se usaba `new Date()` | Obligatorio, valor real del caso |
| `ciudad` / `pais` | No existían; se usaba `"Simulación"` | Obligatorios, valores reales del caso |
| `edadVictima` | No existía | Opcional, 0-120 |
| Formato legacy | Aceptado | Rechazado con mensaje claro |
| Fallo de un caso | Detenía la corrida con `FALLIDA` | Se registra y continúa con los demás |

---

## Compatibilidad

- No se modifica el modelo de datos `Reporte`, `SimulacionRun` ni `SimulacionReporte`.
- El endpoint `POST /api/admin/ia/simulaciones` no cambia de URL ni de estructura de body; solo cambia el contenido esperado de `archivo`.
- El override de modelo por job de pg-boss se mantiene sin cambios.

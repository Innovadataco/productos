# Quickstart — Spec 082: tab fusionado Playground + corrección I-05

**Propósito**: validar en `:5005` que el tab "Playground" muestra la configuración de modelos arriba y el sandbox abajo, sin pérdida funcional, y que la URL de Ollama carga y persiste (I-05).

## Prerrequisitos

- App corriendo: `./scripts/dev-restart.sh` (queda en `:5005` con `-H 0.0.0.0`).
- Usuario ADMIN del seed: `soporte@innovadataco.com` / `Admin123!Test`.
- Ollama corriendo en `http://localhost:11434` (para "Probar conexión" y listado de modelos).

## A. Fusión de tabs (US1/US2)

1. Login como ADMIN → `/dashboard/admin/ia`.
2. La navegación muestra 4 tabs: **Documentación, Playground, Eval, Configuración** (sin "Modelos").
3. Tab "Playground": arriba las secciones de configuración (URL de Ollama, Modelo de clasificación, Modelos de embedding detectados); debajo el sandbox (overrides, ejecutar, resultados y trazas).
4. Recorrido funcional (FR-003):
   - "Probar conexión" → mensaje de conexión OK con conteo de modelos.
   - Selector "Modelo activo" → elegir modelo → "Guardar como activo" → "Guardado".
   - "Probar con este modelo" → navega a `?tab=playground&modelo_clasificacion=<modelo>` y el sandbox queda con ese override.
   - Ejecutar una clasificación en el sandbox → resultados y trazas como antes.
5. URL antigua `?tab=modelos` → cae en el tab por defecto (Documentación) sin romperse.

## B. Corrección I-05 (US3)

1. Con ~103 parámetros en BD, abrir el tab "Playground": el campo "URL base de Ollama" muestra `http://localhost:11434` (valor persistido), sin escribir nada.
2. "Guardar URL" y "Probar conexión" están habilitados al cargar.
3. Cambiar la URL y pulsar "Guardar URL" → mensaje "Guardado"; recargar la página → el campo conserva el valor (persistencia vía PATCH, semántica intacta).

### Verificación por API (equivalente, usada en el cierre)

```bash
# login y cookie
curl -c /tmp/pi-cookies.txt -X POST :5005/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"soporte@innovadataco.com","password":"Admin123!Test"}'

# I-05: el endpoint por clave devuelve la URL persistida
curl -b /tmp/pi-cookies.txt :5005/api/config/parametros/system.ollama_base_url
# → { "clave": "system.ollama_base_url", "valor": "http://localhost:11434", ... }

# la página ya no expone el tab "Modelos"
curl -b /tmp/pi-cookies.txt ":5005/dashboard/admin/ia?tab=playground" | grep -c "tab=modelos"
# → 0
```

## C. Gate de calidad

```bash
npm run lint && npm run test && npm run build && npx tsc --noEmit
./scripts/dev-restart.sh
```

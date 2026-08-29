> # Quickstart — SPEC-235 · Guías de acción parametrizables

## Escenario A: Admin crea una guía en borrador

**Prerrequisitos**: Admin autenticado.

1. Llamar `POST /api/admin/guias-accion` con:

```json
{
  "categoria": "GROOMING",
  "tituloEmocional": "Respira. Estás haciendo lo correcto al buscar ayuda.",
  "subtitulo": "Esto puede sentirse abrumador, pero hay pasos claros que puedes seguir ahora.",
  "categoriaBadgeTexto": "Grooming",
  "pasosJson": [
    {
      "orden": 1,
      "tipo": "TRANQUILIDAD",
      "titulo": "Tranquilidad primero",
      "descripcion": "Habla con el menor sin juzgar. Recolecta captures y conversaciones."
    },
    {
      "orden": 2,
      "tipo": "ATENCION",
      "titulo": "No bloquees el contacto todavía",
      "descripcion": "Bloquear puede alertar al agresor y borrar evidencia. Silencia las notificaciones y cambia contraseñas."
    },
    {
      "orden": 3,
      "tipo": "ACCION",
      "titulo": "Cambia contraseñas y revisa privacidad",
      "descripcion": "Actualiza claves, activa 2FA y revisa quién puede ver perfiles."
    },
    {
      "orden": 4,
      "tipo": "URGENCIA",
      "titulo": "Denuncia ante autoridad",
      "descripcion": "Contacta la Línea 141 ICBF, CAI Virtual o Te Protejo. Solo una autoridad puede ordenar el bloqueo."
    }
  ],
  "calloutTitulo": "¿Por qué no bloquear de inmediado?",
  "calloutTexto": "Bloquear al contacto puede alertar al agresor y hacer que destruya evidencia. Preserva todo y deja el bloqueo a la autoridad.",
  "botonesAccionJson": [
    {
      "tipo": "url",
      "texto": "Línea 141 ICBF",
      "subtexto": "Atención gratuita 24/7",
      "url": "https://www.icbf.gov.co/linea-141",
      "urgente": true
    },
    {
      "tipo": "url",
      "texto": "CAI Virtual",
      "subtexto": "Denuncia ante Policía",
      "url": "https://www.policia.gov.co/denuncia-virtual",
      "primario": true
    },
    {
      "tipo": "tel",
      "texto": "Te Protejo",
      "subtexto": "Línea de denuncia",
      "tel": "141",
      "secundario": true
    }
  ],
  "piePagina": "Contenido preliminar · pendiente revisión psicólogo+jurídico · si la situación es inmediata, llama a emergencias."
}
```

**Validación**: se crea fila con `estado = BORRADOR`, `versionSecuencial = 1`.

**Esperado**: `201` con el id de la guía.

---

## Escenario B: Admin edita el borrador

**Prerrequisitos**: Guía en `BORRADOR`.

1. Llamar `PATCH /api/admin/guias-accion/[id]` con los campos a cambiar:

```json
{
  "subtitulo": "Nuevo subtítulo corregido por el admin."
}
```

**Validación**: solo se actualizan campos permitidos; `estado` permanece `BORRADOR`.

**Esperado**: `200` con la guía actualizada.

---

## Escenario C: Admin envía la guía al comité

**Prerrequisitos**: Guía en `BORRADOR`.

1. Llamar `POST /api/admin/guias-accion/[id]/enviar-comite`.

**Validación**:
- `estado` pasa a `PENDIENTE_APROBACION_COMITE`.
- Se registra `AuditLog` con `GUIA_ACCION_ENVIADA_COMITE`.

**Esperado**: `200`.

---

## Escenario D: Comité aprueba la guía (multi-miembro)

**Prerrequisitos**: Guía en `PENDIENTE_APROBACION_COMITE`; `padre.comite.miembros_minimos_aprobacion = 2`; dos miembros `COMITE_VALIDACION` activos.

1. Miembro 1 llama `POST /api/admin/comite/guias-accion/[id]/aprobar`.

**Validación**:
- Se añade voto a `aprobadaPorComiteJson`.
- La guía permanece `PENDIENTE_APROBACION_COMITE`.

**Esperado**: `200` con estado pendiente.

2. Miembro 2 llama `POST /api/admin/comite/guias-accion/[id]/aprobar`.

**Validación**:
- Se alcanza el umbral.
- La guía pasa a `ACTIVA`.
- Se setea `publicadaEn`.
- Cualquier guía `ACTIVA` anterior de `GROOMING` pasa a `REEMPLAZADA` con `reemplazadaEn`.

**Esperado**: `200` con estado `ACTIVA`.

---

## Escenario E: Comité rechaza la guía

**Prerrequisitos**: Guía en `PENDIENTE_APROBACION_COMITE`.

1. Un miembro del comité llama `POST /api/admin/comite/guias-accion/[id]/rechazar` con:

```json
{
  "motivo": "El paso 2 contradice la recomendación forense vigente."
}
```

**Validación**:
- `estado` vuelve a `BORRADOR`.
- `aprobadaPorComiteJson` se limpia.
- Se registra `AuditLog` con `GUIA_ACCION_RECHAZADA`.

**Esperado**: `200`.

---

## Escenario F: Consulta pública de la guía activa

**Prerrequisitos**: Guía `ACTIVA` para `GROOMING`.

1. Llamar `GET /api/publico/guia-accion/categoria/GROOMING` sin autenticación.

**Validación**: devuelve solo campos públicos de la guía `ACTIVA`.

**Esperado**: `200`.

---

## Escenario G: Intento de consultar guía no activa

**Prerrequisitos**: Guía en `BORRADOR` para `SEXTORSION`.

1. Llamar `GET /api/publico/guia-accion/categoria/SEXTORSION`.

**Validación**: el endpoint público filtra por `estado = ACTIVA`.

**Esperado**: `404`.

---

## Escenario H: Admin previsualiza un borrador

**Prerrequisitos**: Guía en `BORRADOR`.

1. Llamar `GET /api/admin/guias-accion/[id]/preview`.

**Validación**: devuelve el shape público de la guía, más `estado` y `versionSecuencial` para contexto admin.

**Esperado**: `200`.

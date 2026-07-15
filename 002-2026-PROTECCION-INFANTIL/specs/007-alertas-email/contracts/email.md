# Contract: Email Alerts

## Internal API

### `enviarAlertaRevision(reporte: object): Promise<void>`

**Location**: `src/lib/email.ts`

**Input**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Reporte ID |
| `numeroSeguimiento` | `string \| null` | Número de seguimiento |
| `identificador` | `string` | Identificador reportado |
| `estado` | `string` | Estado final del reporte |

**Behavior**:

- Returns early if `alerts.admin.enabled` is `false`.
- Returns early if no active admins.
- Sends one email to all active admins.
- Body must include only `numeroSeguimiento`, `identificador`, `estado` and admin panel link.

---

### `enviarAlertaScoreCritico(reporte: object): Promise<void>`

**Location**: `src/lib/email.ts`

**Input**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Reporte ID |
| `identificador` | `string` | Identificador reportado |
| `plataformaId` | `string` | Plataforma ID |
| `score` | `number` | Score calculado |
| `nivelRiesgo` | `string` | Nivel de riesgo (`CRITICO`) |

**Behavior**:

- Returns early if `alerts.critical_score.enabled` is `false`.
- Returns early if no active admins.
- Resolves platform name from `Plataforma` table.
- Sends one email to all active admins with score, risk level and platform.

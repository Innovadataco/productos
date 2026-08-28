"""Apache Superset config mínima · BI Fase 1."""
import os

# Clave de cifrado · obligatoria
SECRET_KEY = os.environ["SUPERSET_SECRET_KEY"]

# Base de datos de metadata de Superset
SQLALCHEMY_DATABASE_URI = (
    f"postgresql+psycopg2://{os.environ['SUPERSET_DB_USER']}:"
    f"{os.environ['SUPERSET_DB_PASSWORD']}@"
    f"{os.environ.get('SUPERSET_DB_HOST', 'bi-superset-db')}:"
    f"{os.environ.get('SUPERSET_DB_PORT', '5432')}/"
    f"{os.environ.get('SUPERSET_DB_NAME', 'superset')}"
)

# Zona horaria Colombia
BABEL_DEFAULT_LOCALE = "es"
BABEL_DEFAULT_TIMEZONE = "America/Bogota"

# Sin inscripción anónima (solo admin Fase 1)
PUBLIC_ROLE_LIKE = None
GUEST_ROLE_NAME = "Public"

# Idioma
DEFAULT_FEATURE_FLAGS = {
    "ENABLE_TEMPLATE_PROCESSING": False,
    "ALERT_REPORTS": False,
}

# Configuración básica de seguridad
WTF_CSRF_ENABLED = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"

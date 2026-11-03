import os
import psycopg
from pgvector.psycopg import register_vector
from dotenv import load_dotenv

load_dotenv()

_conn = None


def get_db_connection():
    """Returns a reusable PostgreSQL connection with pgvector registered."""
    global _conn
    host = os.getenv("DB_HOST", "localhost")
    port = int(os.getenv("DB_PORT", "5432"))
    dbname = os.getenv("DB_NAME", "ai_scam_shield")
    user = os.getenv("DB_USER", "macbook")
    password = os.getenv("DB_PASSWORD", None)

    conn_kwargs = {
        "host": host,
        "port": port,
        "dbname": dbname,
        "user": user,
    }
    if password:
        conn_kwargs["password"] = password

    try:
        if _conn is None or _conn.closed:
            _conn = psycopg.connect(**conn_kwargs)
            register_vector(_conn)
    except Exception:
        # Retry reconnecting once on failure
        _conn = psycopg.connect(**conn_kwargs)
        register_vector(_conn)

    return _conn

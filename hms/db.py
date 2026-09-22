"""
Engine / session setup.

SQLite does not enforce foreign key constraints by default; we turn it on
per-connection via a PRAGMA so that referential integrity (ON DELETE
behaviour, FK violations) is actually enforced, matching the "real FK
constraints" requirement even on the default SQLite engine.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager

from hms.config import DATABASE_URL

engine = create_engine(DATABASE_URL, echo=False, future=True)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


@contextmanager
def session_scope():
    """Provide a transactional scope with automatic rollback on error."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Create all tables (idempotent)."""
    from hms.models import base  # noqa: F401 ensures all models are imported
    base.Base.metadata.create_all(bind=engine)

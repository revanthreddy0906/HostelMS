"""
Pytest fixtures: an isolated in-memory SQLite DB per test, with foreign_keys
pragma enabled so referential integrity is actually exercised. Every test
runs against the real service/repository layer (no mocking of the DB) --
only PaymentGatewayService/NotificationService are the documented mocks.
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from hms.models.base import Base
from hms.models import models  # noqa: F401 ensure models are registered


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)

    @event.listens_for(eng, "connect")
    def _fk_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture()
def session(engine):
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    sess = SessionLocal()
    yield sess
    sess.close()

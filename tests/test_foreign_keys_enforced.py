"""Proves SQLite foreign_keys=ON is actually active, so FK violations raise."""
import pytest
from sqlalchemy.exc import IntegrityError

from hms.models.models import Student


def test_fk_violation_raises(session):
    # studentid FK -> student.studentid does not exist; inserting a Fee
    # referencing a non-existent studentid must fail if FKs are enforced.
    from hms.models.models import Fee
    from datetime import date

    fee = Fee(studentid=999999, amountdue=100.0, amountpaid=0.0, duedate=date.today(), paymentstatus="Pending")
    session.add(fee)
    with pytest.raises(IntegrityError):
        session.flush()
    session.rollback()

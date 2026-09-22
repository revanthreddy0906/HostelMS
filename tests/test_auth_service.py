import pytest
from hms.services.auth_service import AuthService, hash_password, verify_password
from hms.services.exceptions import AuthenticationError


def test_password_is_bcrypt_hashed_cost_12():
    hashed = hash_password("secret123")
    assert hashed.startswith("$2b$12$")
    assert verify_password("secret123", hashed)
    assert not verify_password("wrong", hashed)


def test_login_success_and_failure(session):
    auth = AuthService(session)
    auth.create_login("bob", "Passw0rd!", role="Staff")
    session.commit()

    user = auth.login("bob", "Passw0rd!")
    assert user.username == "bob"
    assert user.role == "Staff"

    with pytest.raises(AuthenticationError):
        auth.login("bob", "wrongpassword")

    with pytest.raises(AuthenticationError):
        auth.login("nosuchuser", "whatever")


def test_inactive_account_cannot_login(session):
    auth = AuthService(session)
    auth.create_login("locked_user", "Passw0rd!", role="Staff", status="INACTIVE")
    session.commit()
    with pytest.raises(AuthenticationError):
        auth.login("locked_user", "Passw0rd!")


def test_duplicate_username_rejected(session):
    auth = AuthService(session)
    auth.create_login("dup", "Passw0rd!", role="Staff")
    session.commit()
    with pytest.raises(AuthenticationError):
        auth.create_login("dup", "Other!", role="Staff")

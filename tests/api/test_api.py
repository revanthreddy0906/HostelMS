"""
API-level integration tests (pytest + FastAPI TestClient), mirroring the
existing service-level tests but exercised over real HTTP calls through the
FastAPI app. These complement, not replace, tests/test_*.py.
"""
from tests.api.conftest import auth_headers, get_token


def test_login_issues_valid_jwt(client, seeded):
    token = get_token(client, "admin", "Admin@12345")
    assert token
    me = client.get("/api/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    body = me.json()
    assert body["username"] == "admin"
    assert body["role"] == "Admin"


def test_login_wrong_password_rejected(client, seeded):
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert resp.status_code == 401


def test_student_forbidden_from_admin_only_endpoint(client, seeded):
    token = get_token(client, "student1", "Student@123")
    resp = client.get("/api/students", headers=auth_headers(token))
    assert resp.status_code == 403


def test_allocation_enforces_capacity(client, seeded):
    admin_token = get_token(client, "admin", "Admin@12345")
    headers = auth_headers(admin_token)

    # room has capacity 1; first manual allocation should succeed
    resp1 = client.post(
        "/api/allocations/manual",
        json={"studentid": seeded["studentid"], "roomid": seeded["roomid"]},
        headers=headers,
    )
    assert resp1.status_code == 200, resp1.text
    assert resp1.json()["status"] == "Active"

    # create a second student and try to allocate into the same, now-full room
    resp_student2 = client.post(
        "/api/students",
        json={
            "username": "student2",
            "plain_password": "Student@123",
            "rollnumber": "S2",
            "firstname": "Second",
            "lastname": "Student",
            "gender": "Male",
            "contactphone": "9000000002",
            "guardianphone": "9000000003",
            "dateofbirth": "2004-02-02",
        },
        headers=headers,
    )
    assert resp_student2.status_code == 201, resp_student2.text
    student2_id = resp_student2.json()["studentid"]

    resp2 = client.post(
        "/api/allocations/manual",
        json={"studentid": student2_id, "roomid": seeded["roomid"]},
        headers=headers,
    )
    assert resp2.status_code == 409
    assert "capacity" in resp2.json()["detail"].lower()


def test_leave_approve_gatepass_exit_entry_chain(client, seeded):
    student_token = get_token(client, "student1", "Student@123")
    admin_token = get_token(client, "admin", "Admin@12345")

    apply_resp = client.post(
        "/api/leaves",
        json={"startdate": "2026-01-01", "enddate": "2026-01-05", "reason": "Family function"},
        headers=auth_headers(student_token),
    )
    assert apply_resp.status_code == 201, apply_resp.text
    leaveid = apply_resp.json()["leaveid"]

    decide_resp = client.post(
        f"/api/leaves/{leaveid}/decide", json={"approve": True}, headers=auth_headers(admin_token)
    )
    assert decide_resp.status_code == 200, decide_resp.text
    leave = decide_resp.json()
    assert leave["status"] == "Approved"
    assert leave["gatepasscode"]

    qr_resp = client.get(f"/api/leaves/{leaveid}/gatepass-qr", headers=auth_headers(student_token))
    assert qr_resp.status_code == 200
    assert qr_resp.headers["content-type"] == "image/png"

    exit_resp = client.post(
        "/api/leaves/security/exit",
        json={"gatepass_code": leave["gatepasscode"], "studentid": seeded["studentid"]},
        headers=auth_headers(admin_token),
    )
    assert exit_resp.status_code == 200, exit_resp.text
    assert exit_resp.json()["exitlogged"] is not None

    entry_resp = client.post(
        "/api/leaves/security/entry",
        json={"gatepass_code": leave["gatepasscode"], "studentid": seeded["studentid"]},
        headers=auth_headers(admin_token),
    )
    assert entry_resp.status_code == 200, entry_resp.text
    assert entry_resp.json()["entrylogged"] is not None

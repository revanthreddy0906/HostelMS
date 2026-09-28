"""
Role-based read access over HTTP: staff-only lists are closed to students, "/me" endpoints
are student-only, and students can reach only their own per-student records.
"""
import pytest

from tests.api.conftest import auth_headers, get_token

STUDENT2 = {
    "username": "student2",
    "plain_password": "Student@123",
    "rollnumber": "S2",
    "firstname": "Other",
    "lastname": "Student",
    "gender": "Male",
    "contactphone": "9000000002",
    "guardianphone": "9000000003",
    "dateofbirth": "2004-02-02",
}


@pytest.fixture()
def actors(client, seeded):
    admin = auth_headers(get_token(client, "admin", "Admin@12345"))
    resp = client.post("/api/students", json=STUDENT2, headers=admin)
    assert resp.status_code == 201, resp.text
    resp = client.post(
        "/api/staff",
        json={
            "username": "security1",
            "plain_password": "Security@123",
            "fullname": "Security One",
            "designation": "Security",
            "assignedblock": seeded["hostelid"],
            "role": "Staff",
        },
        headers=admin,
    )
    assert resp.status_code == 201, resp.text
    return {
        "admin": admin,
        "warden": auth_headers(get_token(client, "warden1", "Warden@123")),
        "staff": auth_headers(get_token(client, "security1", "Security@123")),
        "student": auth_headers(get_token(client, "student1", "Student@123")),
        "student2": auth_headers(get_token(client, "student2", "Student@123")),
        "own_id": seeded["studentid"],
        "staffid": seeded["staffid"],
    }


STAFF_ONLY_READS = [
    "/api/leaves/pending",
    "/api/complaints",
    "/api/allocations",
    "/api/visitors/dashboard",
    "/api/attendance/date/2026-09-28",
    "/api/reports/occupancy.pdf",
    "/api/reports/leave-log.pdf",
    "/api/reports/complaint-timeline.pdf",
    "/api/reports/fee-collection.pdf?start=2026-01-01&end=2026-12-31",
]


@pytest.mark.parametrize("path", STAFF_ONLY_READS)
def test_student_forbidden_from_staff_only_reads(client, actors, path):
    assert client.get(path, headers=actors["student"]).status_code == 403


def test_student_forbidden_from_staff_record(client, actors):
    assert client.get(f"/api/staff/{actors['staffid']}", headers=actors["student"]).status_code == 403


@pytest.mark.parametrize("role", ["warden", "staff"])
@pytest.mark.parametrize("path", ["/api/fees/me", "/api/leaves/me", "/api/complaints/me", "/api/students/me"])
def test_me_endpoints_are_student_only(client, actors, role, path):
    # warden1's staffid equals student1's studentid, which is how these used to leak.
    assert client.get(path, headers=actors[role]).status_code == 403


@pytest.mark.parametrize(
    "template",
    [
        "/api/fees/student/{id}",
        "/api/leaves/student/{id}",
        "/api/visitors/student/{id}",
        "/api/allocations/student/{id}",
        "/api/students/{id}",
    ],
)
def test_student_reads_only_own_records(client, actors, template):
    own = template.format(id=actors["own_id"])
    assert client.get(own, headers=actors["student"]).status_code == 200
    assert client.get(own, headers=actors["student2"]).status_code == 403


def test_gatepass_qr_only_for_owner_and_staff(client, actors):
    resp = client.post(
        "/api/leaves",
        json={"startdate": "2026-12-01", "enddate": "2026-12-03", "reason": "Home"},
        headers=actors["student"],
    )
    assert resp.status_code == 201, resp.text
    leaveid = resp.json()["leaveid"]
    resp = client.post(f"/api/leaves/{leaveid}/decide", json={"approve": True}, headers=actors["warden"])
    assert resp.status_code == 200, resp.text

    qr = f"/api/leaves/{leaveid}/gatepass-qr"
    assert client.get(qr, headers=actors["student"]).status_code == 200
    assert client.get(qr, headers=actors["staff"]).status_code == 200
    assert client.get(qr, headers=actors["student2"]).status_code == 403


def test_fee_receipt_only_for_owner_and_fee_staff(client, actors, seeded):
    admin = actors["admin"]
    assert client.post(
        "/api/allocations/manual", json={"studentid": actors["own_id"], "roomid": seeded["roomid"]}, headers=admin
    ).status_code == 200
    assert client.post(
        "/api/fees/structure", json={"roomtype": "Non-AC", "amount": 25000, "semester": "Sem1"}, headers=admin
    ).status_code == 200
    fees = client.post("/api/fees/generate", json={"semester": "Sem1", "duedate": "2026-12-31"}, headers=admin)
    assert fees.status_code == 200, fees.text
    receipt = f"/api/reports/receipt/{fees.json()[0]['feeid']}.pdf"

    assert client.get(receipt, headers=actors["student"]).status_code == 200
    assert client.get(receipt, headers=actors["staff"]).status_code == 200
    assert client.get(receipt, headers=actors["student2"]).status_code == 403


ALLOWED_READS = [
    ("warden", "/api/leaves/pending"),
    ("warden", "/api/attendance/alerts"),
    ("warden", "/api/attendance/date/2026-09-28"),
    ("warden", "/api/students"),
    ("warden", "/api/complaints"),
    ("warden", "/api/visitors/dashboard"),
    ("warden", "/api/allocations"),
    ("warden", "/api/reports/occupancy.pdf"),
    ("staff", "/api/visitors/dashboard"),
    ("staff", "/api/complaints"),
    ("staff", "/api/attendance/date/2026-09-28"),
    ("staff", "/api/students"),
    ("student", "/api/fees/me"),
    ("student", "/api/leaves/me"),
    ("student", "/api/complaints/me"),
    ("student", "/api/students/me"),
    ("student", "/api/rooms"),
    ("student", "/api/hostels"),
    ("admin", "/api/leaves/pending"),
    ("admin", "/api/allocations"),
]


@pytest.mark.parametrize("role,path", ALLOWED_READS)
def test_role_reads_the_frontend_relies_on(client, actors, role, path):
    resp = client.get(path, headers=actors[role])
    assert resp.status_code == 200, f"{role} {path}: {resp.status_code} {resp.text}"


def test_me_endpoints_return_callers_own_records(client, actors):
    me = client.get("/api/students/me", headers=actors["student2"]).json()
    assert me["rollnumber"] == "S2"


def test_student_can_pay_only_own_fee_and_not_overpay(client, actors, seeded):
    admin = actors["admin"]
    assert client.post(
        "/api/allocations/manual", json={"studentid": actors["own_id"], "roomid": seeded["roomid"]}, headers=admin
    ).status_code == 200
    assert client.post(
        "/api/fees/structure", json={"roomtype": "Non-AC", "amount": 25000, "semester": "Sem1"}, headers=admin
    ).status_code == 200
    feeid = client.post("/api/fees/generate", json={"semester": "Sem1", "duedate": "2026-12-31"}, headers=admin).json()[0]["feeid"]

    assert client.post(f"/api/fees/{feeid}/pay", json={"amount": 100}, headers=actors["student2"]).status_code == 403
    assert client.post(f"/api/fees/{feeid}/pay", json={"amount": 30000}, headers=actors["student"]).status_code in (400, 422)
    paid = client.post(f"/api/fees/{feeid}/pay", json={"amount": 25000}, headers=actors["student"])
    assert paid.status_code == 200, paid.text
    assert paid.json()["paymentstatus"] == "Paid"

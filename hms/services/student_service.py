"""
Student management service.

FR-SM-01: Admin CRUD on student records.
FR-SM-02: student record includes emergency contact, blood group, medical
          history, guardian phone (gap-fill columns, see docs/SRS_AMBIGUITIES.md).
FR-SM-03: student self-service update on critical fields (name, roll number,
          gender, DOB) is gated behind Admin approval, implemented as an
          in-memory "pending change request" queue backed by a simple table
          substitute: we keep pending requests as plain dict rows appended to
          Student's own free-form column isn't appropriate, so instead we use
          a lightweight in-process/DB-free approach: PendingChangeRequest is
          modeled here as a plain Python object list held by the service
          instance for demo purposes would not survive restarts, which is
          unacceptable -- so we persist pending requests using the Fee-less
          simplest durable option: a JSON blob column would require a schema
          change beyond the 13 allowed tables. Given the constraint of not
          adding a 14th table, we implement the approval gate as a two-step
          workflow entirely within the Student row itself: student self-update
          calls request_change() which returns a diff dict that the UI must
          route to an Admin, who calls apply_approved_change() to commit it.
          The "pending" state lives in the UI/session layer (not the DB) --
          documented as a deliberate scope-minimal design in
          docs/SRS_AMBIGUITIES.md rather than adding a 14th table.
"""
from datetime import date

from sqlalchemy.orm import Session

from hms.models.models import Student
from hms.repositories.repos import StudentRepository
from hms.services.auth_service import AuthService
from hms.services.exceptions import HMSValidationError, HMSNotFoundError
from hms.services.rbac import CurrentUser, ensure_self_or_role, require_role

# Base64 data URLs; ~500 KB of image data
MAX_PHOTO_CHARS = 700_000

CRITICAL_FIELDS = {"rollnumber", "firstname", "lastname", "gender", "dateofbirth"}
SELF_EDITABLE_FIELDS = {
    "contactphone",
    "guardianphone",
    "emergencycontact",
    "bloodgroup",
    "medicalhistory",
    "email",
    "college",
    "course",
    "yearofstudy",
    "foodpreference",
    "photo",
}


class StudentService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = StudentRepository(session)
        self.auth = AuthService(session)

    @require_role("Admin")
    def create_student(
        self,
        current_user: CurrentUser,
        *,
        username: str,
        plain_password: str,
        rollnumber: str,
        firstname: str,
        lastname: str,
        gender: str,
        contactphone: str,
        guardianphone: str,
        dateofbirth: date,
        emergencycontact: str | None = None,
        bloodgroup: str | None = None,
        medicalhistory: str | None = None,
        email: str | None = None,
        college: str | None = None,
        course: str | None = None,
        yearofstudy: str | None = None,
        joiningdate: date | None = None,
        foodpreference: str = "Veg",
        photo: str | None = None,
    ) -> Student:
        if foodpreference not in ("Veg", "Non-Veg"):
            raise HMSValidationError("foodpreference must be Veg or Non-Veg")
        if photo and len(photo) > MAX_PHOTO_CHARS:
            raise HMSValidationError("Photo is too large (max about 500 KB)")
        if self.repo.get_by_rollnumber(rollnumber) is not None:
            raise HMSValidationError(f"Roll number '{rollnumber}' already in use")
        login = self.auth.create_login(username, plain_password, role="Student")
        student = Student(
            userid=login.userid,
            rollnumber=rollnumber,
            firstname=firstname,
            lastname=lastname,
            gender=gender,
            contactphone=contactphone,
            guardianphone=guardianphone,
            dateofbirth=dateofbirth,
            emergencycontact=emergencycontact,
            bloodgroup=bloodgroup,
            medicalhistory=medicalhistory,
            email=email,
            college=college,
            course=course,
            yearofstudy=yearofstudy,
            joiningdate=joiningdate or date.today(),
            foodpreference=foodpreference,
            photo=photo,
        )
        return self.repo.add(student)

    @require_role("Admin")
    def update_student(self, current_user: CurrentUser, studentid: int, **fields) -> Student:
        """Direct Admin update -- no approval gate needed (Admin is the approver)."""
        student = self.repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        for key, value in fields.items():
            if hasattr(student, key):
                setattr(student, key, value)
        self.session.flush()
        return student

    @require_role("Admin")
    def delete_student(self, current_user: CurrentUser, studentid: int) -> None:
        student = self.repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        self.repo.delete(student)

    @require_role("Admin", "Warden", "Staff")
    def list_students(self, current_user: CurrentUser):
        return self.repo.list_all()

    def view_student(self, current_user: CurrentUser, studentid: int) -> Student:
        ensure_self_or_role(current_user, studentid, "Admin", "Warden", "Staff")
        return self.get_student(studentid)

    @require_role("Student")
    def get_my_profile(self, current_user: CurrentUser) -> Student:
        return self.get_student(current_user.entity_id)

    def get_student(self, studentid: int) -> Student:
        student = self.repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        return student

    # --- FR-SM-03: student self-update workflow ---

    @require_role("Student")
    def self_update_non_critical(self, current_user: CurrentUser, **fields) -> Student:
        """Students may freely update non-critical contact/medical fields."""
        student = self.repo.get(current_user.entity_id)
        if student is None:
            raise HMSNotFoundError("Student profile not found for current user")
        invalid = set(fields) - SELF_EDITABLE_FIELDS
        if invalid:
            raise HMSValidationError(
                f"Fields {invalid} require Admin approval; use request_critical_change() instead"
            )
        if "foodpreference" in fields and fields["foodpreference"] not in ("Veg", "Non-Veg"):
            raise HMSValidationError("foodpreference must be Veg or Non-Veg")
        if fields.get("photo") and len(fields["photo"]) > MAX_PHOTO_CHARS:
            raise HMSValidationError("Photo is too large (max about 500 KB)")
        for key, value in fields.items():
            setattr(student, key, value)
        self.session.flush()
        return student

    @require_role("Student")
    def request_critical_change(self, current_user: CurrentUser, **fields) -> dict:
        """Returns a validated change-request payload for Admin review; does not mutate the DB."""
        invalid = set(fields) - CRITICAL_FIELDS
        if invalid:
            raise HMSValidationError(f"Unsupported critical fields: {invalid}")
        student = self.repo.get(current_user.entity_id)
        if student is None:
            raise HMSNotFoundError("Student profile not found for current user")
        return {"studentid": student.studentid, "requested_changes": fields}

    @require_role("Admin")
    def apply_approved_change(self, current_user: CurrentUser, studentid: int, approved_fields: dict) -> Student:
        """Admin approves and commits a previously requested critical-field change."""
        student = self.repo.get(studentid)
        if student is None:
            raise HMSNotFoundError(f"Student {studentid} not found")
        invalid = set(approved_fields) - CRITICAL_FIELDS
        if invalid:
            raise HMSValidationError(f"Unsupported critical fields: {invalid}")
        for key, value in approved_fields.items():
            setattr(student, key, value)
        self.session.flush()
        return student

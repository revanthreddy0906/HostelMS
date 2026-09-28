from datetime import date

from pydantic import BaseModel, ConfigDict


class StudentCreate(BaseModel):
    username: str
    plain_password: str
    rollnumber: str
    firstname: str
    lastname: str
    gender: str
    contactphone: str
    guardianphone: str
    dateofbirth: date
    emergencycontact: str | None = None
    bloodgroup: str | None = None
    medicalhistory: str | None = None
    email: str | None = None
    college: str | None = None
    course: str | None = None
    yearofstudy: str | None = None
    joiningdate: date | None = None
    foodpreference: str = "Veg"
    photo: str | None = None


class StudentUpdate(BaseModel):
    rollnumber: str | None = None
    firstname: str | None = None
    lastname: str | None = None
    gender: str | None = None
    contactphone: str | None = None
    guardianphone: str | None = None
    dateofbirth: date | None = None
    emergencycontact: str | None = None
    bloodgroup: str | None = None
    medicalhistory: str | None = None
    email: str | None = None
    college: str | None = None
    course: str | None = None
    yearofstudy: str | None = None
    foodpreference: str | None = None
    photo: str | None = None
    joiningdate: date | None = None


class StudentSelfUpdate(BaseModel):
    contactphone: str | None = None
    guardianphone: str | None = None
    emergencycontact: str | None = None
    bloodgroup: str | None = None
    medicalhistory: str | None = None
    email: str | None = None
    college: str | None = None
    course: str | None = None
    yearofstudy: str | None = None
    foodpreference: str | None = None
    photo: str | None = None


class CriticalChangeRequest(BaseModel):
    rollnumber: str | None = None
    firstname: str | None = None
    lastname: str | None = None
    gender: str | None = None
    dateofbirth: date | None = None


class ApproveChangeRequest(BaseModel):
    approved_fields: dict


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    studentid: int
    userid: int
    rollnumber: str
    firstname: str
    lastname: str
    gender: str
    contactphone: str
    guardianphone: str
    dateofbirth: date
    emergencycontact: str | None = None
    bloodgroup: str | None = None
    medicalhistory: str | None = None
    email: str | None = None
    college: str | None = None
    course: str | None = None
    yearofstudy: str | None = None
    joiningdate: date | None = None
    foodpreference: str = "Veg"
    photo: str | None = None
    residentstatus: str = "NEW"

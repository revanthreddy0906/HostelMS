from pydantic import BaseModel, ConfigDict


class StaffCreate(BaseModel):
    username: str
    plain_password: str
    fullname: str
    designation: str
    assignedblock: int
    role: str = "Staff"


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    staffid: int
    userid: int
    fullname: str
    designation: str
    assignedblock: int

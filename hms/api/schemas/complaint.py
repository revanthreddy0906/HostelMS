from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ComplaintCreate(BaseModel):
    category: str
    description: str


class ComplaintStatusUpdate(BaseModel):
    new_status: str


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    complaintid: int
    studentid: int
    category: str
    description: str
    status: str
    createdat: datetime
    assignedstaffid: int | None = None

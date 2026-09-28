from datetime import date, datetime

from pydantic import BaseModel


class ComplaintCreate(BaseModel):
    category: str
    description: str
    meal: str | None = None
    mealdate: date | None = None
    rating: int | None = None
    isanonymous: bool = False


class ComplaintStatusUpdate(BaseModel):
    new_status: str


class ComplaintOut(BaseModel):
    complaintid: int
    studentid: int | None = None  # hidden for anonymous complaints
    category: str
    description: str
    status: str
    createdat: datetime
    meal: str | None = None
    mealdate: date | None = None
    rating: int | None = None
    isanonymous: bool = False

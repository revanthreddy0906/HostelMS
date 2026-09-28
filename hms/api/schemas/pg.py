"""Schemas for the PG features: maintenance, food menu, AC billing, parent accommodation, announcements, dashboard."""
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class MaintenanceCreate(BaseModel):
    category: str
    description: str
    priority: str = "Medium"
    photo: str | None = None


class MaintenanceAssign(BaseModel):
    staffid: int


class MaintenanceStatusUpdate(BaseModel):
    new_status: str
    note: str | None = None


class MaintenanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    requestid: int
    studentid: int
    roomid: int | None = None
    category: str
    description: str
    priority: str
    status: str
    assignedstaffid: int | None = None
    photo: str | None = None
    resolutionnote: str | None = None
    createdat: datetime
    updatedat: datetime


class MenuDay(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    day: str
    breakfast: str
    lunch: str
    lunchnonveg: str | None = None
    dinner: str
    dinnernonveg: str | None = None
    fryums: bool = False


class MenuWeek(BaseModel):
    days: list[MenuDay]


class ACApprove(BaseModel):
    initialreading: float


class ACReadingCreate(BaseModel):
    roomid: int
    period: str
    currentreading: float


class ACReadingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    readingid: int
    roomid: int
    period: str
    previousreading: float
    currentreading: float
    rateperunit: float
    totalamount: float
    occupants: int
    recordedat: datetime


class ACRoom(BaseModel):
    roomid: int
    roomnumber: str
    hostelname: str
    floor: int
    acstatus: str
    occupants: int
    lastreading: float | None = None
    lastperiod: str | None = None


class ParentRoom(BaseModel):
    roomid: int
    roomnumber: str
    hostelname: str
    floor: int
    capacity: int
    staying: int


class GuestCreate(BaseModel):
    guestname: str
    relation: str
    studentid: int
    phone: str
    idproof: str
    roomid: int
    arrivaldate: date
    departuredate: date


class GuestStatus(BaseModel):
    status: str


class GuestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    guestid: int
    guestname: str
    relation: str
    studentid: int
    phone: str
    idproof: str
    roomid: int
    arrivaldate: date
    departuredate: date
    status: str


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    pinned: bool = False


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    announcementid: int
    title: str
    body: str
    pinned: bool
    createdat: datetime

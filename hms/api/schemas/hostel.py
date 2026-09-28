from pydantic import BaseModel, ConfigDict


class HostelCreate(BaseModel):
    hostelname: str
    gendertype: str
    totalrooms: int
    maintenancestatus: str = "OPERATIONAL"
    wardenstaffid: int | None = None


class HostelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    hostelid: int
    hostelname: str
    gendertype: str
    totalrooms: int
    maintenancestatus: str | None = None
    wardenstaffid: int | None = None


class AssignWardenRequest(BaseModel):
    staffid: int


class MaintenanceStatusRequest(BaseModel):
    status: str


class RoomCreate(BaseModel):
    hostelid: int
    roomnumber: str
    roomtype: str  # 3 Sharing / 4 Sharing / 5 Sharing / Pentahouse (ignored for parent rooms)
    floor: int = 1
    capacity: int | None = None  # required for Pentahouse and parent rooms
    purpose: str = "Student"
    monthlyrent: float | None = None  # Pentahouse only


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    roomid: int
    hostelid: int
    roomnumber: str
    floor: int
    capacity: int
    occupiedbeds: int
    roomtype: str
    monthlyrent: float
    acstatus: str
    purpose: str


class BedOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bedid: int
    roomid: int
    bednumber: int


class MapBed(BaseModel):
    bedid: int
    bednumber: int
    studentid: int | None = None
    studentname: str | None = None


class MapRoom(BaseModel):
    roomid: int
    roomnumber: str
    roomtype: str
    purpose: str
    capacity: int
    occupiedbeds: int
    monthlyrent: float
    acstatus: str
    beds: list[MapBed]


class MapFloor(BaseModel):
    floor: int
    rooms: list[MapRoom]


class MapHostel(BaseModel):
    hostelid: int
    hostelname: str
    gendertype: str
    floors: list[MapFloor]


class OccupancyRow(BaseModel):
    hostel: str
    floor: int
    room: str
    type: str
    purpose: str
    rent: float
    capacity: int
    occupied: int
    free: int

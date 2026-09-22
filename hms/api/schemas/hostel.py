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
    capacity: int
    roomtype: str


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    roomid: int
    hostelid: int
    roomnumber: str
    capacity: int
    occupiedbeds: int
    roomtype: str


class OccupancyRow(BaseModel):
    hostel: str
    room: str
    type: str
    capacity: int
    occupied: int
    free: int

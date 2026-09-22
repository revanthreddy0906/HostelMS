from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    userid: int
    username: str
    role: str
    entity_id: int | None = None


class ChangePasswordRequest(BaseModel):
    new_password: str


class CurrentUserResponse(BaseModel):
    userid: int
    username: str
    role: str
    entity_id: int | None = None

"""Generic thin CRUD repository base class."""
from typing import Generic, TypeVar, Type, Optional, List
from sqlalchemy.orm import Session

T = TypeVar("T")


class BaseRepository(Generic[T]):
    model: Type[T]

    def __init__(self, session: Session):
        self.session = session

    def get(self, id_value) -> Optional[T]:
        return self.session.get(self.model, id_value)

    def list_all(self) -> List[T]:
        return list(self.session.query(self.model).all())

    def add(self, obj: T) -> T:
        self.session.add(obj)
        self.session.flush()
        return obj

    def delete(self, obj: T) -> None:
        self.session.delete(obj)
        self.session.flush()

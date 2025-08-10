import uuid
from decimal import Decimal
from datetime import datetime
from typing import Any, Optional

from pydantic import EmailStr
from sqlalchemy import Column, DateTime, JSON, Numeric, text
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)
    projects: list["Project"] = Relationship(
        back_populates="owner", cascade_delete=True
    )


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Shared properties for Line Items (catalog of unit prices)
class LineItemBase(SQLModel):
    code: str | None = Field(default=None, max_length=50, index=True)
    description: str = Field(max_length=255)
    unit: str = Field(max_length=10)
    unit_price: Decimal


class LineItemCreate(LineItemBase):
    pass


class LineItemUpdate(LineItemBase):
    # All fields optional on update
    code: str | None = Field(default=None, max_length=50)  # type: ignore
    description: str | None = Field(default=None, max_length=255)  # type: ignore
    unit: str | None = Field(default=None, max_length=10)  # type: ignore
    unit_price: Decimal | None = None


class LineItem(LineItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # Ensure uniqueness at the DB level when provided
    code: str | None = Field(
        default=None, max_length=50, index=True, unique=True
    )
    # Ensure unit_price has fixed precision/scale NUMERIC(12,2)
    unit_price: Decimal = Field(sa_column=Column(Numeric(12, 2), nullable=False))
    # Timestamps managed by DB server defaults
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=text("now()")),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=text("now()"),
            onupdate=text("now()"),
        ),
    )


class LineItemPublic(LineItemBase):
    id: uuid.UUID


class LineItemsPublic(SQLModel):
    data: list[LineItemPublic]
    count: int


# Project model to persist saved budget state (as JSON)
class ProjectBase(SQLModel):
    name: str = Field(max_length=255)
    data: dict[str, Any]


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=255)  # type: ignore
    data: dict[str, Any] | None = None


class Project(ProjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    # Persist arbitrary JSON (PostgreSQL JSON/JSONB)
    data: dict[str, Any] = Field(sa_column=Column(JSON))
    owner: Optional["User"] = Relationship(back_populates="projects")
    created_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), server_default=text("now()")),
    )
    updated_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True),
            server_default=text("now()"),
            onupdate=text("now()"),
        ),
    )


class ProjectPublic(ProjectBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ProjectsPublic(SQLModel):
    data: list[ProjectPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)

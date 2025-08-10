import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    LineItem,
    LineItemCreate,
    LineItemPublic,
    LineItemsPublic,
    LineItemUpdate,
    Message,
)

router = APIRouter(prefix="/line-items", tags=["line_items"])  # /api/v1/line-items


@router.get("/", response_model=LineItemsPublic)
def read_line_items(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """Retrieve line items (catalog).
    - Everyone authenticated can list.
    """
    count_statement = select(func.count()).select_from(LineItem)
    count = session.exec(count_statement).one()
    statement = select(LineItem).offset(skip).limit(limit)
    items = session.exec(statement).all()
    return LineItemsPublic(data=items, count=count)


@router.get("/{id}", response_model=LineItemPublic)
def read_line_item(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """Get line item by ID."""
    obj = session.get(LineItem, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Line item not found")
    return obj


@router.post("/", response_model=LineItemPublic)
def create_line_item(
    *, session: SessionDep, current_user: CurrentUser, item_in: LineItemCreate
) -> Any:
    """Create new line item. Superusers only."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    # enforce unique code at app level too (DB also has unique index)
    if item_in.code:
        exists = session.exec(
            select(LineItem).where(LineItem.code == item_in.code)
        ).first()
        if exists:
            raise HTTPException(status_code=400, detail="Code already exists")
    obj = LineItem.model_validate(item_in)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.put("/{id}", response_model=LineItemPublic)
def update_line_item(
    *, session: SessionDep, current_user: CurrentUser, id: uuid.UUID, item_in: LineItemUpdate
) -> Any:
    """Update line item. Superusers only."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    obj = session.get(LineItem, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Line item not found")
    data = item_in.model_dump(exclude_unset=True)
    # handle unique code change
    new_code = data.get("code")
    if new_code and new_code != obj.code:
        exists = session.exec(select(LineItem).where(LineItem.code == new_code)).first()
        if exists:
            raise HTTPException(status_code=400, detail="Code already exists")
    obj.sqlmodel_update(data)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_line_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Message:
    """Delete a line item. Superusers only."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    obj = session.get(LineItem, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Line item not found")
    session.delete(obj)
    session.commit()
    return Message(message="Line item deleted successfully")

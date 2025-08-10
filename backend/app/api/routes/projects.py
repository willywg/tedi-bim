import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Project,
    ProjectCreate,
    ProjectPublic,
    ProjectsPublic,
    ProjectUpdate,
    Message,
)

router = APIRouter(prefix="/projects", tags=["projects"])  # /api/v1/projects


@router.get("/", response_model=ProjectsPublic)
def read_projects(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """Retrieve projects for current user. Superusers can see all."""
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Project)
        count = session.exec(count_statement).one()
        statement = select(Project).offset(skip).limit(limit)
        items = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count()).select_from(Project).where(Project.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Project)
            .where(Project.owner_id == current_user.id)
            .offset(skip)
            .limit(limit)
        )
        items = session.exec(statement).all()
    return ProjectsPublic(data=items, count=count)


@router.get("/{id}", response_model=ProjectPublic)
def read_project(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    """Get project by ID (only owner or superuser)."""
    obj = session.get(Project, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    if not current_user.is_superuser and (obj.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return obj


@router.post("/", response_model=ProjectPublic)
def create_project(
    *, session: SessionDep, current_user: CurrentUser, project_in: ProjectCreate
) -> Any:
    """Create new project owned by current user."""
    obj = Project.model_validate(project_in, update={"owner_id": current_user.id})
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.put("/{id}", response_model=ProjectPublic)
def update_project(
    *, session: SessionDep, current_user: CurrentUser, id: uuid.UUID, project_in: ProjectUpdate
) -> Any:
    """Update a project (only owner or superuser)."""
    obj = session.get(Project, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    if not current_user.is_superuser and (obj.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    data = project_in.model_dump(exclude_unset=True)
    obj.sqlmodel_update(data)
    session.add(obj)
    session.commit()
    session.refresh(obj)
    return obj


@router.delete("/{id}")
def delete_project(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Message:
    """Delete a project (only owner or superuser)."""
    obj = session.get(Project, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Project not found")
    if not current_user.is_superuser and (obj.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    session.delete(obj)
    session.commit()
    return Message(message="Project deleted successfully")

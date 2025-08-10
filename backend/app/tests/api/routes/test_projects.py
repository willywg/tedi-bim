import uuid
from typing import Any

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.tests.utils.user import authentication_token_from_email


def test_create_project_as_normal_user(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    data: dict[str, Any] = {
        "name": "Proyecto Test",
        "data": {"rows": [], "meta": {"version": 1}},
    }
    response = client.post(
        f"{settings.API_V1_STR}/projects/",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 200, response.text
    content = response.json()
    assert content["name"] == data["name"]
    assert content["data"]["meta"]["version"] == 1
    assert "id" in content
    assert "owner_id" in content


def test_read_projects_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/projects/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert "data" in content and isinstance(content["data"], list)
    assert "count" in content and isinstance(content["count"], int)


def test_project_owner_permissions(
    client: TestClient, db: Session, normal_user_token_headers: dict[str, str]
) -> None:
    # Create as user A (from fixture)
    create_resp = client.post(
        f"{settings.API_V1_STR}/projects/",
        headers=normal_user_token_headers,
        json={"name": "Owner A", "data": {}},
    )
    assert create_resp.status_code == 200, create_resp.text
    project = create_resp.json()

    # Authenticate as another user B
    other_headers = authentication_token_from_email(
        client=client, email="otheruser@example.com", db=db
    )

    # Read forbidden for non-owner (unless superuser)
    read_resp = client.get(
        f"{settings.API_V1_STR}/projects/{project['id']}", headers=other_headers
    )
    assert read_resp.status_code == 400
    assert read_resp.json()["detail"] == "Not enough permissions"

    # Update by owner OK
    update_resp = client.put(
        f"{settings.API_V1_STR}/projects/{project['id']}",
        headers=normal_user_token_headers,
        json={"name": "Owner A Updated"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["name"] == "Owner A Updated"

    # Delete forbidden for other user
    del_resp_forbidden = client.delete(
        f"{settings.API_V1_STR}/projects/{project['id']}", headers=other_headers
    )
    assert del_resp_forbidden.status_code == 400
    assert del_resp_forbidden.json()["detail"] == "Not enough permissions"

    # Delete by owner OK
    del_resp = client.delete(
        f"{settings.API_V1_STR}/projects/{project['id']}",
        headers=normal_user_token_headers,
    )
    assert del_resp.status_code == 200
    assert del_resp.json()["message"] == "Project deleted successfully"


def test_project_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/projects/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Project not found"

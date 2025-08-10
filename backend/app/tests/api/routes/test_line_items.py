import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings


def test_create_line_item_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {
        "code": f"PU-{uuid.uuid4().hex[:8]}",
        "description": "Item de prueba",
        "unit": "m3",
        "unit_price": "123.45",
    }
    response = client.post(
        f"{settings.API_V1_STR}/line-items/",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200, response.text
    content = response.json()
    assert content["code"] == data["code"]
    assert content["description"] == data["description"]
    assert content["unit"] == data["unit"]
    assert content["unit_price"] == data["unit_price"]
    assert "id" in content


def test_create_line_item_as_normal_user_forbidden(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    data = {
        "code": f"PU-{uuid.uuid4().hex[:8]}",
        "description": "Item de prueba 2",
        "unit": "m2",
        "unit_price": "10.00",
    }
    response = client.post(
        f"{settings.API_V1_STR}/line-items/",
        headers=normal_user_token_headers,
        json=data,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "Not enough permissions"


def test_read_line_items(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/line-items/",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    content = response.json()
    assert "data" in content and isinstance(content["data"], list)
    assert "count" in content and isinstance(content["count"], int)


def test_update_line_item_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # create first
    code = f"PU-{uuid.uuid4().hex[:8]}"
    create = client.post(
        f"{settings.API_V1_STR}/line-items/",
        headers=superuser_token_headers,
        json={
            "code": code,
            "description": "desc",
            "unit": "u",
            "unit_price": "1.00",
        },
    )
    assert create.status_code == 200, create.text
    obj = create.json()

    # update
    data = {"description": "desc updated", "unit_price": "2.50"}
    response = client.put(
        f"{settings.API_V1_STR}/line-items/{obj['id']}",
        headers=superuser_token_headers,
        json=data,
    )
    assert response.status_code == 200, response.text
    content = response.json()
    assert content["description"] == data["description"]
    assert content["unit_price"] == data["unit_price"]


def test_delete_line_item_as_superuser(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    # create first
    code = f"PU-{uuid.uuid4().hex[:8]}"
    create = client.post(
        f"{settings.API_V1_STR}/line-items/",
        headers=superuser_token_headers,
        json={
            "code": code,
            "description": "desc",
            "unit": "u",
            "unit_price": "3.00",
        },
    )
    assert create.status_code == 200, create.text
    obj = create.json()

    response = client.delete(
        f"{settings.API_V1_STR}/line-items/{obj['id']}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Line item deleted successfully"


def test_line_item_not_found(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    response = client.get(
        f"{settings.API_V1_STR}/line-items/{uuid.uuid4()}",
        headers=superuser_token_headers,
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Line item not found"

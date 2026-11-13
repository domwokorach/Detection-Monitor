from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from app.db import Base, get_db, make_engine
from app.main import app
from app.seed import seed_demo
from app import api as api_module


@pytest.fixture
def system(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    engine = make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as db:
        seed_demo(db)

    def db_override():
        with maker() as db:
            yield db
    app.dependency_overrides[get_db] = db_override
    monkeypatch.setattr(api_module, 'notify_screening', lambda: None)
    client = TestClient(app)
    response = client.post('/api/auth/login', json={'email': 'admin@demo.local', 'password': 'ChangeMe123!'})
    assert response.status_code == 200, response.text
    headers = {'Authorization': f"Bearer {response.json()['access_token']}"}
    yield client, maker, headers
    client.close()
    app.dependency_overrides.clear()
    engine.dispose()

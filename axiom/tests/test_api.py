"""
Basic API tests
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    assert "Axiom" in response.json()["service"]


def test_health():
    """Test health check"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_list_strategies():
    """Test strategy listing"""
    response = client.get("/strategies")
    assert response.status_code == 200
    strategies = response.json()
    assert len(strategies) > 0
    assert any(s["name"] == "TitForTat" for s in strategies)


def test_list_basic_strategies():
    """Test basic strategy listing"""
    response = client.get("/strategies?basic_only=true")
    assert response.status_code == 200
    strategies = response.json()
    assert len(strategies) <= 15

import pytest
from app import app, rag_lookup, load_kb

def test_rag_finds_econnrefused():
    matches = rag_lookup("ECONNREFUSED connection error")
    assert any("ECONNREFUSED" in m["error"] for m in matches)

def test_rag_finds_module_error():
    matches = rag_lookup("ModuleNotFoundError: No module named flask")
    assert any("ModuleNotFoundError" in m["error"] for m in matches)

def test_rag_returns_empty_for_unknown():
    matches = rag_lookup("some completely unique error xyz123")
    assert matches == []

def test_knowledge_base_has_entries():
    kb = load_kb()
    assert len(kb) > 5

def test_app_index_returns_200():
    client = app.test_client()
    r = client.get("/")
    assert r.status_code == 200

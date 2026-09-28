# 06. Screenshot Error Diagnoser

> Hackathon Submission | Prince Spark Academy / PSVPEC | 2026

## Problem Statement
Web UI accepts screenshot upload → Vision LLM extracts error text, RAG-matches to knowledge base, replies with numbered fix steps.

## AI Capability Demonstrated
**Vision LLM + RAG**

## Setup
```bash
git clone https://github.com/vishnu-psvpec/06-screenshot-error-diagnoser.git
cd 06-screenshot-error-diagnoser
pip install -r requirements.txt   # (or dotnet run for C# project)
cp .env.example .env
# Edit .env with your API keys
```

## Environment Variables
```
ANTHROPIC_API_KEY
```

## Run
```bash
python src/app.py  # then open http://localhost:5001
```

## Run Tests
```bash
pytest tests/ -v
```

## Architecture
See `docs/` folder for detailed architecture notes.

## Deliverables
- ✅ Public GitHub Repository
- ✅ Source code with clean structure
- ✅ README with setup & run instructions
- ✅ Sample data in `sample_data/`
- ✅ Test cases in `tests/`
- ✅ AI Usage Note in `docs/ai_usage_note.md`

## Tech Stack
- Python 3.11 (or .NET 8 for project 11)
- Anthropic claude-sonnet-4-20250514
- AI Pattern: Vision LLM + RAG

---
*Prince Spark Academy / PSVPEC — Vishnu — Hackathon 2026*

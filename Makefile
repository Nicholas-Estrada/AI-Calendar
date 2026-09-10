.PHONY: setup dev backend-dev frontend-dev test

setup:
	./scripts/setup.sh

dev:
	./scripts/dev.sh

backend-dev:
	cd backend && .venv/bin/uvicorn app.main:app --reload

frontend-dev:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/pytest
	cd frontend && npm run build

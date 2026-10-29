# LightPath Makefile
# Targets: setup, test (python and web), lint, pipeline, web-dev, web-build, clean

PYTHON ?= python
NPM ?= npm

.PHONY: all setup test lint pipeline web-dev web-build clean help

help:
	@echo "LightPath Build System"
	@echo "Targets:"
	@echo "  make setup      - Install Python & Web dependencies"
	@echo "  make test       - Run Python pytest and Web vitest test suites"
	@echo "  make lint       - Run Python ruff check and Web eslint"
	@echo "  make pipeline   - Execute science pipeline and generate site artifacts"
	@echo "  make web-dev    - Start local Vite development server"
	@echo "  make web-build  - Build static web production bundle"
	@echo "  make clean      - Clean cache and build artifacts"

all: setup test lint web-build

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install pytest pytest-cov jsonschema numpy scipy ruff pydantic pyyaml matplotlib spiceypy rasterio pyproj
	cd web && $(NPM) install

test: test-python test-web

test-python:
	$(PYTHON) -m pytest -v

test-web:
	cd web && $(NPM) test

lint: lint-python lint-web

lint-python:
	$(PYTHON) -m ruff check .

lint-web:
	cd web && $(NPM) run lint

pipeline:
	$(PYTHON) -m pipeline.run --config configs/synthetic.yaml --mode synthetic

web-dev:
	cd web && $(NPM) run dev

web-build:
	cd web && $(NPM) run build

clean:
	-rm -rf dist build .pytest_cache .coverage htmlcov
	-rm -rf web/dist web/node_modules/.vite
	-find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

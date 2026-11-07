# LightPath Makefile
# Targets: setup, test (python and web), lint, pipeline, web-dev, web-build, clean

PYTHON ?= python
NPM ?= npm

.PHONY: all setup test lint pipeline web-dev web-build clean help test-e2e fetch-terrain fetch-kernels fetch-horizons check-data

help:
	@echo "LightPath Build System"
	@echo "Targets:"
	@echo "  make setup          - Install Python & Web dependencies"
	@echo "  make test           - Run Python pytest and Web vitest test suites"
	@echo "  make test-e2e       - Run Playwright E2E smoke tests"
	@echo "  make lint           - Run Python ruff check and Web eslint"
	@echo "  make pipeline       - Execute science pipeline and generate site artifacts"
	@echo "  make fetch-terrain  - Download far layer DEM and crop near layer windows"
	@echo "  make fetch-kernels  - Download and verify NAIF SPICE kernels"
	@echo "  make fetch-horizons - Download JPL Horizons reference ephemerides"
	@echo "  make check-data     - Verify checksums of all real data and kernels offline"
	@echo "  make web-dev        - Start local Vite development server"
	@echo "  make web-build      - Build static web production bundle"
	@echo "  make clean          - Clean cache and build artifacts"

fetch-terrain:
	$(PYTHON) scripts/fetch_dem_windows.py

fetch-kernels:
	$(PYTHON) scripts/fetch_kernels.py

fetch-horizons:
	$(PYTHON) scripts/fetch_horizons.py

check-data:
	$(PYTHON) scripts/check_kernels.py
	$(PYTHON) scripts/check_data_offline.py
	pytest -v -m "real_data and not network" tests/test_real_terrain_crop.py


all: setup test lint web-build

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install pytest pytest-cov jsonschema numpy scipy ruff pydantic pyyaml matplotlib spiceypy rasterio pyproj pyarrow
	cd web && $(NPM) install

test: test-python test-web

test-python:
	$(PYTHON) scripts/claims_guard.py
	$(PYTHON) -m pytest -v

test-web:
	cd web && $(NPM) test

test-e2e: web-build
	cd web && $(NPM) run test:e2e

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

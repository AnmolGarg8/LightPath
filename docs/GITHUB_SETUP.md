# LightPath — GitHub Repository Setup & Deployment Guide

This guide contains the exact settings, metadata, and deployment instructions for human maintainers of the **LightPath** repository on GitHub.

---

## 1. Repository "About" Section Metadata

In your GitHub repository home page (`https://github.com/AnmolGarg8/LightPath`), click the gear icon ⚙️ next to **About** on the right sidebar and enter the following:

### Short Repository Description
```text
CLPS Lunar Mission Browser & Space-Time Traverse Planner: deterministic topocentric illumination, DTE DSN visibility, and dynamic 4D rover traverse routing across moving south-pole shadows.
```
*(Character count: 187 chars — well within GitHub's 350-character limit)*.

### Website URL
```text
https://anmolgarg8.github.io/LightPath/
```

### Suggested Repository Topics
Copy and paste these topics into the GitHub topics field:
- `nasa-space-apps`
- `space-apps-2026`
- `lunar-south-pole`
- `clps`
- `artemis`
- `raycasting`
- `ephemeris`
- `space-time-planning`
- `deep-space-network`
- `topocentric-lighting`
- `lola-dem`
- `molstar`

---

## 2. GitHub Pages Deployment Activation (Fixing Deployment Error)

If the **Deploy to GitHub Pages** workflow fails with:
```text
Error: Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions...
```

Follow these 4 steps to activate GitHub Pages for your repository:

1. **Open Pages Settings**:
   Navigate to:
   `https://github.com/AnmolGarg8/LightPath/settings/pages`
   *(or click **Settings** tab at top of repo -> **Pages** on left sidebar)*.

2. **Select Source: GitHub Actions**:
   Under **Build and deployment**:
   - Locate the **Source** dropdown menu.
   - Change the selection from *None* or *Deploy from a branch* to **GitHub Actions**.

3. **Re-run the Failed Deployment Workflow**:
   - Go to the **Actions** tab: `https://github.com/AnmolGarg8/LightPath/actions`.
   - Click on the most recent failed **Deploy to GitHub Pages** workflow run.
   - In the top-right corner, click **Re-run all jobs**.

4. **Verify Live Deployment**:
   Once the workflow finishes with a green checkmark, your web app will be live at:
   `https://anmolgarg8.github.io/LightPath/`

---

## 3. GitHub Actions Workflows Summary

The repository includes two automated CI/CD workflows under `.github/workflows/`:

1. **`ci.yml` (LightPath CI / Lint, Test & Build)**:
   - Triggers on every push and pull request to `main`.
   - Sets up Python 3.11: runs `ruff check .` and `pytest -v`.
   - Sets up Node.js 20: runs `npm ci`, `npm run lint`, `npm test`, and `npm run build`.
   - Verifies all 15 verification benchmarks (V1–V8, X1–X6) and all 58 frontend test suites pass.

2. **`deploy.yml` (Deploy to GitHub Pages)**:
   - Triggers on push to `main` or manual trigger (`workflow_dispatch`).
   - Builds production static bundle into `web/dist/` with relative hash routing (`base: './'`).
   - Packages and deploys directly to GitHub Pages via official GitHub Actions artifacts.

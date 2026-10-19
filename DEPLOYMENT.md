# Enterprise Deep Code Review GitHub Action - Deployment Guide

This guide covers building, packaging, testing, and deploying the **Enterprise Deep Code Review GitHub Action** in public repositories, private enterprise organizations, and self-hosted GitHub Enterprise Server environments.

---

## 1. Local Development & Testing

### Prerequisites
- [Node.js](https://nodejs.org/) (v20.x or higher)
- [npm](https://www.npmjs.com/) (v10.x or higher)

### Installation
1. Navigate to the project directory:
   ```bash
   cd "c:/Users/HP/Documents/Exquisapps/ID's/lekeOmotayo/maven"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the comprehensive unit test suite:
   ```bash
   npm test
   ```

4. Run tests with coverage:
   ```bash
   npm run test:coverage
   ```

---

## 2. Compiling and Packaging the Action

GitHub Actions run directly from compiled JavaScript. Because Node actions run in an isolated runner environment, all dependencies (`@octokit/rest`, `zod`, `@actions/core`, etc.) should be compiled into a single self-contained distribution bundle using `@vercel/ncc`:

### Step 1: TypeScript Type Checking
```bash
npm run build
```

### Step 2: Bundle Single-File Distribution
```bash
npm run bundle
```
This produces `dist/index.js` and `dist/licenses.txt`, embedding all vendor code so the action runs in GitHub Actions runners without requiring `npm install` at runtime.

---

## 3. GitHub Repository Secrets Setup

In your target GitHub repository (or organization settings):
1. Navigate to **Settings &rarr; Secrets and variables &rarr; Actions**.
2. Click **New repository secret**.
3. Add the following secrets:
   | Secret Name | Required | Description |
   | :--- | :--- | :--- |
   | `OPENAI_API_KEY` | Optional | Your OpenAI or Azure OpenAI API Key. If omitted, the action falls back to simulated offline mock mode. |
   | `CUSTOM_LLM_BASE_URL` | Optional | If using private Ollama, LocalAI, or vLLM endpoints. |

> **Note**: `GITHUB_TOKEN` is automatically created and injected by GitHub for every workflow run. No manual secret creation is required for `GITHUB_TOKEN`.

---

## 4. GitHub Actions Workflow Configuration

Create `.github/workflows/code-review.yml` in your target repository:

```yaml
name: 'Automated Deep Code Review'

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  ai-code-review:
    name: 'AI Code Review & Security Gate'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Deep Code Review Action
        uses: lekeomotayo/deep-code-review-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          model: 'gpt-4o'
          max_tokens_per_batch: 4000
          severity_threshold: 'LOW'
          fail_on_severity: 'CRITICAL' # Block PR if critical security issues exist
          enable_pii_scrubbing: 'true'
          enable_injection_defense: 'true'
```

### Required Permissions
The action requires:
- `pull-requests: write`: To post inline comments on specific diff lines and top-level review summaries.
- `contents: read`: To fetch repository commits and file contents.

---

## 5. Publishing to GitHub Marketplace or Enterprise Releases

### Version Tagging Strategy
When releasing updates:
1. Commit the updated `dist/` directory and `action.yml`:
   ```bash
   git add action.yml dist/
   git commit -m "feat: release v1.0.0"
   ```
2. Tag the release:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git tag -fa v1 -m "Update v1 major pointer"
   git push origin v1.0.0
   git push origin v1 --force
   ```
3. Create a GitHub Release in your repository. Check **Publish this Action to the GitHub Marketplace** if public.

---

## 6. Offline / Local Testing Without GitHub Actions

You can simulate full execution locally using environment variables:

```bash
# Set mock context
export GITHUB_REPOSITORY="acme/payment-service"
export PULL_REQUEST_NUMBER="42"
export COMMIT_SHA="a1b2c3d4e5f6"
export IS_MOCK_MODE="true"

# Execute compiled action
node dist/index.js
```

---

## 7. Interactive Documentation & Simulator (Frontend)

To explore the interactive simulator, PII scrubber visualizer, and API reference in your browser:
```bash
# Open docs/index.html in any browser:
# On Windows:
start docs/index.html
# On macOS:
open docs/index.html
# On Linux:
xdg-open docs/index.html
```
Or serve via any static file server (e.g. `npx serve docs`).

# Maven — Deep Code Review Action & Simulator Demo Script

## 1. The 30-Second Elevator Pitch
> *"Pull requests often contain proprietary source code, secrets, and sometimes even adversarial prompt injections hidden inside code comments designed to hijack AI review bots. **Maven** is a secure, enterprise-grade GitHub Action built with TypeScript and Octokit. Before sending code diffs to an LLM, Maven runs an isolation boundary: stripping PII and credentials, detecting prompt injection delimiters in comments, batching diff chunks to respect context windows, and mapping findings back to structured GitHub inline comments with actionable suggestion blocks."*

---

## 2. Senior Architecture Deep Dive

```
Pull Request Opened -> [GitHub Actions Runner]
                              |
                              v
                   [Diff Parsing & Chunking]
        (Batches large PR diffs to fit model context limits)
                              |
                              v
                  [Threat Isolation Boundary]
       • PII & API Key Scrubbing (AWS, OpenAI, GitHub tokens)
       • Comment Jailbreak Filter (Detects hidden system prompt overrides)
                              |
                              v
                    [LLM Analysis Phase]
       • Security vulnerabilities (OWASP, injection)
       • Performance anti-patterns & memory leaks
       • Style & maintainability suggestions
                              |
                              v
                [Octokit Review Comment Poster]
       • Structured inline comments on exact diff line numbers
       • GitHub markdown ```suggestion blocks for 1-click merge
```

---

## 3. How to Run & Demo

### A. Open the Interactive Browser Simulator
```powershell
Set-Location "C:\Users\HP\Documents\Exquisapps\ID's\lekeOmotayo\maven"
Start-Process .\docs\index.html
# Or serve locally:
npx serve docs
```

### Demo Flow in Simulator:
1. **Load Sample PR Diff**: Select `"PR #142: Authentication Refactor"`. Show the raw git diff with additions and deletions.
2. **Threat Defense in Action**: Point out how a hidden credential (`sk-proj-...`) in the diff is automatically redacted before LLM analysis.
3. **Simulate AI Review**: Click **"⚡ Run Code Review"**. Watch the action analyze chunk by chunk.
4. **Inspect Generated GitHub Comments**:
   - Severity tags: `[CRITICAL]`, `[WARNING]`, `[INFO]`.
   - Actionable inline diff suggestions ready for GitHub's "Apply suggestion" button.
5. **Show GitHub Actions Workflow ([`action.yml`](file:///c:/Users/HP/Documents/Exquisapps/ID's/lekeOmotayo/maven/action.yml))**: Explain how any enterprise repo installs it via `.github/workflows/review.yml` with zero setup.

---

## 4. Senior Defense Questions & Answers

### Q: "How does Maven handle gigantic PRs that exceed LLM context windows?"
> **Answer:** *"Maven implements semantic diff chunking. Instead of dumping the entire repository diff into one prompt, it splits the diff by file boundaries and AST blocks, prioritizing high-risk files (auth, database queries, API handlers) and reviewing them in parallel batches."*

### Q: "Why package as a standalone GitHub Action with NCC bundling?"
> **Answer:** *"Using `@vercel/ncc` compiles TypeScript and all `node_modules` into a single self-contained `dist/index.js` artifact. This allows GitHub runners to execute the action immediately without running `npm install` on every pull request, saving minutes of CI runner billable time."*

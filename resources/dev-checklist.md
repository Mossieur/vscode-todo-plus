# Dev Checklist (Todo+ Fork)

Practical checklist to keep local development, testing, and PR flow clean.

---

## 1) Start a New Development

- [ ] **Sync remotes**: `git fetch --all --prune`
- [ ] **Start from a clean base**: checkout the base branch you target (ex: `master`)
- [ ] **Create a feature branch**: `git checkout -b feature/<short-name>`
- [ ] **Install deps if needed**: `npm install`
- [ ] **Confirm the extension runs**: launch the Extension Host once

Notes:

- Use a short, clear branch name (example: `feature/markdown-checkbox`).
- Avoid working directly on `master` or `local/all-features`.

---

## 2) Test

- [ ] **Build (dev)**: `npm run compile`
- [ ] **Manual check**: open the Extension Host and verify key flows
- [ ] **Optional tests**: `npm test` (only if needed; it launches a new VS Code)

Notes:

- `npm test` requires no other VS Code instance running.
- For embedded regex changes, validate with test files in `resources/`.

---

## 3) Push for PR (from origin master)

- [ ] **Make sure branch is up to date**: `git fetch origin`
- [ ] **Rebase if needed**: `git rebase origin/master` (or merge if required)
- [ ] **Stage and review**: `git add -A && npm run git:review`
- [ ] **Commit**: `git commit -m "<type>: <message>"`
- [ ] **Push**: `git push -u origin feature/<short-name>`
- [ ] **Open PR** on the upstream repository (not your fork)

Notes:

- Keep PRs focused on a single change.
- Use conventional commit messages (`feat:`, `fix:`, `docs:`, etc.).

---

## 4) Merge into local/all-features

- [ ] **Switch to local/all-features**: `git checkout local/all-features`
- [ ] **Bring changes** (choose one):
  - **Cherry-pick**: `git cherry-pick <commit-sha>`
  - **Merge**: `git merge feature/<short-name>`
- [ ] **Resolve conflicts** if any, then commit/continue

Notes:

- Prefer `cherry-pick` to keep a linear history.
- Only merge after the feature branch is validated.

---

## 5) Test then Install Locally

- [ ] **Build (prod)**: `npm run vscode:prepublish`
- [ ] **Package vsix**: `npm run package:vsix`
- [ ] **Install vsix**: `npm run vsix:install`
- [ ] **Verify in VS Code**: extension is enabled and active

Notes:

- If you have both official + fork installed, disable the official one during tests.
- If you see activation errors, check `Output > Log (Extension Host)`.

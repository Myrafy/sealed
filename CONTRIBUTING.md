# Contributing to Sealed

Thanks for helping improve Sealed. We use a **develop → main** release flow.

## Branch model

| Branch | Role |
|--------|------|
| `develop` | Integration branch. All feature/fix PRs target this. |
| `main` | Stable / released code only. Maintainers promote from `develop` when cutting a release. |

```text
feature/*  ──PR──►  develop  ──maintainer PR──►  main  ──tag v*──►  GitHub Release
```

## For contributors

1. Fork the repo (or create a branch if you have write access).
2. Branch from the latest `develop`:

```bash
git fetch origin
git checkout develop
git pull origin develop
git checkout -b feature/short-description
```

3. Make your changes, commit, and push.
4. Open a **pull request against `develop`** (not `main`).
5. CI must pass (`typecheck` + unit tests with **100% coverage** on crypto / storage / sync).
6. A maintainer reviews and merges. Direct pushes to `develop` and `main` are blocked.

Do **not** bump the package version or create release tags unless a maintainer asks you to.

### Coverage gate

```bash
npm run test:coverage
```

The gate enforces 100% statements / branches / functions / lines for:

- `src/main/crypto/**`
- `src/main/sync/**`
- `src/main/storage/{simpleStore,fileProvider,mongoProvider}.ts`
- `src/main/windowLayout.ts`

Electron shell (`index.ts`, `ipc.ts`, preload) and React UI are outside this unit gate; keep PRs small and exercise those paths manually until UI/E2E coverage is added.

## For maintainers (release)

When `develop` is ready for the next public version:

1. Open a PR: **`develop` → `main`** and merge it yourself.
2. On `main`, bump `"version"` in `package.json` if needed, commit.
3. Tag and push to trigger the release workflow:

```bash
git checkout main
git pull origin main
git tag v1.0.2
git push origin v1.0.2
```

4. Optionally fast-forward `develop` so it stays aligned with `main`:

```bash
git checkout develop
git merge main
git push origin develop
```

GitHub Actions builds installers and publishes them to [Releases](https://github.com/Myrafy/sealed/releases).

## Branch protection (repo settings)

Configure once in **Settings → Rules → Rulesets** (or **Branches**):

### Ruleset: Protect `main`

- Target: `main`
- Restrict deletions
- Block force pushes
- Require a pull request before merging
- Require approvals: **1** (optional but recommended)
- Restrict who can push / merge: **only you** (or admins)
- Do **not** allow bypass for everyone — keep admin bypass only if you need emergency fixes

### Ruleset: Protect `develop`

- Target: `develop`
- Restrict deletions
- Block force pushes
- Require a pull request before merging
- Restrict who can merge: **only you** (contributors open PRs; you merge)

### Suggested extras

- **Settings → General → Pull Requests**: set default base branch to **`develop`** so new PRs aim there.
- Require status checks: **`Typecheck & coverage`** (workflow **CI**) before merging to `develop` / `main`.

Direct pushes and force-pushes to `main` / `develop` should fail for everyone else; only your merges via PR should land.

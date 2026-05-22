# Contributing

1. Branch from fresh `main`: `<type>/<topic>` — `feat`, `fix`, `chore`, `refactor`, `docs`.
2. Commit with DCO sign-off: `git commit -s`. Subject ≤60 chars, imperative mood, Conventional Commits format.
3. Run `npm run lint && npm run typecheck && npm run build` locally. CI will reject if any fails.
4. `gh pr create --web` — CI + Oxygen preview run automatically.
5. Address feedback with new commits. Maintainers squash-merge.

Forgot `-s`? `git commit --amend -s --no-edit && git push --force-with-lease`.

## Rules

- No new npm deps without an issue first (supply-chain hygiene).
- Mobile-first: design at 375px, enhance at 768px and 1440px.
- WCAG 2.1 AA baseline.
- Bundle additions >50 KB gzipped need justification.
- No `console.log` in prod — strip or guard with `if (import.meta.env.DEV)`.
- Don't duplicate Dependabot's PRs.

See [`docs/`](docs/) for architecture, environment, operations, and security references.

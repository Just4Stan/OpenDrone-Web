# Errors — 404 / catch-all

> source: app/routes/$.tsx, app/root.tsx (ErrorBoundary)

The catch-all route (`app/routes/$.tsx`) just throws a 404 Response with no
visible copy of its own — its message is the requested pathname (dynamic).
All user-visible error copy is rendered by the root `ErrorBoundary` in
`app/root.tsx`, which handles both 404 (page not found) and the generic
500/error case. The status number is dynamic; the title/body switch on
whether the status is 404.

## 404 — Page not found

- **title:** Page not found
- **body:** The page you were looking for has moved or never existed. Try the catalog or head home.

## Generic error (non-404)

- **title:** Something went wrong
- **body:** An unexpected error occurred. Try again, or head back to the catalog.

## Shared chrome

- **technical_details_summary:** Technical details
- **action_home:** Home
- **action_shop:** Shop

The status code (e.g. 404, 500) and the technical detail text inside the
`<details>` block are dynamic (from the thrown response/error).

```do-not-edit
Action links: Home → / ; Shop → /collections/all
Catch-all 404 message format: "<pathname> not found" (dynamic pathname)
```

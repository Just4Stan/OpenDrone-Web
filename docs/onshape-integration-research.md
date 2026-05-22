# OnShape integration research — OpenFrame storefront

Goal: surface the OpenFrame carbon-fibre frame's OnShape design on the PDP the
same way the KiCad products use **KiCanvas (live viewer) + GitHub (canonical
source) + downloads (STEP/BOM/etc.)**. OpenFrame has no KiCad/GitHub repo; its
source of truth is an OnShape cloud CAD document. The current `openframe` block
in `app/lib/product-content.ts` carries `downloads: []` plus a `TODO(onshape)`
marker — these placeholder GitHub links were already removed.

All claims below are verified against current (2025/2026) OnShape docs/forum.
Where a detail could not be verified from a public (non-auth-walled) page it is
flagged explicitly. Sources are listed at the bottom.

---

## 1. Embedded live viewer — NO direct iframe (this is the headline finding)

**OnShape cannot be embedded in a third-party `<iframe>` the way KiCanvas can.**
OnShape serves frame-busting headers (`X-Frame-Options` / CSP `frame-ancestors`),
so an `<iframe src="https://cad.onshape.com/documents/...">` on `opendrone.be`
will fail with the browser's "refused to connect" error. This is a long-standing,
intentional limitation repeatedly confirmed on the OnShape forum; there is **no
documented public embed URL / embed-code feature** equivalent to KiCanvas's
`?github=` query param. Do not invent one.

What OnShape *does* offer instead:

- **Public documents.** A non-enterprise (incl. free) user can flip a document to
  public via Share → **Public** tab → *Make public*. Public documents are
  viewable by anyone (with or without an OnShape account, in-browser, pan/zoom,
  measure/inspect tools).
- **"Anyone with link" view-only share** (rolled out / hardened around Oct 2025).
  A view-only link grants read-only browser access and **does not require the
  viewer to have an OnShape account**. This is the closest analogue to "click to
  inspect the design," but it opens in OnShape's own full UI in a new tab — it is
  a *link out*, not an in-page embed.

So the KiCanvas "live board renders inside our PDP" experience is **not
achievable** with OnShape. The realistic options are:

1. **Link out** to the public/view-only OnShape document (button, opens new tab).
2. **Pre-export glTF/GLB** from OnShape and render it ourselves in-page with
   `<model-viewer>` or three.js — this is the only way to get a true in-page
   interactive 3D viewer, and it is fully under our control (no OnShape headers,
   no account prompts). See §5.

> Verification note: the specific forum threads on iframe blocking redirect to an
> SSO login wall and could not be fetched verbatim. The conclusion (iframes
> blocked, no embed feature) is consistent across the search-indexed forum
> summaries and OnShape's documented sharing model, which only ever describes
> *links*, never an embed/iframe code.

---

## 2. Downloadable artifacts / export

### Manual export (UI)
Right-click a Part Studio / Assembly / Part → **Export** → choose format
(STEP, STL, Parasolid, IGES, glTF, OBJ, DWG/DXF for drawings, etc.). This is the
simplest path: export STEP once, commit/upload it, link it in `downloads`.

### REST API export (for an automated pipeline)
OnShape has a documented translation/export API. Endpoint templates (verbatim
from the Glassworks API docs — `{did}` = document id, `{wv}` = `w`|`v`|`m`
(workspace/version/microversion), `{wvid}` = its id, `{eid}` = element id):

**Asynchronous (full control over options):**
```
POST /partstudios/d/{did}/{wv}/{wvid}/e/{eid}/export/step
POST /partstudios/d/{did}/{wv}/{wvid}/e/{eid}/export/gltf
POST /partstudios/d/{did}/{wv}/{wvid}/e/{eid}/export/obj
POST /partstudios/d/{did}/{wv}/{wvid}/e/{eid}/translations   (generic, pass format)
POST /assemblies/d/{did}/{wv}/{wvid}/e/{eid}/export/step
POST /assemblies/d/{did}/{wv}/{wvid}/e/{eid}/export/gltf
POST /drawings/d/{did}/w/{wid}/e/{eid}/translations          (drawing → DXF/DWG/PDF)
```
Poll `GET /translations/{translationId}` until `requestState == DONE`, then
download the result (stored as a blob element / external data, fetched via
`GET /documents/d/{did}/externaldata/{fid}` or the result element id).

**Synchronous (faster, less tessellation control — good for glTF/STL/Parasolid):**
```
GET /partstudios/d/{did}/w/{wvid}/e/{eid}/gltf      → 307 redirect to file
GET /partstudios/d/{did}/w/{wvid}/e/{eid}/stl       → 307 redirect to file
GET /parts/d/{did}/w/{wvid}/e/{eid}/partid/{pid}/parasolid
```
Synchronous STL/glTF return a **307 redirect to the modeling server**; with API
keys you must **re-sign the redirected request** (the HMAC signature includes the
new path/query). With OAuth2 the redirect "just works." Validate supported
formats at runtime via `GET /translations/translationformats`.

### Auth
- **API keys** (access key + secret) — created at `dev-portal.onshape.com` or
  *My Account → Developer*. Keys act **on behalf of the user who created them**.
  Ideal for a personal/CI automation script. Available on the free plan.
- **OAuth2** — for App-Store apps acting on behalf of *their* users; heavier.
  Notable perk: calls made via a published App-Store OAuth2 app **do not count
  toward API limits**.

### Rate / usage limits (matters for a build pipeline)
- HTTP 429 on overage, with `Retry-After` and `X-Rate-Limit-Remaining` headers.
- Per-minute and per-day limits exist but exact numbers are **not published**.
- **Annual** call limits *are* published and are low for our tier:
  - **Free / Standard / EDU Student: 2,500 calls per user per year**
  - Professional: 5,000 / user · Enterprise: 10,000 / Full User.
- A single STEP export is only a handful of calls (create translation → poll →
  download), and we'd only run it when the design changes — so 2,500/yr is
  comfortable for a **build-time export-on-release** script, but it rules out
  any "export live on every page view" idea.

### DXF over-exposure risk — IMPORTANT for OpenDrone
OpenDrone does **not** want to publish the DXF flat-pattern cutting files.
Mitigations:
- **STEP and glTF/STL are solid/mesh formats.** They describe the finished 3D
  geometry, not a 2D nesting/cutting layout. Shipping a STEP of the assembly does
  not hand over a ready-to-cut DXF. (A determined party could re-derive a flat
  pattern, but that's true of any 3D release; STEP is the accepted "open the
  design" artifact.)
- **DXF only comes from a *Drawing* element** (`/drawings/.../translations`) or a
  manual sketch/face export. Our export script must target only the
  Part Studio / Assembly STEP+glTF endpoints and **never** the drawings
  translation endpoint, and we must not author/publish a flat-pattern drawing.
- **Public document = full read access.** The single biggest leak vector is
  making the OnShape doc *public*: a public doc lets anyone open every Part
  Studio, every sketch, and export their own DXF. If we don't want the cutting
  files out, **do not make the document public / do not share a view-only link to
  the full doc** — instead keep the doc private and publish only curated STEP/GLB
  exports from our build script. (See §4 — the free-plan public-doc license is a
  second, independent reason to avoid going public.)

---

## 3. Version-control parity (mapping OnShape → git)

OnShape's data model is explicitly modelled on git and maps cleanly to the
"browse the design history" framing:

| git concept            | OnShape concept        | Notes |
|------------------------|------------------------|-------|
| working tree           | **Workspace** (`Main`) | the live editable state |
| commit / tag (immutable snapshot) | **Version** | immutable; every doc starts with version `Start` |
| branch                 | **Branch**             | parallel workspace; experiment freely |
| merge / PR             | **Merge** + visual compare | compare two versions/workspaces, resolve diffs |
| release / GitHub Release | **Release** (Release Management) | company-approved snapshot with status: Pending → Under Review → Approved/Released; this is the "manufacturing-blessed" rev |
| diff view              | **Compare** | side-by-side visual diff of two versions/branches, like GitHub's diff |
| branch protection      | **Workspace Protection** | lock a workspace; changes only via merge |

**Public version-history URL?** When a document is public, the version graph /
"Versions and history" panel is visible inside the OnShape document UI to anyone
with the link — but again that's the OnShape app UI in a new tab, **not** a
standalone embeddable history page and **not** a clean per-version permalink list
like GitHub's `/releases` or `/commits`. There is **no verified public URL pattern
that renders the version graph outside OnShape's app.** If we want a GitHub-style
"design history" list on our own PDP we'd have to build it (e.g. pull versions via
the API `GET /documents/d/{did}/versions` and render our own list) — likely
over-engineering for one frame product.

---

## 4. Licensing / open-source considerations (real gotcha)

- **Neutral-format export is the honest open-source path.** Publishing a STEP
  (and optionally STL/glTF) under CERN-OHL-S / CC is the CAD analogue of
  releasing Gerbers+schematic — recipients can inspect/manufacture without an
  OnShape account or the proprietary native format. This fits OpenDrone's
  existing CERN-OHL-S posture.
- **Free-plan public-document license is a trap.** For any public document
  *owned by a free user* (created on/after 2018-08-07), OnShape auto-grants every
  third party a **worldwide, royalty-free, irrevocable license to use, copy,
  modify, distribute, sublicense and *sell*** the document's IP "without
  restriction." That is effectively forced near-public-domain on the *native
  source*, broader than CERN-OHL-S's share-alike intent, and it lets anyone
  commercialise the frame with no reciprocity. Combined with §2's DXF leak, this
  is a strong reason **not** to host the canonical OnShape doc as a free-plan
  public document.
- **Recommended licensing posture:** keep the OnShape document **private**;
  publish a **curated STEP (+ GLB) export** in our own repo/CDN under
  CERN-OHL-S-2.0 (matching the rest of the catalog). We control exactly which
  geometry ships and the license terms — instead of inheriting OnShape's
  free-tier blanket grant and exposing every sketch/DXF.

---

## 5. Recommendation — concrete integration for the Hydrogen storefront

### Verdict
Do **not** try to mirror KiCanvas's live iframe (impossible with OnShape).
Instead use a **two-part pattern that reuses our existing types almost verbatim**:

1. **In-page 3D viewer = pre-exported GLB rendered with `<model-viewer>`**, served
   from our own static assets (mirror the `boardArt` pattern). This is the true
   "inspect without leaving the page" experience and the closest spiritual match
   to KiCanvas.
2. **Link-out + downloads** for the source-of-truth and heavier formats: a
   "Design history / open in OnShape" link (only if we choose to make a curated
   *view-only* doc) and a STEP download entry.

### Trade-off: live OnShape link vs. pre-exported GLB + `<model-viewer>`

| | OnShape view-only link-out | Pre-exported GLB + `<model-viewer>` (recommended) |
|---|---|---|
| In-page interactive 3D | No (new tab, OnShape UI) | **Yes** |
| Account/login friction | None for viewer, but leaves our site | None |
| Exposes full source / DXF | **Yes — every sketch exportable** | No — only the mesh we ship |
| Free-plan blanket license risk | Yes (if public) | No |
| Our control over presentation | None | Full (dark theme, lighting, poster) |
| Pipeline cost | Zero | One build-time export per design change |
| Native source still available | Yes (that's the point) | Via separate STEP download |

GLB wins on every axis that matters to OpenDrone except "shows the editable
native source," which we deliberately don't want to expose anyway.

### `product-content.ts` changes (additive, low blast radius)

The existing `teardown.boardArt` is `{src; inspectUrl?}` and `downloads` is an
array of `{kind,label,href,note?,size?}`. Extend rather than replace:

- Add `'cad'` to the `DownloadKind` union (for a STEP/GLB download icon).
- Reuse `teardown.boardArt.src` for the **GLB path** (e.g. `/cad/openframe/frame.glb`)
  and **drop / repurpose `inspectUrl`** — for OnShape products `inspectUrl` would
  point at the OnShape view-only doc *if* we decide to expose one, else omit it.
  (Optionally rename to a neutral `viewerSrc`/`sourceUrl` later; not required.)
- Populate `openframe.downloads` with a STEP entry pointing at our own
  repo/CDN export (CERN-OHL-S), not a GitHub placeholder. Example shape:
  ```ts
  downloads: [
    {kind: 'cad', label: '3D model (STEP)', href: '<our-cdn>/openframe/frame.step',
     note: 'Assembly, neutral format — CERN-OHL-S-2.0'},
  ],
  ```
- Optionally add an `onshapeUrl` field to `ProductContent` for a "browse design
  history / open in OnShape" link — **only** wire this if we publish a curated
  view-only doc; given §2/§4, leaving it unset (private doc) is the safer default.

### Component changes
- The teardown component currently inlines an SVG (`boardArt`) and links
  `inspectUrl` to KiCanvas. For OpenFrame it must instead branch to render a
  `<model-viewer>` web component (or a small three.js GLTFLoader scene) when the
  asset is a `.glb`. `<model-viewer>` is a single script tag + custom element,
  trivial to drop into a React Router/Hydrogen route, supports `camera-controls`,
  `poster`, and a dark background — matches our engineering aesthetic. Lazy-load
  it (the GLB can be a few MB) the same way we already plan to lazy/compress GLBs
  per the release-blockers memo.

### Build-time script (the only backend-ish piece)
Add `scripts/export-onshape-cad.mjs <did> <wvid> <eid> <handle>` mirroring
`scripts/export-board-art.mjs`:
1. Read `ONSHAPE_ACCESS_KEY` / `ONSHAPE_SECRET_KEY` from env.
2. Call the **synchronous glTF** endpoint (`GET /partstudios|assemblies/d/.../gltf`)
   — handle the **307 redirect + re-sign** with API keys — to produce a GLB, and
   the async STEP export for the download. Pin to a **Version id** (`/v/{vid}`),
   not the live workspace, so exports are reproducible per release.
3. Write `public/cad/<handle>/frame.glb` and `frame.step`; compress the GLB
   (Draco/meshopt) before commit.
4. Run on demand / in CI only when the design rev changes — well within the
   2,500 calls/yr free-tier budget.

No runtime backend route is needed; everything is static at build time, exactly
like the board-art pipeline. The storefront stays a pure static-asset consumer.

---

## Sources
- Onshape forum — *Is it possible to show a part studio in an iframe* (auth-walled; iframe blocked): https://forum.onshape.com/discussion/13919/
- Onshape forum — *Embeddable Public Document Viewer*: https://forum.onshape.com/discussion/4770/embeddable-public-document-viewer
- Onshape forum — *Embed Onshape documents in my application*: https://forum.onshape.com/discussion/22015/
- Onshape Help — *Share Documents* (public, anyone-with-link view-only, no account needed): https://cad.onshape.com/help/Content/sharedocuments.htm
- Onshape Tech Tip — *Share Your Document With a Link*: https://www.onshape.com/en/resource-center/tech-tips/tech-tip-share-your-document-with-a-link
- Glassworks API — *Import & Export* (translation endpoints, sync vs async, 307 redirect, formats): https://onshape-public.github.io/docs/api-adv/translation/
- Onshape blog — *How to Use Onshape's REST API*: https://www.onshape.com/en/blog/cloud-native-cad-rest-api
- Glassworks API — *API Limits* (annual call limits per tier; OAuth App-Store calls exempt): https://onshape-public.github.io/docs/auth/limits/
- Glassworks API — *Authentication* (API keys vs OAuth2, scopes): https://onshape-public.github.io/docs/auth/
- Onshape Developer Portal (API key creation): https://dev-portal.onshape.com/
- Onshape apikey samples (API-key signing incl. 307 re-sign): https://github.com/onshape-public/apikey
- Onshape Help — *Working with Versions, Branching, and Merging*: https://cad.onshape.com/help/Content/Primer/versions.htm
- Onshape Help — *Versioning and Branching*: https://cad.onshape.com/help/Content/versionmanager.htm
- Onshape blog — *Git-Style Version Control*: https://www.onshape.com/en/blog/git-style-version-control-cad-data-management
- Onshape — *Release Management*: https://www.onshape.com/en/features/release-management
- Onshape Help — *Public Documents*: https://cad.onshape.com/help/Content/Plans/public_documents.htm
- Onshape forum — *Public Document License?*: https://forum.onshape.com/discussion/2039/public-document-license
- BigGo / Fabbaloo on free-tier public-doc license terms: https://biggo.com/news/202508021942_Onshape_Free_License_Restrictions , https://www.fabbaloo.com/2018/08/onshape-tightens-licensing-for-free-users
- `<model-viewer>` web component (proposed in-page viewer): https://modelviewer.dev/

/**
 * OpenDrone Studio: the local editing mirror of the site.
 *
 * DEV ONLY. `app/routes.ts` excludes `**\/studio*.tsx` from a production build,
 * and the write endpoint it talks to is an `apply: 'serve'` Vite plugin, so
 * neither half of this exists in the deployed worker.
 *
 * Three columns. Left is what you can edit, centre is the real site in an
 * iframe, right is the thing you have selected. The iframe is same-origin, so
 * the studio can reach into it, find every element tagged with `data-edit`, and
 * turn a click in the preview into an edit of the exact key it came from. That
 * is the whole trick: the preview is not a mock of the site, it IS the site.
 *
 * Saving writes the JSON file. Vite sees the write, invalidates the module that
 * imported it, and the iframe hot-reloads with the new words. There is no
 * publish step and no database: `git diff` is the changelog and `git checkout`
 * is undo.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {MetaFunction} from 'react-router';
import {PREVIEW_CSS, STUDIO_CSS} from '~/studio/studio-css';
import {StudioTokens} from '~/studio/StudioTokens';

export const meta: MetaFunction = () => [
  {title: 'OpenDrone Studio'},
  // Belt and braces: this route cannot reach production, but if it somehow did,
  // it should not be indexable.
  {name: 'robots', content: 'noindex, nofollow'},
];

type CopyFile = Record<string, unknown>;
type Tab = 'words' | 'design';

/** Reserved keys carry configuration, not copy. They are not editable text. */
const isMeta = (k: string) => k.startsWith('$');

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/__studio${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : {'content-type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json()) as T & {error?: string};
  if (!res.ok) throw new Error(json.error ?? `${res.status}`);
  return json;
}

export default function Studio() {
  const [tab, setTab] = useState<Tab>('words');
  const [files, setFiles] = useState<string[]>([]);
  const [page, setPage] = useState<string | null>(null);
  const [data, setData] = useState<CopyFile>({});
  const [dirty, setDirty] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [route, setRoute] = useState('/');
  const frame = useRef<HTMLIFrameElement>(null);

  // Load the list of copy files once. `content/copy/*.json` is the whole
  // editable surface, so the file list IS the page list.
  useEffect(() => {
    api<{files: string[]}>('/list')
      .then((r) => {
        const copyFiles = r.files
          .filter((f) => f.startsWith('copy/'))
          .map((f) => f.slice('copy/'.length, -'.json'.length));
        setFiles(copyFiles);
        if (copyFiles.length && !page) setPage(copyFiles[0]);
      })
      .catch((e: unknown) => setStatus(`Could not list content: ${(e as Error).message}`));
    // Run once on mount; `page` is seeded here and owned by the user after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read the selected page's file. Read from disk rather than the bundled copy
  // module so the studio always shows what is actually saved, even if HMR has
  // not caught up.
  const loadPage = useCallback((name: string) => {
    api<{data: CopyFile}>('/read', {file: `copy/${name}.json`})
      .then((r) => {
        setData(r.data);
        setDirty({});
        const r2 = r.data.$route;
        if (typeof r2 === 'string') setRoute(r2);
      })
      .catch((e: unknown) => setStatus(`Could not read ${name}: ${(e as Error).message}`));
  }, []);

  useEffect(() => {
    if (page) loadPage(page);
  }, [page, loadPage]);

  /**
   * Wire the preview. Runs on every iframe load, including the reloads Vite
   * triggers after a save, so the annotations are re-attached to the new DOM.
   *
   * Same-origin access is what makes this possible. If the iframe ever pointed
   * at a different origin this would throw, so the failure is caught and
   * reported rather than left as a silently dead preview.
   */
  const wirePreview = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    try {
      // The highlight rules have to live INSIDE the preview document. A
      // `<style>` in the studio's own page does not cross the iframe boundary,
      // which is why the outlines were invisible the first time round.
      const styleId = 'studio-preview-css';
      if (!doc.getElementById(styleId)) {
        const s = doc.createElement('style');
        s.id = styleId;
        s.textContent = PREVIEW_CSS;
        doc.head.appendChild(s);
      }
      doc.body.classList.add('studio-preview');
      const nodes = doc.querySelectorAll<HTMLElement>('[data-edit]');
      nodes.forEach((el) => {
        el.classList.add('studio-editable');
        el.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const id = el.getAttribute('data-edit');
          if (!id) return;
          // `data-edit` is `<page>.<key>`; the studio edits one file at a time,
          // so selecting a node on another page switches the file too.
          const dot = id.indexOf('.');
          const p = id.slice(0, dot);
          const k = id.slice(dot + 1);
          if (p !== page) setPage(p);
          setSelected(k);
        });
      });
      setStatus(
        nodes.length
          ? `${nodes.length} editable ${nodes.length === 1 ? 'string' : 'strings'} on this page`
          : 'No editable strings on this page yet',
      );
    } catch (e) {
      setStatus(`Preview not reachable: ${(e as Error).message}`);
    }
  }, [page]);

  const editableKeys = useMemo(
    () => Object.keys(data).filter((k) => !isMeta(k)).sort(),
    [data],
  );

  const valueOf = (key: string): string => {
    if (key in dirty) return dirty[key];
    const v = data[key];
    if (Array.isArray(v)) return v.join('\n\n');
    return typeof v === 'string' ? v : '';
  };

  const isDirty = Object.keys(dirty).length > 0;

  const save = async () => {
    if (!page || !isDirty) return;
    setStatus('Saving…');
    // Rebuild the record rather than mutating: an array-valued key stays an
    // array (paragraph runs), a string stays a string. Splitting on a blank
    // line is the inverse of the join above.
    const next: CopyFile = {...data};
    for (const [k, text] of Object.entries(dirty)) {
      next[k] = Array.isArray(data[k]) ? text.split(/\n{2,}/) : text;
    }
    try {
      await api('/write', {file: `copy/${page}.json`, data: next});
      setData(next);
      setDirty({});
      setStatus('Saved. The preview reloads on its own.');
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    }
  };

  const revert = () => {
    setDirty({});
    setStatus('Reverted to what is on disk.');
  };

  // Cmd-S saves, because everyone tries it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="studio">
      <style dangerouslySetInnerHTML={{__html: STUDIO_CSS}} />

      <header className="studio-bar">
        <span className="studio-brand">
          OpenDrone <b>Studio</b>
        </span>
        <nav className="studio-tabs">
          <button
            type="button"
            className={tab === 'words' ? 'is-on' : undefined}
            onClick={() => setTab('words')}
          >
            Words
          </button>
          <button
            type="button"
            className={tab === 'design' ? 'is-on' : undefined}
            onClick={() => setTab('design')}
          >
            Design
          </button>
        </nav>
        <span className="studio-status">{status}</span>
        <div className="studio-actions">
          <button type="button" onClick={revert} disabled={!isDirty}>
            Revert
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={() => void save()}
            disabled={!isDirty}
          >
            {isDirty ? `Save ${Object.keys(dirty).length}` : 'Saved'}
          </button>
        </div>
      </header>

      {tab === 'design' ? (
        <StudioTokens frame={frame} route={route} setStatus={setStatus} />
      ) : (
        <div className="studio-grid">
          <aside className="studio-rail">
            <h2>Pages</h2>
            {files.length === 0 ? (
              <p className="studio-empty">
                No copy files yet. They live in <code>content/copy/</code>.
              </p>
            ) : (
              <ul className="studio-pages">
                {files.map((f) => (
                  <li key={f}>
                    <button
                      type="button"
                      className={f === page ? 'is-on' : undefined}
                      onClick={() => {
                        setPage(f);
                        setSelected(null);
                      }}
                    >
                      {f}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h2>Strings on this page</h2>
            <ul className="studio-keys">
              {editableKeys.map((k) => (
                <li key={k}>
                  <button
                    type="button"
                    className={[
                      k === selected ? 'is-on' : '',
                      k in dirty ? 'is-dirty' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelected(k)}
                  >
                    <span className="studio-key">{k}</span>
                    <span className="studio-peek">{valueOf(k).slice(0, 60)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main className="studio-stage">
            <div className="studio-urlbar">
              <input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && frame.current) {
                    frame.current.src = route;
                  }
                }}
                aria-label="Preview address"
              />
              <button
                type="button"
                onClick={() => {
                  if (frame.current) frame.current.src = route;
                }}
              >
                Go
              </button>
            </div>
            <iframe
              ref={frame}
              title="Site preview"
              src={route}
              onLoad={wirePreview}
            />
          </main>

          <aside className="studio-inspector">
            {selected ? (
              <>
                <h2>{selected}</h2>
                <p className="studio-hint">
                  {page}.json
                  {Array.isArray(data[selected])
                    ? ' · paragraphs, separated by a blank line'
                    : null}
                </p>
                <textarea
                  value={valueOf(selected)}
                  onChange={(e) =>
                    setDirty((d) => ({...d, [selected]: e.target.value}))
                  }
                  spellCheck
                />
                {selected in dirty ? (
                  <button
                    type="button"
                    className="studio-undo"
                    onClick={() =>
                      setDirty((d) => {
                        const {[selected]: _drop, ...rest} = d;
                        return rest;
                      })
                    }
                  >
                    Undo this one
                  </button>
                ) : null}
              </>
            ) : (
              <p className="studio-empty">
                Click any highlighted text in the preview, or pick a string on
                the left.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

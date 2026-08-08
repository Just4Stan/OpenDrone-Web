import {useCallback, useEffect, useState} from 'react';

/**
 * The Legal tab: the terms, privacy and policy pages, edited as Markdown.
 *
 * These are the one part of the site that is genuinely a document rather than a
 * page made of strings, so they get a document editor instead of a key list.
 *
 * Five of the Dutch files are copied in from the external compliance repo by
 * `npm run sync:legal` on every build. Editing those here would be quietly
 * undone, so they are shown, marked, and read-only. Everything else, all of
 * `en/` and `fr/` and the four `nl/` files the sync deliberately skips, is
 * hand-authored and editable.
 */

type LegalPage = {
  file: string;
  locale: string;
  name: string;
  syncManaged: boolean;
};

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

const title = (name: string) => name.replace(/\.md$/, '').replace(/-/g, ' ');

export function StudioLegal({setStatus}: {setStatus: (s: string) => void}) {
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [current, setCurrent] = useState<LegalPage | null>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    api<{pages: LegalPage[]}>('/legal')
      .then((r) => {
        setPages(r.pages);
        const locked = r.pages.filter((p) => p.syncManaged).length;
        setStatus(
          `${r.pages.length} legal pages, ${locked} kept in step with the compliance repo`,
        );
        if (r.pages.length) setCurrent(r.pages[0]);
      })
      .catch((e: unknown) => setStatus(`Could not list: ${(e as Error).message}`));
  }, [setStatus]);

  const open = useCallback((p: LegalPage) => {
    setCurrent(p);
    api<{text: string}>('/read-text', {file: p.file})
      .then((r) => {
        setText(r.text);
        setSaved(r.text);
      })
      .catch((e: unknown) => setStatus(`Could not read: ${(e as Error).message}`));
    // setStatus is stable for the lifetime of the tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (current) open(current);
    // Only when the selection changes, not when `open` is re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.file]);

  const dirty = text !== saved;

  const save = async () => {
    if (!current) return;
    try {
      await api('/write-text', {file: current.file, text});
      setSaved(text);
      setStatus(`Saved ${current.file}`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const byLocale = (loc: string) => pages.filter((p) => p.locale === loc);

  return (
    <div className="studio-grid">
      <aside className="studio-rail">
        {['en', 'nl', 'fr'].map((loc) => (
          <div key={loc}>
            <h2>{loc.toUpperCase()}</h2>
            <ul className="studio-pages">
              {byLocale(loc).map((p) => (
                <li key={p.file}>
                  <button
                    type="button"
                    className={current?.file === p.file ? 'is-on' : undefined}
                    onClick={() => setCurrent(p)}
                    title={p.syncManaged ? 'Synced from the compliance repo' : p.file}
                  >
                    {title(p.name)}
                    {p.syncManaged ? (
                      <span className="studio-locked"> synced</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      <main className="studio-stage">
        <div className="studio-urlbar">
          <span className="studio-hero-note" style={{marginLeft: 0}}>
            {current ? current.file : 'No page selected'}
          </span>
          <div className="studio-actions" style={{marginLeft: 'auto'}}>
            <button type="button" onClick={() => setText(saved)} disabled={!dirty}>
              Revert
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => void save()}
              disabled={!dirty || Boolean(current?.syncManaged)}
            >
              {dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        {current?.syncManaged ? (
          <p className="studio-token-note" style={{margin: 12}}>
            This page is copied in from the compliance repo every time the site
            is built, so an edit here would be thrown away. Change it there
            instead. Shown read-only so you can check what is live.
          </p>
        ) : null}

        <textarea
          className="studio-doc"
          value={text}
          readOnly={Boolean(current?.syncManaged)}
          onChange={(e) => setText(e.target.value)}
          spellCheck
        />
      </main>
    </div>
  );
}

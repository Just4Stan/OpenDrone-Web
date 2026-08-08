import {useCallback, useEffect, useMemo, useState} from 'react';

/**
 * The Media tab: every picture in `public/`, and where each one is used.
 *
 * Deliberately read-only on the files themselves. The studio can tell you what
 * exists, how big it is, and which pages reference it, and it can hand you the
 * path to paste into a copy key. It cannot upload or delete, because binary
 * assets should arrive the same way every other asset does, through git, and an
 * upload button would quietly become the one place changes bypass review.
 *
 * What it is actually for is the question you cannot answer from a file
 * listing: "is anything still using this, and what breaks if I swap it?"
 */

type Img = {path: string; bytes: number};

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

const kb = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;

export function StudioMedia({setStatus}: {setStatus: (s: string) => void}) {
  const [images, setImages] = useState<Img[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Img | null>(null);
  const [usage, setUsage] = useState<string[] | null>(null);

  useEffect(() => {
    api<{images: Img[]}>('/media')
      .then((r) => {
        setImages(r.images);
        setStatus(`${r.images.length} images in public/`);
      })
      .catch((e: unknown) =>
        setStatus(`Could not list media: ${(e as Error).message}`),
      );
  }, [setStatus]);

  // Usage is per-selection, because answering it needs a scan of app/ and
  // content/ and nobody wants that for every thumbnail on every load.
  const look = useCallback((img: Img) => {
    setSelected(img);
    setUsage(null);
    api<{files: string[]}>('/usage', {needle: img.path})
      .then((r) => setUsage(r.files))
      .catch(() => setUsage([]));
  }, []);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? images.filter((i) => i.path.toLowerCase().includes(q)) : images;
  }, [images, filter]);

  return (
    <div className="studio-media">
      <div className="studio-media-main">
        <div className="studio-urlbar">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or folder"
            aria-label="Filter images"
          />
          <span className="studio-hero-note">
            {shown.length} of {images.length}
          </span>
        </div>
        <div className="studio-media-grid">
          {shown.map((img) => (
            <button
              type="button"
              key={img.path}
              className={`studio-media-item${
                selected?.path === img.path ? ' is-on' : ''
              }`}
              onClick={() => look(img)}
              title={img.path}
            >
              <span className="studio-media-thumb">
                <img src={img.path} alt="" loading="lazy" />
              </span>
              <span className="studio-media-name">
                {img.path.slice(img.path.lastIndexOf('/') + 1)}
              </span>
              <span className="studio-media-size">{kb(img.bytes)}</span>
            </button>
          ))}
        </div>
      </div>

      <aside className="studio-inspector">
        {selected ? (
          <>
            <h2>{selected.path.slice(selected.path.lastIndexOf('/') + 1)}</h2>
            <p className="studio-hint">
              {selected.path} · {kb(selected.bytes)}
            </p>
            <span className="studio-media-preview">
              <img src={selected.path} alt="" />
            </span>
            <button
              type="button"
              className="studio-undo"
              onClick={() => {
                void navigator.clipboard
                  .writeText(selected.path)
                  .then(() => setStatus(`Copied ${selected.path}`))
                  .catch(() => setStatus('Clipboard blocked by the browser'));
              }}
            >
              Copy path
            </button>

            <h2>Used in</h2>
            {usage === null ? (
              <p className="studio-empty">Looking…</p>
            ) : usage.length === 0 ? (
              <p className="studio-empty">
                Nothing references this path. Either it is unused, or it is built
                into a name at runtime rather than written out in full.
              </p>
            ) : (
              <ul className="studio-usage">
                {usage.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="studio-empty">
            Pick an image to see its path, its size, and which files reference
            it. To add one, drop it in <code>public/</code> and it appears here.
          </p>
        )}
      </aside>
    </div>
  );
}

import {useEffect, useState} from 'react';

/**
 * The Hero tab: the 3D scene's tuning panel, embedded rather than rebuilt.
 *
 * `public/models/<design>/_studio.html` already exists and is good. It loads the
 * real GLB, renders it with the real material and lighting rig, and exposes
 * every knob as a live control. Rebuilding that inside React would mean a second
 * three.js scene to keep in step with the first, which is the kind of duplicate
 * that quietly drifts. So it is iframed, same-origin, exactly as the page
 * previews on the other tabs are.
 *
 * It is a full-screen tool with its own side panel, so it gets the whole area
 * with no second preview column.
 */

/** Design folders under `public/models/`. One entry per hero model. */
const DESIGNS = [{id: 'od3', label: 'OpenDrone 3"'}];

export function StudioHero({setStatus}: {setStatus: (s: string) => void}) {
  const [design, setDesign] = useState(DESIGNS[0].id);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setStatus(
      'Tuning the hero scene. Saving writes public/models/' +
        design +
        '/studio.json, which the live homepage reads.',
    );
  }, [design, setStatus]);

  return (
    <div className="studio-hero">
      <div className="studio-hero-bar">
        <label htmlFor="hero-design">Model</label>
        <select
          id="hero-design"
          className="studio-select"
          value={design}
          onChange={(e) => setDesign(e.target.value)}
        >
          {DESIGNS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          title="Reload the scene from the saved settings"
        >
          Reload
        </button>
        <a href={`/models/${design}/_studio.html`} target="_blank" rel="noreferrer">
          Open full screen ↗
        </a>
        <span className="studio-hero-note">
          Changes preview live in the scene. Save writes the file the homepage
          reads.
        </span>
      </div>
      <iframe
        key={`${design}-${reloadKey}`}
        title="Hero scene studio"
        src={`/models/${design}/_studio.html`}
      />
    </div>
  );
}

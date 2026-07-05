import {useEffect, useRef, useState} from 'react';
import {useLocation} from 'react-router';
import {TriangleAlert} from 'lucide-react';
import {ScrambleText} from '~/components/ScrambleText';

/**
 * The 404 easter egg. An FPV "lost signal / failsafe" screen — the quad has
 * flown out of range, the OSD telemetry has flatlined, and the only way back
 * is RTH (Return To Home). Drone pilots will get the joke instantly.
 */
export function SignalLost() {
  const location = useLocation();
  const path = location.pathname || '/';
  const [link, setLink] = useState(2);
  const failedAt = useRef(false);

  // RSSI death-rattle: link quality stutters down to nothing, then locks at 0.
  useEffect(() => {
    if (failedAt.current) return;
    let raf = 0;
    let t = 0;
    const tick = () => {
      t += 1;
      // jittery decay — a few false-hope flickers before it gives up
      const noise = Math.sin(t * 0.7) * Math.sin(t * 0.21);
      const v = Math.max(0, 2 + noise * 1.4 - t * 0.06);
      setLink(v);
      if (v <= 0.02) {
        setLink(0);
        failedAt.current = true;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bars = [0.2, 0.45, 0.7, 1.0];

  return (
    <div className="signal-lost" role="alert">
      <div className="signal-lost-osd">
        {/* top telemetry rail */}
        <div className="osd-rail osd-rail-top">
          <span className="osd-stat">
            BATT <b>0.0</b>V
          </span>
          <span className="osd-rec">
            <i />REC 00:00
          </span>
          <span className="osd-stat osd-rssi">
            RSSI{' '}
            <span className="osd-bars" aria-hidden="true">
              {bars.map((threshold, i) => (
                <i key={i} data-on={link >= threshold ? '1' : '0'} />
              ))}
            </span>
            <b>{Math.min(100, Math.round(link * 50))}%</b>
          </span>
        </div>

        {/* center stage */}
        <div className="osd-stage">
          <p className="signal-lost-status" data-glitch="404">
            404
          </p>
          <p className="signal-lost-title">
            {/* Decode-in on the failsafe banner — corrupted-link flavor for
                the OSD scene, and the one deliberate scramble easter egg the
                design brief allows. */}
            <ScrambleText text="SIGNAL LOST" duration={900} delay={200} />
          </p>
          <p className="signal-lost-sub">
            no link to <code>{path}</code>. Failsafe engaged
          </p>
        </div>

        {/* bottom telemetry rail */}
        <div className="osd-rail osd-rail-bottom">
          <span className="osd-stat">GPS 0 SATS</span>
          <span className="osd-stat osd-warn">
            <TriangleAlert
              size={12}
              strokeWidth={2}
              aria-hidden="true"
              style={{display: 'inline', verticalAlign: '-1px', marginRight: '0.4em'}}
            />
            FAILSAFE
          </span>
          <span className="osd-stat">ALT 0.0m</span>
        </div>
      </div>

      <div className="signal-lost-actions">
        <a href="/" className="hero-cta-primary">
          Return to Home <span className="rth-tag">RTH</span>
        </a>
        <a href="/collections/all" className="hero-cta-secondary">
          Shop
        </a>
      </div>
    </div>
  );
}

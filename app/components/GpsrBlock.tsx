import {Link} from 'react-router';
import type {CompanyIdentity} from '~/lib/company';

/**
 * GPSR (EU) 2023/988 Art. 19 information for product listings: manufacturer
 * identity with postal and electronic address, safety warnings in NL/FR/EN,
 * and the EU DoC pointer. Rendered as a quiet compliance strip at the very
 * bottom of the product page, deliberately outside the product story
 * (Stan, 2026-08-15). The email is plain text here on purpose: Art. 19
 * requires an electronic address on the offer itself, so the site-wide
 * no-mailto rule does not apply to product pages.
 */

const WARNINGS: Array<{lang: string; lines: string[]}> = [
  {
    lang: 'en',
    lines: [
      'Not a toy. Not for persons under 14; minors only under adult supervision.',
      'Component for self-built unmanned aircraft: the builder is responsible for the assembled aircraft and its lawful operation.',
      'LiPo batteries can ignite when damaged, shorted or overcharged; never charge unattended.',
      'Remove propellers before bench testing, configuration or firmware updates.',
      'Observe the voltage and current limits in the specifications; reverse polarity destroys the board.',
    ],
  },
  {
    lang: 'nl',
    lines: [
      'Geen speelgoed. Niet voor personen onder 14 jaar; minderjarigen alleen onder toezicht van een volwassene.',
      'Component voor zelfgebouwde onbemande luchtvaartuigen: de bouwer is verantwoordelijk voor het samengestelde toestel en het wettige gebruik ervan.',
      'LiPo-batterijen kunnen ontbranden bij beschadiging, kortsluiting of overladen; laad nooit zonder toezicht.',
      'Verwijder propellers vóór benchtests, configuratie of firmware-updates.',
      'Respecteer de spannings- en stroomlimieten in de specificaties; omgekeerde polariteit vernietigt het board.',
    ],
  },
  {
    lang: 'fr',
    lines: [
      "Ceci n'est pas un jouet. Interdit aux moins de 14 ans ; mineurs uniquement sous surveillance d'un adulte.",
      "Composant pour aéronefs sans équipage auto-construits : le constructeur est responsable de l'appareil assemblé et de son utilisation licite.",
      'Les batteries LiPo peuvent s’enflammer en cas de dommage, de court-circuit ou de surcharge ; ne chargez jamais sans surveillance.',
      'Retirez les hélices avant les essais au banc, la configuration ou les mises à jour du firmware.',
      'Respectez les limites de tension et de courant des spécifications ; une inversion de polarité détruit la carte.',
    ],
  },
];

export function GpsrBlock({company}: {company: CompanyIdentity}) {
  return (
    <section
      aria-label="Manufacturer and safety information"
      className="mt-16 border-t border-[var(--color-border)] px-6 py-8 text-[11px] leading-relaxed text-[var(--color-text-muted)]"
    >
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em]">
          Manufacturer &amp; safety information
        </p>
        <p className="mb-4">
          {company.name}, {company.address} &middot; {company.email} &middot;{' '}
          KBO/BCE {company.kbo} &middot;{' '}
          <Link to="/doc" className="underline underline-offset-2">
            EU Declaration of Conformity
          </Link>
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {WARNINGS.map((w) => (
            <ul key={w.lang} lang={w.lang} className="list-disc space-y-1 pl-4">
              {w.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

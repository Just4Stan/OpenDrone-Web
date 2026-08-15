import type {CompanyIdentity} from '~/lib/company';

/**
 * GPSR (EU) 2023/988 Art. 19 information block for product listings:
 * manufacturer identity with postal and electronic address, plus safety
 * warnings in the languages of the member state where the offer is made
 * (NL/FR for Belgium, EN as the site language). The email is rendered as
 * plain text here deliberately: Art. 19 requires an electronic address on
 * the offer itself, so the site-wide no-mailto rule does not apply to
 * product pages.
 */

const WARNINGS: Array<{lang: 'EN' | 'NL' | 'FR'; lines: string[]}> = [
  {
    lang: 'EN',
    lines: [
      'Not a toy. Not for persons under 14. Assembly and use by minors only under adult supervision.',
      'Component for self-built unmanned aircraft. The builder is responsible for the assembled aircraft and its lawful operation.',
      'LiPo batteries can ignite when damaged, shorted or overcharged. Never charge unattended.',
      'Remove propellers before bench testing, configuration or firmware updates.',
      'Observe the voltage and current limits in the specifications. Reverse polarity destroys the board.',
    ],
  },
  {
    lang: 'NL',
    lines: [
      'Geen speelgoed. Niet voor personen onder 14 jaar. Montage en gebruik door minderjarigen alleen onder toezicht van een volwassene.',
      'Component voor zelfgebouwde onbemande luchtvaartuigen. De bouwer is verantwoordelijk voor het samengestelde toestel en het wettige gebruik ervan.',
      'LiPo-batterijen kunnen ontbranden bij beschadiging, kortsluiting of overladen. Laad nooit zonder toezicht.',
      'Verwijder propellers vóór benchtests, configuratie of firmware-updates.',
      'Respecteer de spannings- en stroomlimieten in de specificaties. Omgekeerde polariteit vernietigt het board.',
    ],
  },
  {
    lang: 'FR',
    lines: [
      "Ceci n'est pas un jouet. Interdit aux moins de 14 ans. Assemblage et utilisation par des mineurs uniquement sous surveillance d'un adulte.",
      "Composant pour aéronefs sans équipage auto-construits. Le constructeur est responsable de l'appareil assemblé et de son utilisation licite.",
      'Les batteries LiPo peuvent s’enflammer en cas de dommage, de court-circuit ou de surcharge. Ne chargez jamais sans surveillance.',
      'Retirez les hélices avant les essais au banc, la configuration ou les mises à jour du firmware.',
      'Respectez les limites de tension et de courant des spécifications. Une inversion de polarité détruit la carte.',
    ],
  },
];

export function GpsrBlock({company}: {company: CompanyIdentity}) {
  return (
    <section className="gpsr-block mt-10 rounded border border-[var(--color-border)] p-5 text-sm text-[var(--color-text-muted)]">
      <h3 className="font-mono text-[12px] uppercase tracking-[0.2em] mb-3">
        Manufacturer &amp; safety information
      </h3>
      <p className="mb-4">
        Manufacturer: {company.name}, {company.address} &middot;{' '}
        {company.email} &middot; KBO/BCE {company.kbo}
      </p>
      <div className="space-y-3">
        {WARNINGS.map((w) => (
          <ul key={w.lang} className="list-disc pl-5 space-y-0.5" lang={w.lang.toLowerCase()}>
            {w.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

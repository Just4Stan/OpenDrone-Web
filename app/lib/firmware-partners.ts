/**
 * The upstream firmware projects our boards run on, with their donation
 * pages. One list, two consumers: the /firmware-partners page cards and the
 * PDP firmware chapter's donate links, so a URL change lands everywhere.
 *
 * There is deliberately no per-board fee here. The €1-per-board forwarding
 * scheme was cancelled by Stan (2026-08-11): financially it did not carry.
 * What the shop gives these projects instead is exposure (every product page
 * links them and their donation page), the regular certification sums their
 * hardware processes ask for, and occasional public donations.
 */
export type FirmwarePartner = {
  /** Copy key stem on /firmware-partners: `partner_<id>_*`. */
  id: string;
  /** Display name, matched against `content.firmware.project` on the PDP. */
  project: string;
  repoUrl: string;
  /** Public donation page. AM32 runs none; code and testing are the way in. */
  donationUrl?: string;
};

export const FIRMWARE_PARTNERS: FirmwarePartner[] = [
  {
    id: 'betaflight',
    project: 'Betaflight',
    repoUrl: 'https://github.com/betaflight/betaflight',
    // Betaflight has no OpenCollective; they take donations via Patreon
    // (and PayPal, linked from betaflight.com).
    donationUrl: 'https://www.patreon.com/betaflight',
  },
  {
    id: 'am32',
    project: 'AM32',
    repoUrl: 'https://github.com/am32-firmware/AM32',
  },
  {
    id: 'expresslrs',
    project: 'ExpressLRS',
    repoUrl: 'https://github.com/ExpressLRS/ExpressLRS',
    donationUrl: 'https://opencollective.com/expresslrs',
  },
];

export function partnerForProject(
  project?: string,
): FirmwarePartner | undefined {
  if (!project) return undefined;
  const p = project.trim().toLowerCase();
  return FIRMWARE_PARTNERS.find((f) => f.project.toLowerCase() === p);
}

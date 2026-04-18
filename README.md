# OpenDrone Web

Open-source storefront for [OpenDrone](https://opendrone.eu) — FPV flight controllers, ESCs, and frames. Built on Shopify Hydrogen 2026.1.x (React Router 7, Tailwind v4, r3f hero).

## Quick start

```sh
git clone https://github.com/Just4Stan/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env   # fill in Shopify tokens
npm run dev            # http://localhost:3000
```

Contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) (stack, scripts, workflow) and [SCOPE.md](SCOPE.md) (what's open, locked, forbidden).

## Compliance

Belgian BV selling EU-wide. Legal pages are authored separately and synced into `app/content/legal/` via `npm run sync:legal`. Override the authoring source with `COMPLIANCE_SRC=/path/to/legal-md`. Company identity (KBO/VAT/address) comes from `PUBLIC_COMPANY_*` env vars.

Full requirements: [COMPLIANCE.md](COMPLIANCE.md) — GPSR, OSS VAT, Peppol e-invoicing, GBA cookie rules, country shipping blocks, CRA SBOM downloads.

## Security

See [SECURITY.md](SECURITY.md). Do not open a public issue for vulnerabilities.

## License

[MIT](LICENSE). Hardware repos are CERN-OHL-S — see [OpenFC](https://github.com/Just4Stan/OpenFC) and [OpenESC](https://github.com/Just4Stan/Open-4in1-AM32-ESC).

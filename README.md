# OpenDrone Web

The online shop at **[opendrone.be](https://opendrone.be)** — open-source FPV
drone hardware, built and sold in Belgium: flight controllers (OpenFC),
4-in-1 ESCs (OpenESC), ExpressLRS receivers (OpenRX), and frames.

It's a Shopify storefront under the hood, but a custom one: a 3D hero on the
homepage, editorial product pages with board teardowns, and a chat-based
support desk that bridges to Discord. Selling entity is Incutec BV; OpenDrone
is the product brand. Source is open under MIT.

## Built with

- **[Shopify Hydrogen](https://hydrogen.shopify.dev/)** on **Oxygen** (Shopify's Cloudflare Workers host)
- **React 19** + **React Router 7** + **TypeScript**
- **Tailwind CSS v4** for styling, self-hosted Inter + JetBrains Mono
- **react-three-fiber** for the 3D homepage hero
- **Resend** for email, **Upstash Redis** for the support index, **Plausible** for cookieless analytics

Runs on Node 22 or 24 with npm 10+ (pinned in `package.json`).

## Run it locally

```sh
git clone https://github.com/incutec-hw/OpenDrone-Web.git
cd OpenDrone-Web
npm install
cp .env.example .env       # fill in your Shopify tokens — see docs/environment.md
npm run dev                # http://localhost:3000
```

Sign-in runs through a Hydrogen-managed `*.tryhydrogen.dev` tunnel (set up
automatically), so plain `localhost` won't complete the OAuth callback — use
the tunnel URL the dev server prints.

## Docs

The deep detail lives in [`docs/`](docs/) so this page stays readable:

- **[Architecture](docs/architecture.md)** — repo layout, the 68 routes, and how each subsystem works (catalog/PDP, cart, accounts, support bridge, newsletter, i18n, 3D hero, board art).
- **[Environment](docs/environment.md)** — every config variable, grouped and explained.
- **[Operations](docs/operations.md)** — scripts, tests, CI, and how the site deploys.
- **[Security](docs/security.md)** — headers, rate limits, secrets, and disclosure policy.
- **[Support system](docs/support.md)** — how customer tickets reach Discord and back.

## Contributing

Branch off `main`, sign your commits (`git commit -s`), and make sure
`npm run lint && npm run typecheck && npm run build` is green before opening a
PR. Full guidelines in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) for this repo. The hardware repos are CERN-OHL-S:
[OpenFC](https://github.com/incutec-hw/OpenFC),
[OpenESC](https://github.com/incutec-hw/OpenESC_20X20), and
[OpenRX](https://github.com/incutec-hw/OpenRX).

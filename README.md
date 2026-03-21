# OpenDrone Web

Webshop and marketing site for OpenDrone (working name). Built with Shopify Hydrogen (React/Remix) or Shopify Liquid theme.

## Architecture Decision

### Option A: Shopify Hydrogen (Headless)
- React + Remix frontend
- Shopify Storefront API as backend
- Host on Vercel (free hobby tier)
- Full design freedom
- Proper git workflow
- Cost: €5/month Shopify Starter + free Vercel

### Option B: Shopify Theme (Liquid)
- Customize a Shopify theme
- Liquid templating + HTML/CSS/JS
- Hosted by Shopify
- Less freedom but simpler
- Cost: €36/month Shopify Basic

## Style
- Dark background, clean engineering aesthetic
- Matches JustFPV YouTube style (1920x1080, dark)
- Product-focused, not marketing fluff
- Open source badge + GitHub links prominent
- Interactive BOM viewer (link to ibom)

## Pages Needed
- Landing / hero (product showcase)
- Product pages (stack, ESC, bare PCBs)
- About (open source mission, the team)
- Blog (engineering articles, launch updates)
- Legal (AV, privacy, cookies, herroepingsrecht)

## Belgian Legal Requirements
- Company info in footer: KBO, BTW, address
- Prices including 21% BTW
- Cookie consent banner
- ODR platform link
- Herroepingsrecht info + withdrawal form
- Dutch language support (minimum for Flanders market)

## Payment Providers
- Mollie (Bancontact = 25.7% of Belgian payments!)
- Shopify Payments / Stripe (cards, Apple Pay, Google Pay)

## Related Repos
- [OpenDrone](https://github.com/Just4Stan/OpenDrone) (private) — business/strategy
- [OpenFC](https://github.com/Just4Stan/OpenFC) — flight controller hardware
- [OpenESC 20x20](https://github.com/Just4Stan/Open-4in1-AM32-ESC) — ESC hardware

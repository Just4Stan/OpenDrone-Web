# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.** Use one of:

- Email: **stan@incutec.eu**
- Or use [GitHub private vulnerability reporting](https://github.com/Just4Stan/OpenDrone-Web/security/advisories/new)

The canonical policy — including CRA obligations, ENISA reporting timelines, triage windows, and patch SLAs — lives on the live site:

**https://opendrone.eu/security**

That page is the authoritative source. A machine-readable pointer is published at [`/.well-known/security.txt`](https://opendrone.eu/.well-known/security.txt).

## Scope of this repository

This file covers vulnerabilities in the storefront codebase. Hardware and firmware vulnerabilities follow the same policy but through the same contact channel.

In scope:

- This repository (`OpenDrone-Web`) and the site it deploys
- Authentication, session handling, checkout flow, customer data handling
- XSS, CSRF, SSRF, injection, auth bypass, IDOR

Out of scope:

- Denial of service attacks and volumetric testing
- Physical attacks, social engineering, or phishing of staff
- Third-party services not operated by Incutec (Shopify, Stripe, hosting providers)
- Reports generated solely by automated scanners without proof of exploitability

## What NOT to do

- Do not access accounts, data, or orders that aren't your own
- Do not run automated scanners against production
- Do not test payment flows with real cards

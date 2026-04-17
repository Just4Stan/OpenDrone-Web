# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Email **security@incutec.com** with:

- A description of the issue
- Steps to reproduce
- Affected version / commit SHA
- Your assessment of the impact

We aim to acknowledge reports within **72 hours** and to ship a fix or mitigation within **90 days** for confirmed issues. Coordinated disclosure is appreciated — we'll credit you in the release notes unless you prefer to stay anonymous.

For cryptographic verification of this address and the canonical policy, see [`/.well-known/security.txt`](https://opendrone.be/.well-known/security.txt) on the live site.

## Scope

In scope:

- This repository (`OpenDrone-Web`) and anything it deploys to `opendrone.be`
- Authentication, session handling, checkout flow, customer data handling
- XSS, CSRF, SSRF, injection, auth bypass, IDOR

Out of scope:

- Findings that require physical access to a user's device
- Social engineering of OpenDrone / Incutec staff
- Denial-of-service (rate limiting is Shopify's responsibility)
- Reports about missing security headers that have no demonstrable impact
- Issues in third-party dependencies without a working exploit against this repo

## What NOT to do

- Do not access accounts, data, or orders that aren't your own
- Do not run automated scanners against `opendrone.be` production
- Do not test payment flows with real cards

## Product hardware vulnerabilities

For vulnerabilities in OpenDrone hardware (flight controllers, ESCs, firmware), see the [Vulnerability Handling Policy](https://opendrone.be/security).

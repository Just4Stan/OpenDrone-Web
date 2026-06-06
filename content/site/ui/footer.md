# Footer — `Footer.tsx`, `CompanyFooterBlock.tsx`, `NewsletterSignup.tsx`

> source: app/components/Footer.tsx, app/components/CompanyFooterBlock.tsx, app/components/NewsletterSignup.tsx

The site footer: a newsletter signup card on top, then four columns
(company identity, Shop, Open Source + Company, Legal) and a bottom
copyright bar. The company identity values (name, address, KBO, VAT,
email, tel) are **env-driven** — only the static label prefixes are
editable here. The newsletter signup form is shared (also used in the
`wide` variant elsewhere); its full copy lives below.

## Company identity column

- **brand_heading:** OpenDrone
- **brand_lede:** OpenDrone is a product brand of
- **label_kbo:** KBO/BCE:
- **label_vat:** BTW/VAT:

The company name, address, KBO/BCE number, VAT number, email, and phone
are **dynamic** (from `CompanyIdentity` / env) — do not invent. The phone
line is hidden when unset or `[pending]`.

## Column headings

- **heading_shop:** Shop
- **heading_open_source:** Open Source
- **heading_company:** Company
- **heading_legal:** Legal

## Shop column links

- **shop_catalog:** Catalog
- **shop_newsletter:** Newsletter
- **shop_search:** Search

## Open Source column links

- **os_github:** GitHub
- **os_openfc:** OpenFC
- **os_openesc:** OpenESC

## Company column links

- **company_open_source:** How we open source
- **company_firmware_partners:** Firmware partners
- **company_legal_imprint:** Legal / Imprint
- **company_contact:** Contact
- **company_security:** Security

## Legal column links

- **legal_terms:** Terms & Conditions
- **legal_privacy:** Privacy
- **legal_cookies:** Cookies
- **legal_withdrawal:** Right of withdrawal
- **legal_shipping:** Shipping
- **legal_warranty:** Warranty
- **legal_export_compliance:** Export compliance
- **legal_cookie_settings:** Cookie settings

## Bottom bar

- **copyright_aria_github:** GitHub

### prose: copyright

&copy; {year} {company.name}. Hardware: CERN-OHL-S. Firmware: GPL/MIT. Open Source Hardware.

The year is computed and the company name is **dynamic**; the rest of the
line is editable copy.

## Newsletter signup (shared component)

- **eyebrow:** Newsletter · Engineering Essentials
- **heading:** Product releases. Build notes.
- **lede:** Only when there’s something to ship. No marketing fluff. Unsubscribe anytime.
- **honeypot_label:** Website
- **email_label:** Email address
- **email_placeholder:** you@domain.com
- **submit:** Subscribe
- **submit_pending:** Subscribing…
- **privacy_link:** Privacy

### prose: consent

I agree to receive updates from OpenDrone. [Privacy](/privacy).

The consent line renders as "I agree to receive updates from OpenDrone."
followed by the linked word "Privacy" and a trailing period.

## Newsletter signup — client-side validation messages

- **err_no_email:** Enter your email address.
- **err_no_consent:** Please confirm you want to receive updates.

Server-returned status/error messages (success, already-subscribed, rate
limit, etc.) are captured in `newsletter.md`, not here.

```do-not-edit
Footer link hrefs:
Shop: Catalog → /collections/all ; Newsletter → /newsletter ; Search → /search
Open Source (external): GitHub → https://github.com/incutec-hw ;
  OpenFC → https://github.com/incutec-hw/OpenFC ;
  OpenESC → https://github.com/incutec-hw/Open-4in1-AM32-ESC
Company: How we open source → /open-source ; Firmware partners →
  /firmware-partners ; Legal / Imprint → /legal ; Contact → /contact ;
  Security → /security
Legal: Terms & Conditions → /algemene-voorwaarden ; Privacy → /privacy ;
  Cookies → /cookies ; Right of withdrawal → /herroepingsrecht ;
  Shipping → /shipping ; Warranty → /warranty ;
  Export compliance → /export-compliance ; Cookie settings → /cookie-settings
Bottom bar GitHub → https://github.com/incutec-hw
Newsletter form posts to /newsletter ; Privacy link → /privacy
```

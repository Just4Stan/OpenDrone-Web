# Cookie Policy: Incutec BV

**Required if using any non-essential cookies. Belgian DPA: opt-in only, cookie walls prohibited.**
**Consent valid for 6 months, then re-ask.**

---

## COOKIEBELEID: INCUTEC BV

### Wat zijn cookies?

Cookies zijn kleine tekstbestanden die door een website op uw apparaat worden geplaatst wanneer u de website bezoekt. Ze worden gebruikt om de website te laten functioneren, om het gebruik te analyseren, en om een betere gebruikerservaring te bieden.

### Welke cookies gebruiken wij?

#### Strikt noodzakelijke cookies (geen toestemming vereist)

| Cookie | Doel | Bewaartermijn |
|--------|------|--------------|
| `cart`, `cart_sig`, `cart_ts`, `_secure_session_id`, `_shopify_tm` | Winkelwagen- en sessiebeheer (Shopify) | Sessie |
| `_tracking_consent`, `_cmp_a` | Uw cookievoorkeuren onthouden (Shopify Customer Privacy API) | 6 maanden |
| `__stripe_mid`, `__stripe_sid` | Fraudepreventie bij betaling (Stripe, Art. 6.1(f) AVG + Art. 129 WEC) | 1 jaar / sessie |

#### Analytische cookies

Wij gebruiken **Plausible Analytics** (EU-gehost, cookieloos). Plausible plaatst geen cookies en verwerkt geen persoonsgegevens waarvoor toestemming nodig is. Daarom tonen wij geen toestemmingsbanner voor analyse.

Shopify's ingebouwde analytische cookies (`_shopify_s`, `_shopify_y`) staan uit tenzij u deze expliciet aanvaardt.

#### Marketing cookies

Incutec BV gebruikt bij de lancering **geen marketing- of remarketingcookies**. Als dit verandert, wordt dit cookiebeleid bijgewerkt en vragen wij opnieuw uw toestemming.

### Toestemming

- Niet-essentiële cookies worden **pas geplaatst na uw uitdrukkelijke toestemming** (opt-in).
- U kunt uw toestemming op elk moment intrekken via de cookie-instellingen op onze website.
- Het weigeren van niet-essentiële cookies heeft geen invloed op de werking van de website.
- **Cookie walls zijn verboden:** wij weigeren u nooit toegang tot de website als u cookies weigert.

### Cookies beheren

U kunt cookies ook beheren via uw browserinstellingen:
- Chrome: chrome://settings/cookies
- Firefox: about:preferences#privacy
- Safari: Voorkeuren > Privacy

### Contact

Vragen over ons cookiebeleid: privacy@opendrone.be

---

*Incutec BV: Stapelhuisstraat 15, 3000 Leuven*

---

## Implementation Checklist (pre-launch)

### GBA cookie checklist (Oct 2023, binding)

1. Opt-in only. No non-essential cookies before the user clicks accept. No pre-ticked boxes.
2. "Reject all" button on the first banner layer, same prominence as "Accept all".
3. Visual equivalence: same colour, size, contrast.
4. No cookie walls. Site stays accessible if user rejects.
5. Granular consent per purpose (analytics, marketing, functional).
6. Re-ask consent every 6 months.
7. Persistent cookie-settings link in the footer.
8. Cookie policy reachable without accepting.

Source: https://www.dataprotectionauthority.be/publications/recommendation-no-01-2015-of-4-february-2015.pdf + GBA 2023 checklist.

### Incutec launch stance

- Analytics: **Plausible** (EU-hosted, cookieless). No GA4, no Meta Pixel at launch.
- Cookie banner: **Pandectes GDPR Compliance** Shopify app. Configure with GBA template (first-layer reject-all).
- Strictly-necessary only at Q3 2026 launch. Revisit marketing cookies if and when paid ads start.

### Shopify cookies to declare in the policy

| Cookie | Category | Consent? |
|---|---|---|
| `cart`, `cart_sig`, `cart_ts`, `_secure_session_id`, `_shopify_tm` | Strictly necessary | No |
| `_tracking_consent`, `_cmp_a` (Customer Privacy API) | Strictly necessary | No |
| `_shopify_s`, `_shopify_y` (Shopify analytics) | Analytics | Yes, opt-in |
| `_shopify_sa_t`, `_shopify_sa_p`, `_shopify_d`, `_orig_referrer`, `_landing_page` | Marketing | Yes, opt-in |
| Stripe `__stripe_mid`, `__stripe_sid` | Strictly necessary (fraud prevention, Art. 6.1(f) AVG + Art. 129 WEC) | No |

### Policy text updates before publishing
- Replace the analytics placeholder with the actual Shopify + Plausible entries above.
- Add: "wij gebruiken een opt-in cookiebanner die voldoet aan de GBA-checklist van 20 oktober 2023 (gelijkwaardige 'Alles weigeren'-knop op het eerste niveau)."
- Add the Stripe fraud-cookie legitimate-interest note.
- Add Shopify Customer Privacy API cookies to the strictly-necessary list.

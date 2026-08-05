# Legal / Imprint — `/legal`

> source: app/routes/legal.tsx, app/components/CompanyFooterBlock.tsx

Trilingual imprint/overview page (en/nl/fr) reached at `/{locale}/legal`
(bare `/legal` redirects to the visitor's locale). The seller identity
block values (company name, address, KBO/BCE, BTW/VAT, email, tel) come
from `getCompanyIdentity` (env), not editable here. The "Pages" grid lists
every legal page with a per-locale label and one-line description.

## Meta — en

- **title:** Legal / Imprint
- **description:** Legal identification of the seller behind the OpenDrone webshop and an overview of all legal pages.

## Meta — nl

- **title:** Juridisch / Colofon
- **description:** Juridische identificatie van de verkoper achter de OpenDrone-webshop en overzicht van alle juridische pagina’s.

## Meta — fr

- **title:** Mentions légales
- **description:** Identification juridique du vendeur derrière la boutique OpenDrone et aperçu de toutes les pages légales.

## Page chrome — en

- **page_title:** Legal
- **eyebrow:** Legal · Imprint
- **seller_heading:** Seller
- **pages_heading:** Pages
- **intro:** OpenDrone is a product brand operated by {companyName}. All orders are sold by the legal entity below.

## Page chrome — nl

- **page_title:** Juridisch
- **eyebrow:** Juridisch · Colofon
- **seller_heading:** Verkoper
- **pages_heading:** Pagina’s
- **intro:** OpenDrone is een merk uitgebaat door {companyName}. Alle bestellingen worden verkocht door onderstaande juridische entiteit.

## Page chrome — fr

- **page_title:** Mentions légales
- **eyebrow:** Juridique · Mentions
- **seller_heading:** Vendeur
- **pages_heading:** Pages
- **intro:** OpenDrone est une marque exploitée par {companyName}. Toutes les commandes sont vendues par l’entité juridique ci-dessous.

`{companyName}` is injected from the company identity — leave the token in place.

## Seller block — static label prefixes (CompanyFooterBlock)

- **label_kbo:** KBO/BCE:
- **label_vat:** BTW/VAT:

The company name, address, KBO/BCE number, VAT number, email and telephone
values are dynamic (from env via `getCompanyIdentity`) — not editable here.

## Pages grid — labels & descriptions

Each card links to `/{locale}/{slug}`. One `##` per slug below; edit the
label and description text after the colon.

### algemene-voorwaarden

- **label_en:** Terms & Conditions
- **label_nl:** Algemene Voorwaarden
- **label_fr:** Conditions Générales
- **desc_en:** B2C sale terms, ordering, delivery, warranty, complaints.
- **desc_nl:** Verkoopvoorwaarden B2C, bestelproces, levering, garantie, klachten.
- **desc_fr:** Conditions de vente B2C, commande, livraison, garantie, plaintes.

### privacy

- **label_en:** Privacy Policy
- **label_nl:** Privacybeleid
- **label_fr:** Politique de Confidentialité
- **desc_en:** GDPR — which personal data we process and why.
- **desc_nl:** GDPR — welke persoonsgegevens wij verwerken en waarom.
- **desc_fr:** RGPD — quelles données personnelles nous traitons et pourquoi.

### cookies

- **label_en:** Cookie Policy
- **label_nl:** Cookiebeleid
- **label_fr:** Politique de Cookies
- **desc_en:** List of cookies the webshop sets.
- **desc_nl:** Lijst van cookies die de webshop plaatst.
- **desc_fr:** Liste des cookies utilisés par la boutique.

### herroepingsrecht

- **label_en:** Right of Withdrawal
- **label_nl:** Herroepingsrecht
- **label_fr:** Droit de Rétractation
- **desc_en:** 14-day cooling-off period and model withdrawal form.
- **desc_nl:** 14-dagen bedenktijd + modelformulier voor herroeping.
- **desc_fr:** Délai de rétractation de 14 jours + formulaire type.

### shipping

- **label_en:** Shipping & Delivery
- **label_nl:** Verzending & Levering
- **label_fr:** Expédition & Livraison
- **desc_en:** Shipping zones, times and responsibility.
- **desc_nl:** Verzendzones, leveringstermijnen en risico.
- **desc_fr:** Zones d’expédition, délais et responsabilité.

### warranty

- **label_en:** Warranty
- **label_nl:** Garantie
- **label_fr:** Garantie
- **desc_en:** 2-year legal guarantee of conformity.
- **desc_nl:** 2-jarige wettelijke conformiteitsgarantie.
- **desc_fr:** Garantie légale de conformité de 2 ans.

### end-use

- **label_en:** End-Use Policy
- **label_nl:** End-Use Beleid
- **label_fr:** Politique d’Usage Final
- **desc_en:** Permitted and excluded end-uses for Incutec goods.
- **desc_nl:** Toegestaan en uitgesloten eindgebruik voor Incutec-goederen.
- **desc_fr:** Usages finaux autorisés et exclus pour les biens Incutec.

### security

- **label_en:** Security
- **label_nl:** Beveiliging
- **label_fr:** Sécurité
- **desc_en:** Coordinated vulnerability disclosure (CRA).
- **desc_nl:** Gecoördineerde kwetsbaarheidsmelding (CRA).
- **desc_fr:** Divulgation coordonnée des vulnérabilités (CRA).

### cookie-settings

- **label_en:** Cookie settings
- **label_nl:** Cookie-instellingen
- **label_fr:** Paramètres des cookies
- **desc_en:** Overview and reset of session cookies.
- **desc_nl:** Overzicht en reset van sessie-cookies.
- **desc_fr:** Aperçu et réinitialisation des cookies de session.

```do-not-edit
Slugs / routes (order = grid order): algemene-voorwaarden, privacy,
cookies, herroepingsrecht, shipping, warranty, end-use,
security, cookie-settings. Card link → /{locale}/{slug}. Page itself at
/{locale}/legal ; bare /legal 302-redirects to the visitor locale.
```

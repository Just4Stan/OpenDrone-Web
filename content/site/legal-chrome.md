# Legal page chrome — titles/eyebrows around every legal page body

> source: app/lib/i18n.ts (LEGAL_LABELS, LEGAL_UI_STRINGS)

The legal page *bodies* are Markdown in `app/content/legal/{en,nl,fr}/` —
edit those there (NL is synced from the compliance repo; see
`content/site/README.md`). This file is the trilingual **chrome** wrapped
around each body: the title, eyebrow, and short description per slug and
locale, plus the shared back-link / last-updated UI strings.

One `##` section per legal slug, with `### en` / `### nl` / `### fr`
sub-blocks of keyed bullets (title / eyebrow / description). Note: `terms`
is an alias of `algemene-voorwaarden` with the same English title and is
kept as its own slug.

## algemene-voorwaarden

### en

- **title:** General Terms & Conditions
- **eyebrow:** Legal
- **description:** Terms of sale between Incutec BV and OpenDrone customers.

### nl

- **title:** Algemene Voorwaarden
- **eyebrow:** Juridisch
- **description:** Verkoopvoorwaarden tussen Incutec BV en OpenDrone-klanten.

### fr

- **title:** Conditions Générales de Vente
- **eyebrow:** Juridique
- **description:** Conditions de vente entre Incutec BV et les clients OpenDrone.

## privacy

### en

- **title:** Privacy Policy
- **eyebrow:** Legal · GDPR
- **description:** How Incutec BV processes personal data for the OpenDrone webshop — GDPR compliant.

### nl

- **title:** Privacybeleid
- **eyebrow:** Juridisch · AVG
- **description:** Hoe Incutec BV persoonsgegevens verwerkt voor de OpenDrone-webshop — AVG-conform.

### fr

- **title:** Politique de Confidentialité
- **eyebrow:** Juridique · RGPD
- **description:** Comment Incutec BV traite les données personnelles pour la boutique OpenDrone — conforme au RGPD.

## cookies

### en

- **title:** Cookie Policy
- **eyebrow:** Legal
- **description:** Which cookies the OpenDrone storefront uses and why.

### nl

- **title:** Cookiebeleid
- **eyebrow:** Juridisch
- **description:** Welke cookies de OpenDrone-webshop gebruikt en waarvoor.

### fr

- **title:** Politique de Cookies
- **eyebrow:** Juridique
- **description:** Quels cookies la boutique OpenDrone utilise et pourquoi.

## herroepingsrecht

### en

- **title:** Right of Withdrawal
- **eyebrow:** Legal
- **description:** 14-day withdrawal right and standard withdrawal form.

### nl

- **title:** Herroepingsrecht
- **eyebrow:** Juridisch
- **description:** Herroepingstermijn van 14 dagen en modelformulier.

### fr

- **title:** Droit de Rétractation
- **eyebrow:** Juridique
- **description:** Délai de rétractation de 14 jours et formulaire type.

## shipping

### en

- **title:** Shipping & Delivery
- **eyebrow:** Legal
- **description:** Shipping options, delivery times, and country restrictions.

### nl

- **title:** Verzending & Levering
- **eyebrow:** Juridisch
- **description:** Verzendopties, leveringstermijnen en landbeperkingen.

### fr

- **title:** Expédition & Livraison
- **eyebrow:** Juridique
- **description:** Options d’expédition, délais de livraison et restrictions par pays.

## warranty

### en

- **title:** Warranty
- **eyebrow:** Legal
- **description:** 2-year legal guarantee of conformity on OpenDrone hardware sold by Incutec BV.

### nl

- **title:** Garantie
- **eyebrow:** Juridisch
- **description:** Wettelijke conformiteitsgarantie van 2 jaar op OpenDrone-hardware verkocht door Incutec BV.

### fr

- **title:** Garantie
- **eyebrow:** Juridique
- **description:** Garantie légale de conformité de 2 ans sur le matériel OpenDrone vendu par Incutec BV.

## security

### en

- **title:** Security — Vulnerability Disclosure
- **eyebrow:** Security
- **description:** How to report a vulnerability in OpenDrone hardware, firmware, or the webshop.

### nl

- **title:** Beveiliging — Kwetsbaarheidsmelding
- **eyebrow:** Beveiliging
- **description:** Hoe u een kwetsbaarheid kunt melden in OpenDrone-hardware, firmware of de webshop.

### fr

- **title:** Sécurité — Divulgation de Vulnérabilités
- **eyebrow:** Sécurité
- **description:** Comment signaler une vulnérabilité dans le matériel, le firmware ou la boutique OpenDrone.

## export-compliance

### en

- **title:** Export Compliance
- **eyebrow:** Legal
- **description:** Export control self-classification and sanctioned-country policy.

### nl

- **title:** Exportnaleving
- **eyebrow:** Juridisch
- **description:** Zelfclassificatie exportcontrole en beleid rond gesanctioneerde landen.

### fr

- **title:** Conformité à l’Exportation
- **eyebrow:** Juridique
- **description:** Auto-classification du contrôle des exportations et politique sur les pays sous sanction.

## end-use

### en

- **title:** End-Use Policy
- **eyebrow:** Legal
- **description:** Permitted and excluded end-uses for goods supplied by Incutec BV.

### nl

- **title:** End-Use Beleid
- **eyebrow:** Juridisch
- **description:** Toegestaan en uitgesloten eindgebruik voor goederen geleverd door Incutec BV.

### fr

- **title:** Politique d’Usage Final
- **eyebrow:** Juridique
- **description:** Usages finaux autorisés et exclus pour les biens fournis par Incutec BV.

## legal

### en

- **title:** Legal / Imprint
- **eyebrow:** Legal · Imprint
- **description:** Identity of the seller, mandatory pages, and external references.

### nl

- **title:** Juridisch / Colofon
- **eyebrow:** Juridisch · Colofon
- **description:** Identiteit van de verkoper, verplichte pagina’s en externe verwijzingen.

### fr

- **title:** Mentions Légales
- **eyebrow:** Juridique · Mentions
- **description:** Identité du vendeur, pages obligatoires et références externes.

## cookie-settings

### en

- **title:** Cookie settings
- **eyebrow:** Legal
- **description:** Manage your cookie preferences for the OpenDrone webshop.

### nl

- **title:** Cookie-instellingen
- **eyebrow:** Juridisch
- **description:** Beheer uw cookievoorkeuren voor de OpenDrone-webshop.

### fr

- **title:** Paramètres des Cookies
- **eyebrow:** Juridique
- **description:** Gérez vos préférences de cookies pour la boutique OpenDrone.

## terms

Alias of `algemene-voorwaarden`.

### en

- **title:** General Terms & Conditions
- **eyebrow:** Legal
- **description:** Terms of sale between Incutec BV and OpenDrone customers.

### nl

- **title:** Algemene Voorwaarden
- **eyebrow:** Juridisch
- **description:** Verkoopvoorwaarden tussen Incutec BV en OpenDrone-klanten.

### fr

- **title:** Conditions Générales de Vente
- **eyebrow:** Juridique
- **description:** Conditions de vente entre Incutec BV et les clients OpenDrone.

## Shared UI strings (LEGAL_UI_STRINGS)

### en

- **back_to_overview:** ← Back to legal overview
- **last_updated:** Last updated

### nl

- **back_to_overview:** ← Terug naar juridisch overzicht
- **last_updated:** Laatst bijgewerkt

### fr

- **back_to_overview:** ← Retour à l’aperçu juridique
- **last_updated:** Dernière mise à jour

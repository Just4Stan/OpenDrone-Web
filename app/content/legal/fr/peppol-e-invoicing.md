# Facturation électronique Peppol : Incutec BV

**Base juridique :** Loi belge du 6 février 2024 (Moniteur belge du 20.02.2024) modifiant le Code belge de la TVA (*Wetboek van de belasting over de toegevoegde waarde*, WBTW), qui introduit une obligation de facturation électronique structurée B2B obligatoire et anticipe le paquet de réforme ViDA (VAT in the Digital Age) de l'UE. La directive 2014/55/UE sur la facturation électronique dans les marchés publics a été transposée séparément en Belgique et ne couvre que les flux B2G.

**Sources :**
- Portail officiel belge : https://einvoice.belgium.be/en/article/when-e-invoicing-mandatory
- Portail officiel belge (logiciels / réception / envoi) : https://einvoice.belgium.be/en/article/software-solutions-sending-receiving-and-processing-electronic-invoices

---

## Périmètre

### Dans le périmètre (obligatoire à partir du 1er janvier 2026)

| Transaction | Peppol requis ? |
|---|---|
| Incutec → client professionnel belge (B2B, assujetti à la TVA) | Oui : facture électronique structurée via Peppol BIS Billing 3.0 |
| Incutec → revendeur/grossiste belge | Oui |
| Incutec → client R&D belge (p. ex. facturation de contrats) | Oui |
| Incutec reçoit une facture d'un fournisseur belge | Oui : doit être en mesure de RECEVOIR des factures Peppol |
| Incutec reçoit une facture d'un comptable belge | Oui |
| Incutec reçoit une facture d'un fournisseur d'hébergement, de télécoms ou d'assurance belge | Oui |

### Hors périmètre (mandat 2026 : les factures PDF classiques restent admises)

| Transaction | Peppol requis ? |
|---|---|
| Incutec → consommateur belge (B2C) | Non : une facture PDF/courriel suffit |
| Incutec → consommateur allemand/néerlandais/français (B2C, transfrontalier) | Non (B2C exempté) |
| Incutec → client B2B allemand (transfrontalier intra-UE) | Non requis par le mandat belge 2026. Le B2B transfrontalier reste hors périmètre jusqu'au mandat ViDA de l'UE. Le pays du destinataire peut imposer ses propres règles (p. ex. Allemagne avec une montée en puissance 2025–2028) |
| Incutec → entité exemptée de TVA en vertu de l'article 44 du Code belge de la TVA | Non |
| Incutec → fournisseur dans un pays non-UE | Non |

**Synthèse :** Peppol est obligatoire uniquement pour le B2B domestique belge, à la fois pour l'envoi et la réception. Les factures B2B transfrontalières restent sur PDF jusqu'à l'entrée en vigueur du mandat ViDA à l'échelle de l'UE, prévue le **1er juillet 2030**.

### E-reporting (mandat distinct, 1er janvier 2028)

La Belgique ajoutera un e-reporting quasi en temps réel (la « règle des 5 jours ») à partir de 2028. Il s'agit d'une obligation distincte qui sera réévaluée à l'approche de l'échéance.

---

## Parcours d'intégration Shopify → Peppol

Le cœur de Shopify ne génère pas nativement de XML Peppol BIS 3.0. Une application Shopify de facturation électronique ou un flux piloté par la comptabilité est requis pour générer les factures structurées pour les commandes B2B belges ; les commandes B2C restent sur PDF.

Si l'application principale de facturation électronique Shopify ne couvre pas proprement la facturation structurée belge, les options de repli incluent :

- **Flux piloté par la comptabilité :** pousser les données de commande Shopify dans le logiciel de comptabilité (exportation manuelle ou middleware léger) et laisser le système comptable générer la facture structurée
- **Point d'accès Peppol autonome :** moins cher qu'un middleware, mais crée deux registres de factures parallèles ; convient uniquement comme pont temporaire

### À éviter

- S'appuyer sur la fonction intégrée Shopify « Commandes > Imprimer la facture » pour le B2B : elle produit des PDF, pas du XML Peppol, et n'est pas conforme au B2B belge à partir du 1er janvier 2026
- Attendre la première vente B2B pour mettre en place le flux : tester la réception et l'envoi avant que la facturation ne commence

---

## Shopify Plus vs Basic pour Peppol

Ni Shopify Basic ni Shopify Plus n'embarquent de prise en charge native de Peppol. Les deux nécessitent une application tierce ou un middleware. Plus ajoute des fonctionnalités B2B de vente en gros (tarification client spécifique, délais de paiement), mais la génération Peppol est identique via les mêmes applications. Le choix du plan est donc indépendant de l'exigence Peppol.

---

## Exigences de format de facture (Peppol BIS Billing 3.0)

XML structuré, utilisant le profil Peppol BIS Billing 3.0 d'UBL 2.1, contenant les champs belges obligatoires :

- Émetteur : numéro d'entreprise (BCE/KBO, au format `BE 0xxx.xxx.xxx`), dénomination légale complète, adresse, IBAN
- Destinataire : numéro d'entreprise (pour le B2B), dénomination légale complète, adresse
- Lignes de facture : description, quantité, prix unitaire, taux de TVA, montant de TVA par ligne
- Totaux : net, TVA, brut
- Conditions de paiement et référence de paiement structurée (la *communication structurée* / *OGM* belge)
- Numéro de facture séquentiel (sans rupture)
- Date de facture et date de livraison
- Référence au mécanisme d'autoliquidation pour les livraisons intra-UE (une fois que la facturation électronique transfrontalière sera dans le périmètre)

Toutes les applications Peppol pour Shopify gèrent cela automatiquement : Incutec n'a qu'à saisir les bonnes coordonnées d'entreprise lors de la configuration de l'application.

---

## Sanctions en cas de non-conformité

Des amendes administratives sont infligées au titre du Code belge de la TVA et de l'Arrêté royal n° 44. L'échelle exacte est fixée par cet arrêté royal et peut être révisée — **vérifier les montants actuels par rapport au texte consolidé avant publication**. Au moment de la rédaction, les montants couramment cités sont de 1 500 € pour une première infraction (annulée en cas de correction rapide et de bonne foi), 3 000 € pour une deuxième infraction et 5 000 € pour une troisième infraction et les suivantes.

Outre l'amende administrative, une facture qui ne respecte pas le format structuré ne peut pas être utilisée comme preuve pour la déduction de la TVA côté destinataire, ce qui crée une pression commerciale à la conformité.

**Période de tolérance de 3 mois (1er janvier au 31 mars 2026) :** Pas de sanctions pour les infractions lorsque l'assujetti peut démontrer qu'il a entrepris des démarches raisonnables vers la conformité. Une conformité totale est attendue au lancement de la boutique en ligne indépendamment de cette fenêtre de tolérance.

Sources :
- https://einvoice.belgium.be/en/faq/specific-questions-about-e-invoicing
- https://einvoice.belgium.be/en/news/period-tolerance-during-first-three-months-2026

## Checklist de mise en œuvre

*Tout ce qui figure sous ce titre relève d'une planification interne détaillée et est retiré de la page juridique publique rendue. Il est conservé dans la source à des fins d'archivage.*

### Phase 1 : À la constitution de la BV
- [ ] Confirmer l'activation du numéro de TVA
- [ ] Ouvrir un point d'accès Peppol uniquement en réception jusqu'à ce que la plateforme principale de facturation électronique soit en ligne
- [ ] Router Peppol vers invoices@incutec.eu (ou un alias temporaire) jusqu’à ce qu’une infrastructure dédiée soit en place
- [ ] Tester la réception d'une facture Peppol

### Phase 2 : Pré-lancement
- [ ] Installer l'application Peppol Shopify choisie sur la boutique de développement
- [ ] Connecter l'application au système comptable afin que les factures B2B s'écoulent vers le flux Peppol
- [ ] Configurer le champ de numéro de TVA sur le checkout B2B Shopify avec validation VIES
- [ ] Test : passer une commande de test B2B → vérifier la génération du XML Peppol → vérifier la livraison au destinataire de test
- [ ] Test : passer une commande de test B2C → vérifier la facture PDF uniquement (pas de Peppol)
- [ ] Archivage : s'assurer que les factures Peppol sont conservées 10 ans (obligation belge de conservation TVA)

### Phase 3 : Mise en production
- [ ] Surveiller les 10 premières factures B2B pour la confirmation de livraison Peppol
- [ ] Réconcilier les commandes Shopify avec les factures Peppol envoyées et les écritures comptables mensuelles
- [ ] Revoir la tarification de l'application et du point d'accès annuellement

### Pile Incutec (référence interne)

La pile opérationnelle (logiciel comptable, point d'accès Peppol, application de facturation Shopify) est sélectionnée avec le comptable et revérifiée annuellement. La tarification, le choix des fournisseurs et le niveau de forfait ne sont pas suffisamment stables pour être publiés sur une page juridique publique.

### Critères de sélection
- Confirmer avec le comptable quelle plateforme de facturation structurée ou quel point d'accès il préfère
- Vérifier que la pile choisie peut acheminer le B2B belge en factures structurées tout en laissant le B2C sur PDF/courriel
- Vérifier la validation VIES, la numérotation des factures, la conservation et l'exportation pour la tenue des livres
- Vérifier si des clients B2B clés imposent des exigences de facturation supplémentaires

### Récapitulatif des coûts
Les prix évoluent plus vite que l'exigence légale. Prévoir un budget pour un prestataire de réception/envoi ou une plateforme pilotée par le comptable, toute application Shopify ou middleware nécessaire à la génération des factures B2B belges, ainsi que les tests et la revue annuelle de la conservation. Choisir la pile en fonction de son adéquation avec le comptable, de la conservation des factures, du support B2B belge et d'un repli B2C sans friction, non en fonction de tarifs promotionnels transitoires.

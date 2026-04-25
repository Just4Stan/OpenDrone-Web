# Note d'auto-classification en matière de contrôle des exportations : Incutec BV

**Objet :** Documenter que les produits d'Incutec ne sont pas soumis au contrôle des biens à double usage au titre du règlement (UE) 2021/821. À conserver pour les douanes et les autorités.

**Date d'évaluation :** 18 avril 2026
**Évaluateur :** Administrateur délégué, Incutec BV

---

## Produits évalués

| Produit | Description | Fréquence | Puissance maximale |
|---------|-------------|-----------|-----------|
| OpenFC-ECO / OpenFC | MCU + IMU + OSD, 7–36 VDC (2–6S) | 2,4 GHz (OpenFC complet uniquement, WiFi désactivé en usine) | s.o. |
| OpenESC 20x20 | Pilote de moteur BLDC, 11,1–25,2 VDC | s.o. | 35 A en continu |
| OpenESC 30x30 | Pilote de moteur BLDC, 11,1–25,2 VDC | s.o. | 120 A en continu |
| OpenRX Lite | RX ExpressLRS | 2,4 GHz ISM | ~10 dBm (télémétrie) |
| OpenRX Mono | RX ExpressLRS | 868 MHz (UE) + 2,4 GHz ISM | ≤ 25 mW PIRE (limites EN 300 220 / EN 300 328) |
| OpenRX Gemini | RX ExpressLRS (vraie diversité, chaîne RF × 2) | 868 MHz (UE) + 2,4 GHz ISM | ≤ 25 mW PIRE par chaîne |

## Réglementation applicable

Règlement (UE) 2021/821 sur les biens à double usage, Annexe I.

## Analyse

### Catégorie 7 — Navigation et avionique

- IMU MEMS commerciaux (MPU6000, BMI270) ; firmware open source (Betaflight, INAV ou interne)
- Fonctionnellement équivalents à des cartes de développement MCU à usage général équipées d'accéléromètres
- Ne satisfont pas aux seuils de performance de la catégorie 7A (INS de qualité militaire, gyroscopes à laser en anneau)
- **Conclusion : Non contrôlés**

### Catégorie 9A012 — Véhicules aériens sans pilote

- Contrôle des systèmes UAV complets atteignant des seuils spécifiques de portée, d'endurance et de charge utile
- Incutec ne vend que des composants individuels, et non des systèmes complets
- Électronique grand public pour multirotors auto-assemblés par les amateurs
- Les drones FPV de course/freestyle ne satisfont pas aux seuils de charge utile ou de portée du MTCR
- **Conclusion : Non contrôlés**

### Catégorie 5 — Télécommunications et sécurité de l'information

- ELRS et VTX fonctionnent sur les bandes ISM (2,4 GHz, 868/915 MHz, 5,8 GHz) — librement disponibles, sans licence
- Pas de chiffrement au-delà des protocoles sans fil standards ; la note 3 de la partie 2 de la catégorie 5 (« Note sur la cryptographie ») exempte les produits grand public n'utilisant qu'une cryptographie publiée ou standard
- Pas d'étalement de spectre de qualité militaire ni de résistance au brouillage
- **Conclusion : Non contrôlés**

### Clause balai de l'article 4 (utilisation finale militaire)

- L'article 4 du règlement (UE) 2021/821 prévoit une clause balai pour les articles non listés destinés à une utilisation finale liée aux ADM, à une utilisation finale militaire dans les pays sous embargo sur les armes, ou en tant que composants d'articles militaires exportés illégalement
- Les produits Incutec sont de l'électronique de loisir grand public sans application plausible aux ADM
- Incutec vérifie chaque commande par rapport aux listes de sanctions de l'UE et applique une diligence renforcée pour les destinations à haut risque de détournement
- **Risque : Négligeable pour les ventes commerciales standard**

(L'article 5 du règlement (UE) 2021/821, qui concerne les articles de cybersurveillance, ne s'applique pas à la gamme de produits Incutec.)

## Conclusion

Aucun des produits Incutec n'est listé à l'Annexe I du règlement (UE) 2021/821. Aucune licence d'exportation n'est requise pour les ventes commerciales vers les pays non soumis à sanctions.

## Mesures d'atténuation

Malgré la non-classification, Incutec applique les contrôles suivants :

1. Toutes les commandes sont vérifiées par rapport aux listes de sanctions de l'UE
2. Les commandes en gros inhabituelles vers des destinations sensibles sont signalées pour un examen manuel
3. Cette classification est réexaminée annuellement ou à l'ajout de nouveaux types de produits
4. Lorsque les produits Incutec sont expédiés en B2B vers des pays partenaires non UE et non listés à l'Annexe VIII, la clause « Pas de réexportation vers la Russie » de l'article 12 octies du règlement (UE) 833/2014 est incluse dans les contrats, car les composants essentiels d'Incutec relèvent de la liste UE des biens communs hautement prioritaires
5. Les expéditions vers la Russie, le Bélarus, l'Iran, la Syrie, la RPDC, Cuba, le Myanmar, la Crimée, ainsi que les territoires occupés de Donetsk et de Louhansk sont interdites dans la boutique en ligne

## Autorité belge

Flandre : Departement Kanselarij en Buitenlandse Zaken, Dienst Controle Strategische Goederen (dCSG) — https://www.fdfa.be/en/csg

**Signé :** Administrateur délégué, Incutec BV · **Date :** 18 avril 2026

## Notes

*Tout ce qui figure sous ce titre relève d'une analyse interne et ne fait pas partie de la note publique. Il est conservé dans le fichier source à des fins d'archivage et est retiré de la page juridique rendue.*

---

# Analyse spécifique à Incutec (avril 2026)

**Conclusion :** Produits non listés à l'Annexe I du règlement 2021/821. Aucune licence pour les ventes commerciales vers les pays non soumis à sanctions. Mais les produits SONT sur la liste UE **Common High Priority Items** (Annexe XL du règlement 833/2014), ce qui signifie que la clause « Pas de réexportation vers la Russie » s'applique à chaque vente B2B hors UE. **C'est là le véritable fardeau de conformité**, et non la classification à double usage de l'Annexe I.

## 1. Analyse détaillée de l'Annexe I (double usage)

### 5A002 Cryptographie — non applicable

- ELRS utilise un étalement de spectre LoRa sur bandes ISM. Pas de fonction de « sécurité de l'information » telle que définie dans la partie 2 de la catégorie 5.
- Le WiFi sur FC utilise du 802.11 standard avec une cryptographie commerciale publiée. La note 3 de la partie 2 de la catégorie 5 (« Note sur la cryptographie ») exempte les articles grand public n'utilisant qu'une cryptographie publiée/standard et disponibles au détail sans restriction. Incutec satisfait à tous les critères.

### 7A003 / 7A103 Navigation inertielle — non applicable

- 7A003 : INS militaires avec stabilité du biais gyroscopique ≤ 0,5°/h — les IMU MEMS de loisir sont 100 à 1000× pires
- 7A103 : INS de qualité missile. On en est très loin.

### 9A012 UAV — non applicable (aux composants)

- L'UE 9A012 contrôle les SYSTÈMES UAV complets avec une endurance ≥ 30 min ET une portée ≥ 300 km. Le FPV de course a un temps de vol typique de 3 à 8 min. Hors périmètre.
- Contrôle les systèmes COMPLETS, pas les composants.
- 9A012.b ne couvre les « composants spécialement conçus » que lorsqu'ils sont spécifiques à des systèmes UAV contrôlés. Les contrôleurs de vol et les ESC exécutant du firmware ouvert sont de l'électronique grand public générique utilisable dans tout ce qui comporte au moins 4 moteurs.
- Le BIS américain assouplit 9A012 en 2026 (EO 14307, Interim Final Rule de janvier 2026) : exclusion explicite des UAS non militaires avec une endurance < 30 min. L'UE n'a pas reflété cette mesure, mais la direction empruntée confirme que le FPV de loisir est hors périmètre. [Federal Register](https://www.federalregister.gov/documents/2026/01/21/2026-01059/streamlining-export-controls-for-drone-exports)

### 9A112 — non applicable

Sous-systèmes UAV dont les seuils de charge utile/portée ne sont pas atteints par le matériel FPV.

## 2. Clause balai de l'article 4 (utilisation finale militaire) — risque réel

L'article 4 est le piège. Même les articles non listés nécessitent une licence si l'exportateur « a connaissance » ou « a été informé » que les articles sont destinés à :
- Une utilisation finale ADM
- Une utilisation finale militaire dans les pays sous embargo sur les armes (Russie, Bélarus, Iran, Syrie, Myanmar, RPDC)
- Des composants d'articles militaires exportés illégalement

**Déclencheur :** Si le CSG flamand écrit « nous avons connaissance du fait que vos produits peuvent être utilisés militairement dans X », Incutec doit cesser d'expédier vers cette destination sans licence, indépendamment de l'Annexe I. Pas de notification = pas d'obligation, mais la règle du « aurait dû savoir » s'applique en cas d'indicateurs évidents.

**Indicateurs nécessitant un rejet :**
- Expéditions vers la Russie, le Bélarus, l'Iran, la Syrie, la RPDC, la Crimée, la RPD, la RPL (interdites de toute façon)
- Quantités importantes (> 50 unités) vers la Turquie, les EAU, le Kazakhstan, le Kirghizistan, l'Arménie, la Géorgie, l'Ouzbékistan, la Serbie, la Chine, Hong Kong — hubs de détournement russes documentés dans les paquets de sanctions UE
- Clients aux noms à consonance militaire ou adresses d'agences gouvernementales
- Commandes demandant des configurations « militaires », un durcissement ou le retrait de marquages civils
- Commandes urgentes avec paiement provenant d'entités de pays tiers

## 3. Sanctions Russie/Bélarus — le véritable fardeau de conformité

### Annexe VII (règlement 833/2014)

Articles de haute technologie interdits à destination de la Russie. Les condensateurs en aluminium ont été ajoutés dans le 13e paquet (février 2024). Les MCU figuraient déjà à l'Annexe VII auparavant. Les produits Incutec contiennent des MCU 8542.31 → **expédition au niveau composant vers la Russie interdite.** Pas de ventes directes ou indirectes vers la Russie, le Bélarus, la Crimée, la RPD, la RPL.

### Annexe XL (Common High Priority Items) — concerne directement Incutec

Les composants essentiels d'Incutec correspondent à la CHPL. Vérifier les affectations de niveaux par rapport au texte consolidé actuel avant de s'y fier :

- **HS 8542.31** Processeurs et contrôleurs (MCU FC STM32, AT32)
- **HS 8542.39** Autres CI
- **HS 8526.91** Appareils d'aide à la navigation radio (dépend du module : récepteurs GPS oui ; CI GNSS intégrés peuvent relever du 8542)
- **HS 8532.24** Condensateurs à diélectrique céramique, multicouches
- **HS 8504.40** Convertisseurs statiques (ESC, FC)
- **HS 8517.62 / 8517.69** Émetteurs-récepteurs radio (RX ELRS, VTX)
- **HS 8548.00** Parties électriques n.d.a.

[CHPL (BIS)](https://www.bis.gov/licensing/country-guidance/common-high-priority-items-list-chpl)

### Clause de l'article 12 octies « Pas de réexportation vers la Russie » — obligatoire

Mise en place progressive conformément au règlement 2023/2878 (12e paquet) :
- **Nouveaux contrats :** à partir du 20 mars 2024
- **Contrats préexistants :** à partir du 20 décembre 2024

**S'applique à Incutec** (vend des biens de l'Annexe XL). Exigences :
- Tous les contrats B2B avec des acheteurs non UE doivent inclure la clause de non-réexportation vers la Russie
- La clause doit comporter des recours exécutoires en matière de pénalités et de résiliation
- Les pays partenaires exemptés de la clause sont listés à l'Annexe VIII du règlement 833/2014. Vérifier la liste actuelle par rapport au texte consolidé avant chaque revue annuelle — les paquets récents ont ajusté la liste
- Expédition vers un détaillant suisse ou américain : généralement pas de clause. Expédition vers un détaillant turc, émirien, serbe ou kazakh : clause requise

**Ventes DTC aux consommateurs ?** Le règlement vise les « partenaires contractuels non établis dans l'UE », rédigé pour le B2B. Les commandes Shopify de consommateurs ne sont sans doute pas des « contrats » en ce sens, mais les orientations de la CE n'exemptent pas le DTC. **Approche prudente :** inclure la clause dans les CGV Shopify comme condition d'achat pour les expéditions hors UE.

[FAQ de la Commission sur la non-réexportation](https://finance.ec.europa.eu/system/files/2024-02/faqs-sanctions-russia-no-re-export_en.pdf) · [Note d'Arnold & Porter](https://www.arnoldporter.com/en/perspectives/advisories/2024/04/the-no-re-export-to-russia-clause)

### Clause contractuelle type Incutec (basée sur la clause type de la CE)

La clause type de la Commission dans la FAQ laisse le montant de la pénalité à la discrétion des parties. Le modèle Incutec ci-dessous fixe une pénalité précise ; les paragraphes (1) à (3) et (5) suivent de près le modèle CE et le paragraphe (4) est propre à Incutec.

```
No Re-export to Russia: Article 12g Compliance Clause

(1) The Buyer shall not sell, export or re-export, directly or indirectly,
to the Russian Federation, to Belarus, or for use in the Russian Federation
or in Belarus, any goods supplied under or in connection with this Agreement
that fall under the scope of Article 12g of Council Regulation (EU) No
833/2014.

(2) The Buyer shall undertake its best efforts to ensure that the purpose
of paragraph (1) is not frustrated by any third parties further down the
commercial chain, including by possible resellers.

(3) The Buyer shall set up and maintain an adequate monitoring mechanism
to detect conduct by any third parties further down the commercial chain
that would frustrate the purpose of paragraph (1).

(4) Any violation of paragraphs (1), (2), or (3) shall constitute a
material breach of an essential element of this Agreement, and Incutec BV
shall be entitled to seek appropriate remedies, including (a) termination
of this Agreement and (b) a penalty of 100% of the contract value or
€10,000, whichever is higher.

(5) The Buyer shall immediately inform Incutec BV of any problems in
applying paragraphs (1), (2), or (3), including any relevant activities
by third parties that could frustrate the purpose of paragraph (1). The
Buyer shall make available to Incutec BV information concerning compliance
with the obligations under paragraphs (1), (2), and (3) within two weeks
of the simple request of such information.
```

## 4. Sanctions Iran (règlement 267/2012)

L'Iran s'est procuré des composants pour les drones Shahed-136 via des pays tiers. L'UE a ajouté des restrictions sur les composants UAV en 2023. Ne rien expédier vers l'Iran. Signaler les commandes en gros provenant des hubs de détournement proches de l'Iran (EAU, Turquie, Arménie).

## 5. Conformité pratique

### Expédier sans licence et sans clause No-Russia :
- Les 27 États membres de l'UE
- Pays partenaires de l'Annexe VIII (vérifier la liste actuelle avant chaque expédition) : typiquement NO, CH, UK, US, CA, AU, NZ, JP, KR, IS, LI

### Expédier mais avec clause No-Russia obligatoire (B2B) :
- Partout ailleurs hors UE, hors Annexe VIII (Turquie, EAU, Thaïlande, Brésil, Inde, Mexique, Singapour, Malaisie, Vietnam, Afrique du Sud, etc.)

### Impossible d'expédier (interdit par les sanctions) :
- Russie, Bélarus (interdiction des biens de l'Annexe VII y compris les MCU 8542.31 ; restrictions complètes sur les biens de l'Annexe XL)
- Iran, Syrie, RPDC (embargo total)
- Crimée, RPD, RPL, zones occupées de Kherson et Zaporijjia
- Myanmar (partiel ; éviter totalement)
- Cuba (risque d'extraterritorialité américaine en cas d'utilisation de CI d'origine américaine)

### Diligence renforcée (risque élevé de détournement, même si légal) :
- Turquie, EAU, Kazakhstan, Kirghizistan, Arménie, Géorgie, Ouzbékistan, Serbie, Chine, Hong Kong, Vietnam
- Exiger une déclaration d'utilisateur final, vérifier le site web de l'entreprise, consulter les listes de sanctions, limiter les quantités, signaler les acheminements de paiement inhabituels

## 6. Autorité belge de contrôle des exportations

**Flandre :** Departement Kanselarij en Buitenlandse Zaken, Dienst Controle Strategische Goederen (dCSG).
- [fdfa.be/csg](https://www.fdfa.be/csg) · [Guichet numérique](https://www.fdfa.be/nl/digitaal-loket)
- Exemption Benelux : pas de licence pour les transferts intra-Benelux de biens à double usage
- Licences via le Digitaal Loket
- Frais : aucun pour les licences individuelles (selon l'information publique ; à vérifier avant la première demande)
- Délais : 4 à 8 semaines pour les licences individuelles (estimation sectorielle UE non vérifiée)

**Incutec :** aucune demande de licence nécessaire sauf réception d'une notification balai au titre de l'article 4. L'enregistrement n'est pas requis de manière proactive pour les articles non listés.

## 7. Programme interne de conformité (ICP) — recommandé, pas obligatoire

**Pas légalement obligatoire** pour les exportateurs d'articles non listés. Devient obligatoire en cas de demande d'autorisation globale au titre du règlement (UE) 2021/821.

La Commission UE recommande fortement les ICP pour les articles potentiellement sensibles. Les produits Incutec sont potentiellement sensibles (Annexe XL, risque de détournement vers la Russie) → **fortement recommandé** bien que non obligatoire. Proportionné à la taille : une politique d'une page + un SOP de screening + une tenue de registre suffisent à l'échelle d'Incutec.

[Recommandation UE 2019/1318](https://eur-lex.europa.eu/eli/reco/2019/1318/oj)

**Squelette minimal d'ICP :**
1. Engagement de la direction au plus haut niveau (déclaration signée par l'Administrateur délégué)
2. Attribution des responsabilités (Administrateur délégué en tant que responsable de la conformité à l'exportation)
3. Classification des articles (la présente note, mise à jour annuellement)
4. Screening des clients et des transactions
5. Screening de l'utilisation finale et de l'utilisateur final (checklist d'indicateurs, déclaration d'utilisateur final pour les commandes en gros)
6. Tenue de registre (5 ans pour les dossiers de commande et de screening)
7. Formation (revue annuelle ; personnel formé avant la première activité d'exportation)
8. Audit et revue (auto-audit annuel)
9. Signalement (filière d'escalade vers le CSG flamand)

## 8. Quand consulter un conseil externe

- **Immédiatement** en cas de notification balai du CSG flamand (lettre article 4)
- **Avant la première commande de gros** vers un pays à haut risque (Turquie, EAU, Kazakhstan, Chine) : revue juridique ponctuelle des CGV Shopify + modèles de gros
- **Commande suspecte supérieure à 10 000 €** que le responsable conformité ne peut trancher seul
- **Douane immobilisant une expédition** n'importe où dans l'UE

## 9. Actions contractuelles/CGV

- [ ] Ajouter la clause No-Russia au modèle d'accord de gros (B2B) : **obligatoire**
- [ ] Ajouter la clause No-Russia aux CGV Shopify (hors UE, hors Annexe VIII) : recommandé
- [ ] Ajouter une garantie de conformité au contrôle des exportations et aux sanctions dans les CGV Shopify
- [ ] Bloquer les expéditions vers la Russie/le Bélarus/l'Iran/la Syrie/la RPDC/Cuba/la Crimée/la RPD/la RPL dans la liste des pays Shopify
- [ ] Mettre en œuvre un formulaire de déclaration d'utilisateur final pour toute commande B2B > 5 000 € vers un pays hors Annexe VIII
- [ ] Publier une politique de conformité à l'exportation publique sur incutec.eu

## 10. Matrice récapitulative

| Scénario | Licence | Clause | Risque |
|----------|---------|--------|------|
| Consommateur DTC BE | Non | Non | Aucun |
| Consommateur DTC DE/FR | Non | Non | Aucun |
| Consommateur DTC CH | Non | Non (Annexe VIII) | Aucun |
| Consommateur DTC US | Non | Non (Annexe VIII) | Faible |
| Consommateur DTC Turquie | Non | Recommandée dans les CGV | Faible |
| Détaillant de gros CH | Non | Non | Faible |
| Détaillant de gros UK/US | Non | Non (Annexe VIII) | Faible |
| Détaillant de gros Turquie | Non | **Oui obligatoire** | Moyen (détournement) |
| Détaillant de gros EAU | Non | **Oui obligatoire** | ÉLEVÉ (détournement) |
| Détaillant de gros Kazakhstan | Non | **Oui obligatoire** | ÉLEVÉ (détournement) |
| N'importe où → Russie/Bélarus | **INTERDIT** | s.o. | Pénal |
| N'importe où → Iran/RPDC/Syrie | **INTERDIT** | s.o. | Pénal |

## Sources

- [Règlement UE 2021/821 Double usage](https://eur-lex.europa.eu/eli/reg/2021/821/oj/eng)
- [Règlement UE 833/2014 Russie consolidé](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02014R0833-20240625)
- [FAQ Commission No-Re-Export](https://finance.ec.europa.eu/system/files/2024-02/faqs-sanctions-russia-no-re-export_en.pdf)
- [Arnold & Porter 12g](https://www.arnoldporter.com/en/perspectives/advisories/2024/04/the-no-re-export-to-russia-clause)
- [CHPL BIS](https://www.bis.gov/licensing/country-guidance/common-high-priority-items-list-chpl)
- [CSG Flandre](https://www.fdfa.be/csg)
- [Recommandation UE 2019/1318 ICP](https://eur-lex.europa.eu/eli/reco/2019/1318/oj)
- [Politique d'exportation iFlight (référence comparative)](https://shop.iflight.com/Export-Policy-info)
- [OCCRP pièces UE dans les drones russes](https://www.occrp.org/en/investigation/made-in-the-eu-dropped-on-kyiv-how-european-parts-are-enabling-russias-winter-drone-war)
- [BIS drone IFR janvier 2026](https://www.federalregister.gov/documents/2026/01/21/2026-01059/streamlining-export-controls-for-drone-exports)

**Non vérifié — nécessite confirmation par rapport au texte consolidé actuel avant publication :**
- Frais de licence du CSG flamand (indiqués comme nuls — à vérifier)
- Délai de traitement du CSG flamand (indiqué 4 à 8 semaines — estimation sectorielle)
- Applicabilité de l'art. 12 octies aux ventes DTC aux consommateurs (approche prudente : inclure la clause dans les CGV quoi qu'il en soit)
- Liste des pays partenaires de l'Annexe VIII (change avec chaque paquet de sanctions)
- Affectations des niveaux CHPL et périmètre actuel de l'Annexe XL

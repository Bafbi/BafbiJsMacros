# Recherche — Taux de farm manuels FrenchSky

**Question :** combien d'items peut-on récolter à la main par heure pour chaque
ressource de l'économie FrenchSky ?

## TL;DR

1. **Aucune donnée publique de taux de farm n'existe pour FrenchSky** : pas de
   wiki officiel ni communautaire trouvé, le site officiel (frenchsky.ovh /
   frenchsky.net) ne documente que les fonctionnalités générales, et l'API ne
   propose **aucun endpoint de taux de farm** (toutes les routes probées
   `/api/v1/farm`, `/rates`, etc. répondent 404).
2. FrenchSky étant un serveur **Minecraft vanilla** (l'agriculture suit les
   mécaniques vanilla), les taux dépendent entièrement de **l'équipement du
   joueur** : enchantements (Efficiency, Fortune), Haste, matériau d'outil,
   design de la ferme. Il n'existe donc pas de « taux unique ».
3. **La bonne méthode est la mesure en jeu** — et vous avez déjà l'outil :
   le service `/metrics` de ce repo (HUD « Rate: X/min | Est: Y/hr »).
4. `rates.toml` est pré-rempli avec des **estimations de départ** issues des
   mécaniques vanilla (source : Minecraft Wiki), à affiner par mesure.

---

## 1. FrenchSky ne documente pas les taux de farm

- Site officiel ([frenchsky.ovh](https://www.frenchsky.ovh/)) : pages vitrine
  (fonctionnalités, mentions légales) — aucune page wiki, aucun guide de farm.
- Recherches web (« frenchsky wiki », « frenchsky taux de farm », « frenchsky
  farm guide ») : aucun résultat pertinent. Les wikis français de serveurs
  similaires (hypenetwork.fr, firstsky.net) ne sont pas FrenchSky.
- API (`frenchsky.net/api/v1/...`) : seul `/economy/items` et
  `/economy/items/<id>/history` existent. Probés et 404 :
  `/api/v1`, `/api/docs`, `/economy`, `/farm`, `/farms`, `/rates`,
  `/items/<id>`, `/economy/items/<id>`.
- L'historique expose `sales_period`, `target_volume`, `increase_score` (données
  marché), mais **rien sur la production**.

## 2. Les mécaniques vanilla qui déterminent les taux

Source principale : [Minecraft Wiki — Breaking](https://minecraft.wiki/w/Breaking)
et [Instant mining](https://minecraft.wiki/w/Instant_mining).

**Vitesse de cassage** — temps = dureté × 1,5 (bon outil) × (1/speed de l'outil) :

| Outil | Speed | | Outil | Speed |
|---|---|---|---|---|
| Main | 1 | | Fer | 6 |
| Bois | 2 | | Diamant | 8 |
| Pierre | 4 | | Netherite | 9 |
| Cuivre | 5 | | Or | 12 |

- **Efficiency** : +level²+1 à la speed (Eff V = +26).
- **Haste** : ×(1 + 20%×level). Haste II = ×1,4.
- **Casse instantanée** quand speed × haste ≥ dureté × 30 (ex. Eff V diamant +
  Haste II casse la pierre (dureté 1,5) instantanément : (8+26)×1,4 = 47,6 ≥ 45).

**Limites physiques de cadence (vanilla) :**
- Casse **non instantanée** : délai minimum de **0,3 s** entre deux blocs
  (6 ticks) → plafond de ~12 000 blocs/h.
- Casse **instantanée** : 1 tick/bloc → théoriquement 72 000 blocs/h, en
  pratique manuel ~30 000–50 000/h (déplacement, visée).

**Cultures (cassage instantané, pas d'outil requis)** — cadence limitée par le
déplacement (~1,5–3 plants/s en récoltant+replantant = ~6 000–12 000 plants/h).

**Rendements par plante (sans Fortune)** — source : [Minecraft Wiki — Crop farming](https://minecraft.wiki/w/Tutorials/Crop_farming) :

| Ressource | Rendement par plante |
|---|---|
| Blé | 1 blé + 1 graine |
| Carottes | 1–4 (moy. 2,5) |
| Pommes de terre | 1–4 (moy. 2,5) |
| Pommes de terre empoisonnées | 2 % des patates récoltées |
| Citrouilles | 1 |
| Pastèque (Blocs de Pastèque) | 3–7 tranches (moy. 5) |
| Fèves de cacao | 2–3 |
| Verrues du nether | 2–4 |
| Baies | 1–2 |
| Cactus | 1 par bloc |

> Fortune III multiplie les rendements (jusqu'à ~1,8×) — d'où l'importance de
> mesurer **avec votre équipement réel**.

**Blocs particuliers (pas farmables en vanilla sans Silk Touch)** :
herbe, mycélium, podzol, argile, neige, glace, blocs de champignon, tiges de
champignon, verrue du nether (bloc), feuilles. Sur FrenchSky ces ressources
viennent de fermes/îles custom — là encore, la mesure en jeu est indispensable.

## 3. Méthodologie recommandée (votre outil existe déjà)

Le service **Metrics** de ce repo (scripts/services/metrics) compte les blocs
cassés et affiche en HUD : `Rate: X/min | Est: Y/hr`.

1. `/metrics set` en visant le bloc cible.
2. Farmer **15 minutes** dans vos conditions réelles (ferme, équipement).
3. Noter le taux horaire affiché → reporter dans `rates.toml`.
4. Pour les cultures multi-items (carottes, patates, verrues…), multiplier le
   taux de blocs par le rendement moyen (tableau ci-dessus, ou comptez vos
   récoltes sur 15 min).

Astuce : 15 min suffisent pour un taux stable ; le HUD filtre sur 60 s glissantes.

## 4. Estimations de départ (pré-remplies dans rates.toml)

Valeurs « équipement correct, ferme optimisée, manuel » — **à affiner par
mesure** (elles servent à rendre le classement exploitable immédiatement) :

| Classe | Items | Est. items/h |
|---|---|---|
| Cultures (12k plants/h × rendement) | Blé, Graines, Citrouilles, Verrues | 12 000–36 000 |
| Cultures multi-drops | Carottes, Patates, Cacao, Pastèque | 30 000–60 000 |
| Exception | Pommes de terre empoisonnées | ~600 |
| Minage instantané (Eff V + Haste) | Pierres, Roches, Basalt, Magma | ~30 000 |
| Bûches (Eff V + Haste II hache) | 4 sortes de bûches | ~30 000 |
| Blocs Silk Touch | Herbe, Mycélium, Podzol, Argile, Neige, Glace | ~15 000–20 000 |
| Divers | Cactus, Lianes, Feuilles, Champignons | ~15 000–20 000 |
| Spécial | Éclats d'améthyste | ~2 000 (croissance) |

## Sources

- FrenchSky (site officiel) : https://www.frenchsky.ovh/
- API FrenchSky : https://www.frenchsky.net/api/v1/economy/items (probé : aucun endpoint taux)
- Minecraft Wiki — Breaking : https://minecraft.wiki/w/Breaking
- Minecraft Wiki — Instant mining : https://minecraft.wiki/w/Instant_mining
- Minecraft Wiki — Crop farming : https://minecraft.wiki/w/Tutorials/Crop_farming
- Minecraft Wiki — Farmland : https://minecraft.wiki/w/Farmland

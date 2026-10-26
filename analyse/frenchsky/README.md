# FrenchSky — Analyse économique

Outil local pour savoir **ce qui vaut le plus le coup de farmer** sur FrenchSky.
Les prix sont dynamiques (mis à jour toutes les 4h) : on télécharge les données
une fois, on les met en cache, et une page web affiche l'analyse.

## Utilisation

```bash
cd analyse/frenchsky
pnpm install

pnpm fetch        # télécharge les prix + historiques (cache valide 4h)
pnpm dev          # serveur local → http://localhost:8080
```

Puis renseignez vos taux de farm dans `rates.toml` :

```toml
"Baies" = 4000            # items récoltés par heure
"Bûches de chêne" = 1200
```

Le classement est basé sur **Revenu /h = prix farmage × taux**. Le bonus de
vente est affiché (colonne Bonus vente / Bonus /h) mais n'entre pas dans le
classement. Les tendances (24h et période) et la courbe viennent de
l'historique fourni par l'API (~4 jours de relevés).

## Taux de farm

`rates.toml` est pré-rempli avec des **estimations vanilla** (voir
`RESEARCH.md` — la recherche complète : aucun wiki FrenchSky public,
mécaniques vanilla, méthodologie). Affinez-les par mesure : `/metrics set` en
visant le bloc, farmer 15 min, reporter le taux horaire affiché en HUD.

## Commandes

| Commande | Effet |
|---|---|
| `pnpm fetch` | Rafraîchit si le cache a plus de 4h |
| `pnpm fetch:force` | Force le re-téléchargement complet |
| `pnpm fetch --limit 5` | Dev : seulement les 5 premiers items |
| `pnpm fetch --items 21,54` | Dev : items spécifiques (ids) |
| `pnpm list-items` | Affiche les noms exacts des items (pour rates.toml) |
| `pnpm dev` | Serveur local sur http://localhost:8080 |

## Respect de l'API

- Cache de 4h (la fréquence de mise à jour des prix).
- 3 secondes minimum entre deux requêtes.
- Lecture des headers `x-ratelimit-*`, pause automatique sur HTTP 429.
- Les historiques déjà à jour sont réutilisés.

> ⚠ L'API ignore le paramètre `period` : elle renvoie toujours les ~18
> derniers relevés (~4 jours). Les tendances affichées sont donc la variation
> sur 24h et sur toute la période disponible.

## Fichiers

```
index.html        page
app.js            logique (tableau triable, sparklines SVG)
style.css         thème sombre
rates.toml        vos taux de farm (à éditer)
fetch-data.mjs    téléchargement + cache
server.mjs        serveur statique zéro-dépendance
data/             données téléchargées (généré, gitignoré)
```

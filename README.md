# 🛡️ ThreatIntel - Analyse Globale AWS Honeypot

**Projet de Visualisation de Données - ESILV (2026)**  
Visualisation interactive codée exclusivement en D3.js natif.*

👉 **[Accéder au Dashboard Interactif (GitHub Pages)](https://nikosthoumyre.github.io/Data-Viz_Honey-Pot-Dashboard/)**

---

## 👥 Équipe du Projet
* **Sydney TEXIER**
* **Damien LEON**
* **Theotime RICAUX**
* **Nikos THOUMYRE**

---

## 📖 Contexte du Projet

Ce projet s'inscrit dans le cadre du cours de **Data Visualization**. Il a pour objectif d'explorer et d'analyser des données liées à la cybersécurité à travers la conception d'un tableau de bord interactif. 

L'approche choisie se concentre sur l'optimisation du **Data-Ink Ratio** et l'application des principes de **Gestalt** (proximité, similarité des couleurs) pour fournir une interface claire, épurée et professionnelle (type SaaS).

## 📊 Le Jeu de Données (Dataset)

Les données utilisées proviennent d'un **AWS Honeypot** (Pot de miel) déployé pour capturer des cyberattaques automatisées sur le cloud entre le **3 mars 2013 et le 8 septembre 2013**.  

Afin d'optimiser les performances du tableau de bord et d'éviter la saturation du navigateur, le projet a été migré d'un fichier CSV statique vers une architecture de base de données **PostgreSQL hébergée sur Supabase**.
* Les agrégations lourdes sont désormais déléguées au serveur via des **Vues SQL optimisées** (`view_map_stats`, `view_sankey_stats`, etc.).
* La récupération des données s'effectue de manière **asynchrone** (`async/await`, `Promise.all`) via le SDK Supabase, garantissant un affichage fluide des visualisations D3.js.

Les variables (features) principalement exploitées sont :
* `datetime` : Horodatage de l'attaque (utilisé pour la chronologie).
* `country` & `locale` : Pays et région d'origine de l'attaquant.
* `latitude` & `longitude` : Coordonnées spatiales (utilisées pour les points d'impact locaux).
* `proto` : Protocole réseau utilisé (TCP, UDP, ICMP).
* `dpt` : Port de destination ciblé sur le serveur.

---

## 🚀 Visualisations & Interactions Implémentées

Le tableau de bord propose 4 visualisations distinctes et complémentaires, répondant au modèle de référence de la visualisation d'information (Filtrage -> Mapping -> Rendu) :

### 1. Cartographie & Profilage (Map Drill-down)
* **Technique :** Carte Choroplèthe basée sur une projection `geoMercator` et un fichier `world.geojson`. L'intensité des couleurs (`d3.interpolateReds` avec échelle logarithmique) représente le volume d'attaques par pays.
* **Interactions :** 
  * Survol (Tooltip) pour afficher la volumétrie.
  * Clic sur un pays pour déclencher un **Zoom SVG** fluide (`d3.zoom`).
  * *Drill-down géographique :* Au niveau de zoom local, les données de `latitude` et `longitude` génèrent dynamiquement des bulles (`circle`) indiquant les régions précises d'où proviennent les attaques.

### 2. Chronologie Multidimensionnelle (Stacked Area Chart)
* **Technique :** Graphique en aires empilées (`d3.stack()`, `d3.area()`) découpant le volume total par protocoles.
* **Interactions :** 
  * Implémentation d'un module de sélection temporelle **Focus + Context** (via `d3.brushX()`) permettant d'isoler un pic d'attaque (ex: mai ou août 2013).
  * Ligne de repère verticale (Hover) avec formatage localisé en français (`d3.timeFormatDefaultLocale`).

### 3. Matrice des Menaces (Heatmap)
* **Technique :** Grille d'analyse croisant les 10 Pays les plus actifs face aux 15 Ports de destination les plus ciblés (`d3.scaleBand()`).
* **Objectif cognitif :** Permettre une identification visuelle instantanée ("Pattern recognition") des stratégies d'attaques spécifiques par pays, aidée par une échelle de couleurs logarithmique.

### 4. Diagramme de Flux d'Attaques (Sankey Diagram)
* **Technique :** Représentation des réseaux d'attaques (plugin `d3-sankey`).
* **Structure :** Pays d'origine (Top 20) ➔ Protocole (TCP/UDP) ➔ Port cible (Top 20).
* **Note Métier (Cybersécurité) :** Le protocole ICMP est volontairement exclu de cette visualisation. En tant que protocole de contrôle réseau, l'ICMP n'utilise pas de notion de "Port" de destination. Il a donc été isolé de ce pipeline spécifique.
* **UI/UX :** Hack algorithmique appliqué aux nœuds centraux pour forcer un centrage vertical absolu, équilibrant ainsi la courbure des flux (SVG Paths).

---

## 🛠️ Stack Technique

* **Base de données :** PostgreSQL (Supabase).
* **HTML5 / CSS3** (Utilisation de CSS Grid et Flexbox, design bicolore "Hero Header").
* **D3.js (v7.9.0)** : Manipulation du DOM, échelles, axes, transitions, parsing CSV et agrégations.
* **D3-Sankey (v0.12.3)** : Module additionnel officiel pour le rendu du graphique de flux.
* *Aucune autre librairie (Chart.js, Plotly, etc.) n'a été utilisée, conformément aux exigences du projet.*

---

## 💻 Exécution Locale

Si vous souhaitez faire tourner le projet en local :
1. Clonez ce dépôt.
2. Ouvrez le dossier dans VS Code.
3. Lancez l'extension **Live Server**.
4. Rendez-vous sur `http://127.0.0.1:5500/index.html`.

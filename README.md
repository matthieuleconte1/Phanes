# Phanès

Éditeur visuel de sites web assisté par IA. L’onboarding génère séparément le header, le contenu principal et le footer. Après chaque prompt, le résultat apparaît dans un aperçu en direct et l’utilisateur choisit la composition avant de continuer.

## Démarrage

```bash
npm start
```

Ouvrir ensuite <http://127.0.0.1:4173>.

Si le port `4173` est déjà utilisé, le serveur sélectionne automatiquement le
port suivant et affiche l’adresse exacte dans le terminal. Il est aussi possible
de choisir le port manuellement :

```bash
PORT=5000 npm start
```

## Arborescence

```text
.
├── public/
│   ├── app.js                 # orchestration de l'éditeur
│   ├── index.html
│   ├── styles.css
│   └── js/
│       ├── custom-runtime.js  # exécution isolée des blocs custom
│       ├── export-site.js     # génération de l'export HTML
│       └── media.js           # import et optimisation des images
├── src/server/
│   ├── project.mjs            # modèle, schémas et normalisation
│   └── providers.mjs          # Mistral Vibe et Antigravity CLI
├── test/                      # tests unitaires et HTTP
└── server.mjs                 # API, LM Studio et serveur statique
```

Le navigateur utilise des modules ES natifs, sans étape de build. Le fichier
`server.mjs` conserve les routes publiques tandis que la logique métier est
placée dans `src/server`.

## LM Studio

1. Charger un modèle instruct d’au moins 7B dans LM Studio.
2. Activer le serveur local dans l’onglet **Developer** sur le port `1234`.
3. Recharger Phanès. Le statut « LM Studio connecté » apparaît en bas à gauche.

Sans LM Studio, l’application reste utilisable avec son générateur local de secours.

## Mistral Vibe Online

Si le CLI `vibe` est installé et authentifié, le sélecteur de modèle affiche
**Mistral Vibe Online**. Ce fournisseur est disponible même lorsque LM Studio
est arrêté.

```bash
vibe --setup
npm start
```

Le serveur appelle Vibe en mode programmatique, sans shell et depuis `/tmp` :

- le chat reçoit seulement un résumé du projet ;
- une modification ciblée reçoit seulement le composant sélectionné ;
- la génération reçoit une seule région à la fois : header, main ou footer ;
- chaque appel possède une limite de tokens, de coût et de durée.

Mistral Vibe est un service en ligne : son utilisation peut consommer le quota
inclus dans l’abonnement ou générer des frais selon la configuration Mistral.

## Fonctionnalités

- onboarding multi-prompt avec génération et aperçu après chaque réponse ;
- choix de compositions distinctes pour le header, le main et le footer ;
- réglage de densité et autorisation explicite des mises en page audacieuses ;
- génération séquentielle et isolée de chaque région du site ;
- catalogue de 20 polices Google Fonts avec aperçu instantané ;
- choix entre Mistral Vibe Online, LM Studio et le moteur local de secours ;
- gestion de plusieurs pages avec navigation synchronisée ;
- assistant IA général capable de conseiller ou d’appliquer des modifications au projet ;
- sélection et modification visuelle des éléments ;
- modification IA isolée : seul le JSON du composant sélectionné est transmis et remplacé ;
- couleurs, dimensions, arrondis, espacement et effets au survol ;
- déplacement par glisser-déposer ou boutons accessibles ;
- placement libre des éléments dans une section, avec coordonnées X/Y et hauteur ajustable ;
- ajout, duplication et suppression de blocs ;
- import d’images locales ou ajout par URL, avec optimisation automatique ;
- blocs avancés générés librement en HTML, CSS et JavaScript par l’IA ;
- historique annuler/rétablir ;
- vues ordinateur, tablette et mobile ;
- modification IA de l’élément sélectionné ;
- aperçu et export HTML multipage responsive.

## Blocs personnalisés

Les primitives simples restent des blocs structurés faciles à déplacer et à
modifier : titre, texte, bouton, image, logo, navigation et séparateur. Pour les
compositions plus riches (bento, services, témoignages, tarifs, formulaires,
galeries, FAQ, animations), l’IA génère par défaut un élément `custom` avec son
HTML et son CSS normaux. Le JavaScript est facultatif pour un bloc statique.

Lorsqu’un script est présent, il reçoit `root`, le `ShadowRoot` isolé du
composant, et `host`, son conteneur. Il cible le contenu avec
`root.querySelector(...)`.

Sur le canvas et dans l’aperçu, ces scripts s’exécutent dans un environnement
sandboxé. L’export HTML conserve leur comportement interactif.

## Placement libre

Une section peut utiliser la disposition **Placement libre** depuis
l’inspecteur. Ses éléments deviennent positionnables avec une poignée de
déplacement et des coordonnées X/Y précises. Le bouton **Édition libre** du
canvas active ce comportement sur toute la page. Chaque bloc peut ensuite être
déplacé directement, redimensionné par sa poignée inférieure droite et chaque
section peut être allongée par sa poignée inférieure. Dans l’export, la composition libre est conservée sur ordinateur et
repasse automatiquement en colonne sur mobile pour éviter les débordements.

## Google Fonts

Le panneau de gauche permet de choisir une typographie globale parmi des
familles sans serif, serif et display. La police sélectionnée est chargée via
l’API CSS Google Fonts et enregistrée dans le thème du projet. L’aperçu et le
fichier HTML exporté incluent automatiquement la feuille de style distante et
une police de secours si le réseau est indisponible.

## Sécurité des modifications IA

Pendant l’onboarding, chaque appel ne génère qu’une région autorisée et le
serveur fusionne cette région sans remplacer les deux autres. Pour une
modification ciblée, Phanès envoie uniquement le composant sélectionné,
verrouille son identifiant et son type, filtre les styles retournés, puis
remplace ce composant uniquement. Les modifications plus générales passent par
le chat et restent validées par la structure complète du projet.

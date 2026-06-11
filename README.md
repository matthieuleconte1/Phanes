# Atelier AI

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

## LM Studio

1. Charger un modèle instruct d’au moins 7B dans LM Studio.
2. Activer le serveur local dans l’onglet **Developer** sur le port `1234`.
3. Recharger Atelier AI. Le statut « LM Studio connecté » apparaît en bas à gauche.

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
- ajout, duplication et suppression de blocs ;
- historique annuler/rétablir ;
- vues ordinateur, tablette et mobile ;
- modification IA de l’élément sélectionné ;
- aperçu et export HTML multipage responsive.

## Google Fonts

Le panneau de gauche permet de choisir une typographie globale parmi des
familles sans serif, serif et display. La police sélectionnée est chargée via
l’API CSS Google Fonts et enregistrée dans le thème du projet. L’aperçu et le
fichier HTML exporté incluent automatiquement la feuille de style distante et
une police de secours si le réseau est indisponible.

## Sécurité des modifications IA

Pendant l’onboarding, chaque appel ne génère qu’une région autorisée et le
serveur fusionne cette région sans remplacer les deux autres. Pour une
modification ciblée, Atelier AI envoie uniquement le composant sélectionné,
verrouille son identifiant et son type, filtre les styles retournés, puis
remplace ce composant uniquement. Les modifications plus générales passent par
le chat et restent validées par la structure complète du projet.

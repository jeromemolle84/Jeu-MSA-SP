# Jeu MSA SP+ — La confiance en action
### MSA Alpes-Vaucluse — jeu pédagogique (version intermédiaire)

Petit RPG pédagogique en vue du dessus, jouable directement dans un navigateur,
sans connexion internet. Le joueur rejoint l'agence MSA d'Avignon, rencontre
l'accueil, traite une situation inspirée de la loi ESSOC (droit à l'erreur),
puis reprend la route en voiture pour rejoindre une permanence du minibus
« Le Lien » en milieu rural (non-recours / aller-vers).

---

## Lancer le jeu

Le jeu fonctionne hors connexion. Deux façons de l'ouvrir :

**1. Le plus simple**
Double-cliquez sur `index.html`. Il s'ouvre dans votre navigateur par défaut
(Chrome, Edge ou Firefox).

**2. Si l'écran reste figé (sécurité des fichiers locaux)**
Lancez `lancer.bat` (Windows), ou un petit serveur :
`python -m http.server 8000` puis ouvrez `http://localhost:8000`.

---

## Commandes

- Déplacements : flèches ou ZQSD
- Interagir : E (ou Entrée)
- Carnet de mission : J
- Fermer une fenêtre / retour : Échap

---

## Nouveautés de cette version

- **Menu principal** redessiné et calibré, avec page **Crédits** (objectif du
  jeu, réalisation par Jérôme Mollé avec le concours de l'IA, logos MSA et SP+).
- **Personnalisation** : saisie du nom corrigée (toutes les lettres
  fonctionnent, y compris z, q, s, d, a, e, j, w) ; les prénoms sous les
  avatars ont été retirés.
- **Extérieur d'Avignon** : nouveau décor, plus vaste, avec **caméra qui suit
  le joueur et léger zoom** pour une impression de grandeur. Une **voiture de
  service MSA** est garée sur le parking.
- **Signalétique de l'agence** : l'interaction ouvre une fenêtre pixel art
  regroupant l'affiche d'affluence téléphonique, l'affiche du médiateur, la
  carte des accueils et le label Services Publics + Bronze. (Fermeture : E ou
  Échap.) L'information sur le bus « Le Lien » ne figure plus à Avignon.
- **Décor intérieur d'Avignon** et **carte régionale** mis à jour.
- **Personnages** : correction du « flottement » (les pieds touchent désormais
  le sol, avec une ombre propre).
- **Progression** : après la mission ESSOC, un PNJ invite à reprendre la route.
  La voiture MSA, à l'extérieur, ouvre la **carte régionale** pour choisir un
  lieu d'accueil. La permanence « Le Lien » est jouable ; les autres lieux
  sont annoncés « bientôt disponibles ».

---

## Nouveautés de cette mise à jour

- **Permanence « Le Lien » en deux temps** : on arrive d'abord sur la place du
  village (décor extérieur du bus). On interagit avec le marchepied pour monter
  à bord, et en ressortant on revient à l'extérieur du bus.
- **Nouvelle mission à Carpentras** : agence accessible depuis la carte
  régionale. Thème : les délais et engagements de réponse au public
  (accusé de réception, délai annoncé, information en cas de retard).
- **Carte régionale** : c'est désormais la voiture de service compacte qui s'y
  déplace (le bus a été retiré de la carte). Avignon, Carpentras et la
  permanence « Le Lien » sont jouables ; les autres communes arriveront.
- **Signalétique d'Avignon** : repositionnée à droite de l'entrée, au niveau du
  totem MSA.

## Mission Orange (nouvelle)

- **Nouvelle mission à Orange** : agence accessible depuis la carte régionale.
  Thème : la simplification du langage administratif. Un adhérent ne comprend
  pas un courrier rempli de termes techniques (« indu », « forclusion »,
  « subrogation »). La bonne posture : reformuler avec des mots simples, sans
  jargon ni condescendance, vérifier que la personne a compris, et proposer un
  écrit clair. Même structure que les autres : agent + adhérent + QCM à deux
  essais, débrief, tampon dossier.
- **Orange** est désormais jouable sur la carte (Avignon, Carpentras, Orange et
  la permanence « Le Lien »). Comme les autres lieux, l'agence dispose d'une
  voiture de service garée sur le parking, d'où part et où revient le joueur.

## Mission Manosque (niveau avancé)

- **Deux épreuves** plus exigeantes. D'abord un **jeu de classement** proposé par
  Alexia à l'accueil : faire glisser chaque engagement Services Publics + en face
  de l'action concrète de la MSA Alpes-Vaucluse qui l'illustre (6 paires,
  validation à la fin, second essai possible). Puis une **question complexe**
  posée par Jean-Paul, un exploitant, accompagné de Sophie : une situation
  sensible (délai dépassé, risque de rupture de droits) où la bonne réponse
  combine plusieurs engagements à la fois, avec des distracteurs subtils.
- **Salariés nommés** dans chaque accueil : les PNJ portent désormais leur prénom
  au-dessus de leur tête. Certains proposent une mission ou un jeu, d'autres
  disent simplement bonjour et rappellent un point d'attention Services Publics +.
- Manosque est jouable sur la carte, avec sa voiture de service comme les autres
  lieux.

## Mission Coustellet (publics fragiles)

- Thème : l'accompagnement personnalisé des publics fragiles. Deux épreuves.
- Un **jeu d'appariement** proposé par Maria : relier chaque situation de personne
  fragile (malentendant, difficulté financière, barrière de langue, isolement…) à
  la réponse d'accompagnement la mieux adaptée. Les réponses se ressemblent : c'est
  le besoin précis qui guide.
- Un **QCM** posé par Sanaa, autour d'un proche aidant venu pour son père
  hospitalisé sans procuration : concilier la protection des données de l'adhérent
  et l'accompagnement réel de l'aidante, avec des distracteurs subtils.

## Mission Digne-les-Bains (accompagnement au numérique)

- Thème : l'inclusion numérique. Deux épreuves.
- Un **jeu d'appariement** proposé par Stéphanie : relier chaque profil d'usager
  (jamais connecté, autonome bloqué, désireux d'apprendre, inquiet, sans matériel,
  pressé) au bon niveau d'accompagnement numérique. Ni trop, ni trop peu.
- Un **QCM** posé par Jennifer dans l'espace aide numérique : un adhérent âgé sans
  matériel veut renoncer à ses droits face à une démarche « 100 % en ligne ». La
  bonne réponse : l'accompagner sur place et proposer une solution durable, car le
  numérique ne doit jamais exclure.

## Mission Gap (écoute des usagers & amélioration continue)

- Thème : transformer l'avis des usagers en améliorations concrètes. Deux épreuves.
- Un **jeu d'appariement** proposé par Angélique : relier chaque retour d'usager
  (attente au téléphone, courrier incompris, pièces redemandées, manque de suivi…)
  au levier d'amélioration que la MSA peut activer.
- Un **QCM** posé par Coraline : que faire d'un signal d'insatisfaction récurrent
  remonté par une enquête ? La bonne réponse boucle la démarche : analyser la cause,
  agir, puis informer les usagers de ce qui a changé grâce à eux.
- Cinq salariés nommés (Angélique, Coraline, Marion, Mélik, Céline).

## Contenu pédagogique

- **Situation 1 — ESSOC** : un exploitant corrige spontanément une déclaration.
  Bonne posture : écouter, vérifier, accompagner la régularisation sans
  présumer la fraude.
- **Situation 2 — Le Lien** : Mme Roux et le non-recours aux droits. Bonne
  posture : écouter, expliquer avec tact, proposer d'étudier sa situation avec
  son accord.

---

## Organisation des fichiers

- `index.html` — page principale
- `style.css` — habillage
- `data.js` — contenu pédagogique (scènes, dialogues, QCM, carnet)
- `game.js` — moteur (rendu, déplacements, collisions, caméra, dialogues, quiz)
- `assets/bg/` — décors
- `assets/sprites/` — personnages et véhicules
- `assets/ui/` — affiches de la fenêtre signalétique

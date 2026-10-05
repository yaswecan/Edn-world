# Architecture V7

## Principe

PédagoLab est la plateforme. Les mondes sont des modalités de pratique.

```text
PédagoLab
├── Comptes / progression
├── Référentiel NEXUS
├── Ressources
├── Parcours
└── Mondes
    ├── CODE//STATION
    ├── BUNKER//OPS
    ├── ROCKET//LAUNCH
    ├── INFILTRATION//TRACE
    └── ASSAULT//SIM
```

Une compétence peut apparaître dans plusieurs mondes afin de travailler le transfert.

## Ressource

Les 140 unités NEXUS conservent : `opening`, `lesson`, `example`, `task`, `proof`, `transfer`, `questions`, `mode`, `minutes`, `prereq` et la liaison au référentiel.

## Progression

Un monde se débloque naturellement quand la production finale du monde précédent est réussie. Le professeur peut forcer l'accès grâce à `worldOverrides`.

Un override n'ajoute aucune mission réussie et ne marque aucune ressource comme acquise.

## Évaluations

Chaque monde se termine par une petite production : script de réparation, healthcheck, contrôleur de lancement, rapport d'incident ou contrôleur de drones.

Le même code est testé sur tous les scénarios annoncés.

## Cyber

INFILTRATION est volontairement défensif : lecture de traces, HTTP, filtrage de logs et détection d'anomalies dans des données fictives. Aucune action n'est effectuée sur des systèmes réels.

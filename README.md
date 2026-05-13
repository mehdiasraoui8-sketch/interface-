# Système Cartésien — PI. Groupe 7

Interface web React pour le contrôle du système cartésien à 3 axes.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Accueil — Système cartésien |
| `/manuel` | Mode Manuel (saisie de coordonnées ou dessin sur écran) |
| `/import` | Mode Import (G-code / SVG) |
| `/formes` | Formes Prédéfinies |
| `/aide` | Aide & FAQ |
| `/apropos` | À propos du projet |

## Stack technique

- **React 19** + **Vite 8**
- **React Router v7.14.2** — navigation multi-pages
- **Tailwind CSS v3** — styles utilitaires
- **Framer Motion** — animations

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build
npm run preview    # preview build
```

yarn
yarn start
yarn build
# Vegan Pantry Chef Docs

This Docusaurus site lives in the `docs/` directory and documents the user-facing experience of the Vegan Pantry Chef application.

## Prerequisites

- Node.js 20+
- npm 9+

Install dependencies (from the `docs/` folder):

```bash
npm install
```

## Local development

```bash
npm start
```

The docs site opens at `http://localhost:3000`. Save changes to Markdown or configuration files to trigger instant reloads.

## Build for production

```bash
npm run build
```

Static assets are emitted to `docs/build`. Serve that directory with any static host or CDN.

## Deploying

If you plan to publish on GitHub Pages, update `docusaurus.config.ts` with your preferred `url` and `baseUrl`, then run:

```bash
npm run deploy
```

Refer to the [Docusaurus deployment guide](https://docusaurus.io/docs/deployment) for platform-specific instructions.

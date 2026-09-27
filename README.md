# ChillLog

Fridge temperature monitor for Squanchy Bakery.

> Work in progress. The full README (seeding demo data, uploading files, testing on a phone) comes with the `docs/notes-readme` branch.

## Requirements

- Node.js 22.13 or newer (24 LTS recommended; see `.nvmrc`). Nothing else: no database server, Docker or accounts.

## Run

```sh
npm install
npm start
```

Open http://127.0.0.1:3000.

## Develop

```sh
npm run dev    # API + Vite dev server with hot reload
npm test
npm run lint
```

Decisions and reasoning: [docs/architecture-and-stack.md](docs/architecture-and-stack.md) · [NOTES.md](NOTES.md)

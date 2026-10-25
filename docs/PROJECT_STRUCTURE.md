# Project structure

The project keeps one browser frontend and one Express application. It does not need a bundler, controllers that only forward requests, or a separate frontend development server.

```text
public/
  *.html                   Customer-facing pages
  admin/                   Administrator pages
  seller/                  Seller pages
  css/                     Shared styles and responsive rules
  js/                      Browser API/auth/cart/catalogue/order modules
server/
  database/
    schema.sql             Table definitions and constraints
    seed.sql               Idempotent sample rows
  src/
    app.js                 Express configuration, routes, static files, errors
    server.js              Startup and graceful shutdown
    db/database.js         SQLite connection, queries, migrations, seeding
    middleware/auth.js     JWT verification and database-backed roles
    routes/                API endpoint logic and request validation
    services/checkout.js   Atomic order placement and stock handling
tests/
  app.test.js              Isolated migration and API integration coverage
data/
  shopeasy.db              Local runtime data; ignored by Git
docs/
  API_DOCUMENTATION.md
  DATABASE_SCHEMA.md
  PROJECT_STRUCTURE.md
  TESTING.md
```

Route modules currently contain concise request/response handling with local validation. This is adequate for the app's size; checkout is a service because it is shared business logic involving multiple tables and a transaction. Add a dedicated controller or validator module only if route complexity grows.

## Static assets and API calls

Express serves `public/` from the same origin as `/api`. Browser modules use root-relative `/css`, `/js`, and `/api` paths, so no CORS setup or frontend build is required.

## Runtime configuration

`server/.env` is loaded by the app and is not tracked. `server/.env.example` lists safe configuration keys. The SQLite runtime file is in ignored `data/`; schema and seed source remain under `server/database/`.

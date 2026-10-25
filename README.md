# ShopEasy

ShopEasy is a small multi-role e-commerce application built with HTML5, CSS3, Vanilla JavaScript, Node.js, Express, and SQLite. The storefront is served directly by Express; there is no frontend build step or framework.

## Features

- Customer registration and login with bcrypt password hashes and JWT sessions.
- Product browsing, partial-name search, category filtering, and product details.
- Per-customer cart with stock-aware quantity updates and server-calculated totals.
- Cash on Delivery checkout using a serialized SQLite transaction, stock reduction, and order-time prices.
- Customer order history and order details restricted to the owning customer or an administrator.
- Seller registration, seller-owned product management, and order lines limited to the seller's products.
- Original local SVG product, category, hero, and brand illustrations served from `public/images/`; missing or broken product artwork falls back to a local placeholder.
- Admin dashboard statistics, product/category management, all-order visibility, and sequential order status updates.
- Parameterized SQLite queries, server-side role checks, input validation, and escaped dynamic storefront text.

## Requirements

- Node.js 20 or newer
- npm

## Install and run

From the repository root:

```sh
npm install
cp -n server/.env.example server/.env
```

Set `JWT_SECRET` in `server/.env` to a long random value before starting the app. Then run:

```sh
npm run dev
```

Open <http://localhost:4000>. `npm start` runs the same server for a normal local start. The SQLite database is created at `data/shopeasy.db`; schema application and idempotent sample seeding happen during server startup. The database file and local `.env` are ignored by Git.

## Development accounts

On a fresh database, the app creates:

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@shopeasy.com` | `admin123` |
| Seller | `seller@shopeasy.com` | `seller123` |

Change these credentials for any shared or deployed environment. Existing accounts are not overwritten during startup.

## Project structure

```text
.
├── docs/                  # API, data model, structure, and test notes
├── public/                # Static HTML pages, CSS, and browser JavaScript
│   ├── admin/
│   ├── seller/
│   ├── images/             # Original local SVG brand, category, and product artwork
│   ├── css/
│   └── js/
├── server/
│   ├── database/          # schema.sql and seed.sql
│   └── src/
│       ├── db/            # SQLite connection, initialization, migrations
│       ├── middleware/    # Authentication and role authorization
│       ├── routes/        # Express REST endpoints and request validation
│       ├── services/      # Transactional checkout
│       ├── app.js
│       └── server.js
├── tests/                 # Isolated API and migration integration tests
├── data/                  # Ignored runtime SQLite database
├── package.json
└── README.md
```

The route modules keep HTTP handling and closely related validation together; checkout is separated as a service because it coordinates a multi-step transaction. See [docs/PROJECT_STRUCTURE.md](./docs/PROJECT_STRUCTURE.md).

## API and database documentation

- REST endpoint reference: [docs/API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
- Tables, relationships, and migration behavior: [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md)
- Test commands and coverage: [docs/TESTING.md](./docs/TESTING.md)

Base API URL: `http://localhost:4000/api`. Protected endpoints use `Authorization: Bearer <token>`.

## Tests

```sh
npm test
```

The suite creates an isolated temporary SQLite database, checks that a legacy populated schema migrates without losing customer/cart/order/product rows, and exercises customer, seller, admin, authorization, stock validation, checkout rollback, and order pricing flows. It does not modify the local `data/shopeasy.db`.

# ShopEasy REST API

Base URL: `http://localhost:4000/api`. JSON request bodies use `Content-Type: application/json`. Send protected requests with `Authorization: Bearer <JWT>`.

## Public and authentication routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health status |
| POST | `/auth/register` | Public | Create customer or seller account; `role` defaults to `customer` |
| POST | `/auth/login` | Public | Authenticate by email/password |
| GET | `/auth/me` | Authenticated | Return current account |
| GET | `/products` | Public | List active products; optional `q` and `category` query parameters |
| GET | `/products/:id` | Public | Active product detail |
| GET | `/categories` | Public | List categories |

Registration accepts `{ "name": "A User", "email": "user@example.test", "password": "secret123", "role": "customer" }`. Only `customer` and `seller` are allowed; clients cannot self-register as administrators.

## Customer routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/cart` | Read the authenticated user's cart and calculated total |
| POST | `/cart/items` | Add `{ "productId": 1, "quantity": 1 }` |
| PATCH | `/cart/items/:id` | Set `{ "quantity": 2 }` |
| DELETE | `/cart/items/:id` | Remove a cart row |
| POST | `/orders` | Create a Cash on Delivery order from the current cart |
| GET | `/orders` | List only the authenticated user's orders |
| GET | `/orders/:id` | Read order details for its owner or an administrator |

Checkout accepts `customerName`, `phone`, `address`, `city`, and six-digit `pinCode`. Prices are read from SQLite; client-supplied totals are not accepted.

## Seller routes

Every seller route requires an authenticated account whose current database role is `seller`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/seller/stats` | Product and relevant-order counts |
| GET | `/seller/products` | List the seller's products |
| POST | `/seller/products` | Create a product owned by the seller |
| PUT | `/seller/products/:id` | Update only a product owned by the seller |
| DELETE | `/seller/products/:id` | Deactivate an owned product |
| GET | `/seller/orders` | List orders containing the seller's products and seller subtotal |
| GET | `/seller/orders/:id` | Read only the seller's lines from a matching order |

Seller order responses intentionally omit customer address and contact details.
Seller product create/update requests may include `imageUrl`, either an HTTP(S) URL or a local `/images/products/<name>.svg` path. Other local filesystem paths are rejected.

## Administrator routes

Every `/admin` route requires an authenticated account whose current database role is `admin`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/stats` | Order, revenue, product, and user counts |
| GET | `/admin/orders` | List all orders |
| GET | `/admin/products` | List active and inactive products |
| POST | `/admin/products` | Create a product |
| PUT | `/admin/products/:id` | Update product details/status |
| DELETE | `/admin/products/:id` | Deactivate product |
| GET | `/admin/categories` | List categories for management |
| POST | `/admin/categories` | Create category |
| PUT | `/admin/categories/:id` | Rename category |
| DELETE | `/admin/categories/:id` | Delete an unused category |
| PATCH | `/orders/admin/:id/status` | Advance an order from Placed to Shipped to Delivered |

Admin product create/update requests accept the same `imageUrl` formats as seller products.

## Error responses

Validation and authorization errors return a JSON `message` with an appropriate 4xx status. Unexpected server errors return a generic 500 response; internal SQL details are logged server-side rather than returned to clients.

# Testing

Run the automated integration suite from the repository root:

```sh
npm test
```

Tests create a temporary SQLite database outside the repository and remove it after the run. They leave `data/shopeasy.db` unchanged.

The suite verifies:

- Health response, static storefront/seller/admin pages, and seeded catalogue/search.
- Migration of a populated legacy database, preserving its user, cart, order, order item, and product data and maintaining valid foreign keys.
- Registration/login, role protection, seller ownership boundaries, admin access, and order privacy.
- Cart creation, insufficient-stock checkout rollback, current database pricing, stock deduction, cart clearing, and order-time unit-price snapshots.
- Admin category/product operations and valid sequential order status changes.
- All 15 seeded product illustrations are stored in their database image fields and served as valid SVG responses; seller/admin local asset inputs are accepted and unsafe local paths are rejected.

For syntax checks on all application JavaScript files:

```sh
find public server/src tests -name '*.js' -type f -print0 | xargs -0 -n1 node --check
```

For a manual browser check, start the app with `npm run dev`, open `http://localhost:4000`, and exercise the customer, seller, and administrator pages using the development accounts in the root README.

The visual pass loaded the home and product-detail pages in-browser, verified all 15 product images and the category-filter result, and checked for horizontal overflow at 360, 390, 768, 1024, and 1440 pixels. A deliberately intercepted missing product image confirmed the local placeholder fallback; its simulated 404 is expected.

# Indonesian Ecommerce Classroom API

A shared ecommerce mock backend with full CRUD, persistent SQLite storage, and
Indonesian seed data. Four resources use camelCase and snake_case JSON fields.
No login or API key is required.

## Run

Requires Node.js **24.14 or newer** and npm.

```sh
npm install
npm run dev
```

Base URL: `http://localhost:3000/api`. Health check: `GET /health`.

### Run with a public Cloudflare tunnel

With `cloudflared` installed and available on your PATH, start both the development
server and a Quick Tunnel with:

```sh
npm run dev:tunnel
```

Cloudflare prints a public HTTPS URL. Append `/api/shops` to browse shops, or use
the public URL plus `/api` as the client's base URL. The root URL has no route.
The public hostname changes each time the tunnel restarts. Press Ctrl+C to stop
both processes. Stop any separately running API on the same port before starting.

To start only the tunnel for an already running server:

```sh
npm run tunnel
```

Both commands use the project-local `cloudflared.yml`, avoiding ingress rules in
your personal Cloudflare configuration. `PORT=4000 npm run dev:tunnel` changes the
port for both processes. These tunnel scripts use a POSIX shell (macOS/Linux).

### Compiled server

For a compiled build:

```sh
npm run build
npm start
```

The server listens on all network interfaces. Set `PORT` and `DATABASE_PATH` to
override port `3000` and database `data/classroom.sqlite`:

```sh
PORT=4000 DATABASE_PATH=data/lesson.sqlite npm start
```

SQLite seeds itself on first startup. Changes survive restarts. Everyone using
the server shares the same data; updates use last-write-wins behavior.

Stop the server before resetting all data back to the original seeds:

```sh
npm run db:reset -- --confirm
```

Use the same `DATABASE_PATH` when resetting a customized database. The reset is
transactional and restores IDs as well as records. There is no reset HTTP endpoint.

## Connect the class

Connect the teacher's Mac and student devices to the same network. Find the
teacher's LAN IP in macOS System Settings → Network → connection details, then
give students `http://<teacher-ip>:3000/api`. Allow incoming Node connections if
macOS Firewall prompts. Networks with client isolation can prevent connections.

Clients on the server machine can use `localhost`. Clients on other computers
or phones must use the server machine's LAN IP, or the public HTTPS tunnel URL.

## Entities and fields

Every response includes a positive integer `id` and a server-generated UTC date
string such as `2026-09-20T01:00:00Z`. IDs and dates cannot be written by clients.
Nullable fields always appear as `null` when absent; other fields are required
on POST and PUT. JSON keys are case-sensitive.

### Shop (`/shops`) — camelCase

| Field | Type | Meaning |
|---|---|---|
| `id` | integer | Read-only shop ID |
| `ownerId` | integer | Existing User ID |
| `shopName` | string | Shop name |
| `description` | string or null | Shop description |
| `city` | string | City |
| `shopTier` | string | Exactly `bronze`, `silver`, or `gold` |
| `avatarUrl` | string or null | HTTP(S) avatar URL |
| `createdAt` | string | Read-only ISO 8601 date |

### Product (`/products`) — camelCase

| Field | Type | Meaning |
|---|---|---|
| `id` | integer | Read-only product ID |
| `shopId` | integer | Existing Shop ID |
| `productName` | string | Product name |
| `description` | string or null | Product description |
| `price` | integer | Nonnegative whole Indonesian rupiah |
| `stockCount` | integer | Nonnegative stock |
| `imageUrl` | string or null | HTTP(S) image URL |
| `avatarUrl` | string or null | HTTP(S) avatar URL |
| `isAvailable` | boolean | Availability flag |
| `reviewCount` | integer | Read-only number of reviews |
| `totalRating` | integer | Read-only sum of review ratings |
| `createdAt` | string | Read-only ISO 8601 date |

Availability is an explicit editable flag; changing stock does not change it
automatically. Product aggregates are calculated from reviews on each read,
including list, creation, and update responses. The backend does **not** return
`averageRating`. Clients calculate it as `totalRating / reviewCount` using
floating-point division, or zero when `reviewCount` is zero.

Individual reviews are 1–5 stars; the average is 0–5, where 0 means no reviews.
Seed product 1 has three reviews totaling 13 (approximately 4.33 stars).
Products 13–15 have no reviews. Round only for display, not during calculation.

### Review (`/reviews`) — snake_case

| Field | Type | Meaning |
|---|---|---|
| `id` | integer | Read-only review ID |
| `product_id` | integer | Existing Product ID |
| `user_id` | integer | Existing User ID |
| `rating` | integer | 1 through 5 |
| `review_text` | string | Nonempty review text |
| `avatar_url` | string or null | HTTP(S) review avatar URL |
| `created_at` | string | Read-only ISO 8601 date |

A user may write multiple reviews for the same product. Reviews may be moved
to another product by updating `product_id`; both products' aggregates reflect it.

### User (`/users`) — snake_case

| Field | Type | Meaning |
|---|---|---|
| `id` | integer | Read-only user ID |
| `full_name` | string | Fictional user's name |
| `email` | string | Valid email, unique ignoring case |
| `avatar_url` | string or null | HTTP(S) avatar URL |
| `created_at` | string | Read-only ISO 8601 date |

## HTTP contract

The following operations apply to **all four** resources. Replace `products`
with `shops`, `reviews`, or `users` as needed.

| Method | Path | Success |
|---|---|---|
| GET | `/api/products` | `200`, plain array ordered by ID |
| GET | `/api/products/:id` | `200`, one object |
| POST | `/api/products` | `201`, created object and Location header |
| PUT | `/api/products/:id` | `200`, replaced object |
| PATCH | `/api/products/:id` | `200`, updated object |
| DELETE | `/api/products/:id` | `204`, no body |

POST/PUT require all nonnullable writable fields. Omitted nullable fields become
`null`. PATCH accepts one or more writable fields, preserving omitted fields;
explicit `null` clears a nullable field. Send `Content-Type: application/json`.
Request bodies must omit read-only IDs, dates, and aggregates. JSON bodies are
limited to 100 KB.

Supported filters (combined filters use AND):

```text
GET /api/shops?ownerId=1
GET /api/products?shopId=1
GET /api/reviews?product_id=1
GET /api/reviews?user_id=2
GET /api/reviews?product_id=1&user_id=2
```

No matches returns `[]`. Unknown filters, repeated filters, and malformed IDs
return `400`. No pagination, sorting options, or nested relationship expansion.

### Request examples

```sh
curl http://localhost:3000/api/shops
curl 'http://localhost:3000/api/products?shopId=1'
curl http://localhost:3000/api/products/1

curl -i -X POST http://localhost:3000/api/reviews \
  -H 'Content-Type: application/json' \
  -d '{"product_id":1,"user_id":4,"rating":5,"review_text":"Bahannya nyaman dan jahitannya rapi."}'
```

Use the created review's `id` in the following examples (21 immediately after a reset):

```sh
curl -X PATCH http://localhost:3000/api/reviews/21 \
  -H 'Content-Type: application/json' -d '{"rating":4}'

curl -X PUT http://localhost:3000/api/reviews/21 \
  -H 'Content-Type: application/json' \
  -d '{"product_id":1,"user_id":4,"rating":5,"review_text":"Tetap menjadi produk favorit."}'

curl -i -X DELETE http://localhost:3000/api/reviews/21
```

Example product response:

```json
{
  "id": 1,
  "shopId": 1,
  "productName": "Kemeja Batik Parang",
  "description": "Kemeja katun bermotif parang, nyaman dipakai seharian.",
  "price": 185000,
  "stockCount": 12,
  "imageUrl": null,
  "avatarUrl": "https://dummyimage.com/256x256/335577/ffffff.png&text=KBP",
  "isAvailable": true,
  "createdAt": "2026-09-20T01:00:00Z",
  "reviewCount": 3,
  "totalRating": 13
}
```

### Errors

```json
{"error":{"code":"invalid_input","message":"shopTier must be one of: bronze, silver, gold."}}
```

| Status | Code | Cause |
|---|---|---|
| 400 | `invalid_input` | Invalid JSON, missing required fields, wrong types/casing, invalid enum/reference, unknown or read-only fields |
| 404 | `not_found` | Missing record or endpoint |
| 409 | `conflict` | Duplicate email or a record still has dependents |
| 413 | `payload_too_large` | JSON body exceeds 100 KB |
| 500 | `internal_error` | Unexpected server failure |

Delete reviews before their product or user, products before their shop, and
shops before their owner. Deletion does not cascade.

## Seed data

The dataset contains 6 fictional Indonesian users, 3 shops, 15 products, and 20
Bahasa Indonesia reviews. Shops cover all tiers: Toko Batik Nusantara (gold),
Kopi Senja Bandung (silver), and Kerajinan Jogja (bronze). Products include batik,
Indonesian coffee, and local crafts. Emails use `example.com`.

Every seeded record has a 256×256 PNG avatar from [DummyImage](https://dummyimage.com/).
Shop avatars use initials (TBN, KSB, KJ); product avatars use product initials;
user and review avatars use the user's initials. Each record gets a random dark
background with white text when seeded. URLs are stored, so colors remain stable
across requests and restarts; resetting seeds generates new colors. Loading these
images requires internet access. Product `imageUrl` remains a separate optional
product photo field.

Existing databases automatically receive the avatar columns and missing avatars
on their next server startup, preserving records and custom user avatar URLs.
This migration runs once. Avatar fields remain optional and editable for CRUD:
POST/PUT without an avatar stores null; PATCH with null clears it. Newly created
records are not automatically assigned a placeholder. Changing a record's name
or a review's author does not regenerate its stored avatar.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

Integration tests start a real HTTP server on a temporary port and use a temporary
SQLite database. They cover all resource operations, naming, validation, filters,
deletion constraints, review aggregates, persistence, and repeatable resets.
They do not modify the classroom database.

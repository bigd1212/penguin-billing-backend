# penguin-billing-backend

Separate backend repo for PenguinPDF Android monetization.

## What this provides

- `POST /v1/purchases/verify`
- `GET /v1/entitlements?userId=...`
- `POST /v1/rtdn/google-play` (Google Play RTDN intake)
- PostgreSQL persistence for Play purchase state
- Entitlement resolution (`FREE`, `PLUS`, `PRO`)
- Capability flags (`OCR_SEARCHABLE_TEXT`, `TTS_READ_ALOUD`)

## Stack

- Node 20 + TypeScript
- Express
- PostgreSQL (`pg`)
- Google Play Developer API (`googleapis`)
- Railway-ready (`railway.json`, optional `Dockerfile`)

## Local setup

1. Copy env:

```bash
cp .env.example .env
```

2. Fill `.env` with real values:

- `DATABASE_URL`
- `GOOGLE_PLAY_PACKAGE_NAME`
- `GOOGLE_SERVICE_ACCOUNT_JSON` (entire service-account JSON as one-line string)
- `PLUS_YEARLY_PRODUCT_ID` (default: `plus_yearly`)
- `PRO_YEARLY_PRODUCT_ID` (default: `pro_yearly`)
- `RTDN_SHARED_SECRET`

3. Install and run:

```bash
npm install
npm run dev
```

4. Health check:

```bash
curl http://localhost:8080/healthz
```

## Endpoint examples

Verify purchase:

```bash
curl -X POST http://localhost:8080/v1/purchases/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "user_123",
    "packageName": "com.penguinpdf",
    "productId": "plus_yearly",
    "purchaseToken": "token_from_play"
  }'
```

Fetch entitlements:

```bash
curl 'http://localhost:8080/v1/entitlements?userId=user_123'
```

RTDN:

```bash
curl -X POST http://localhost:8080/v1/rtdn/google-play \
  -H 'Content-Type: application/json' \
  -H 'x-rtdn-secret: change-me' \
  -d '{"message":{"data":"eyJzdWJzY3JpcHRpb25Ob3RpZmljYXRpb24iOnsicHVyY2hhc2VUb2tlbiI6InRrbiJ9fQ=="}}'
```

## Railway deploy

1. Push this repo to GitHub.
2. Create Railway project from that repo.
3. Add PostgreSQL plugin.
4. Set env vars from `.env.example`.
5. Deploy.

## Notes

- RTDN route currently uses a shared-secret header (`x-rtdn-secret`).
- For stricter security, verify Pub/Sub JWT (`Authorization: Bearer`) and audience.

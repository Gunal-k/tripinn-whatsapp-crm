# Tripinn Holidays — WhatsApp & Telecalling CRM

Production-ready, secure, web-based CRM engineered for **Tripinn Holidays** travel agency. Built with Next.js 16 (App Router & Turbopack), Supabase PostgreSQL, official Meta WhatsApp Business Cloud API, and Meta Conversions API (CAPI) for Click-to-WhatsApp (CTWA) qualified-lead tracking.

---

## 1. System Architecture

- **Frontend & App Router**: Next.js 16.4.2, React 19.3.0, TypeScript 5, Tailwind CSS v4.
- **Persistent Database**: Supabase PostgreSQL with Row Level Security (RLS) policies.
- **Messaging Engine**: Official Meta WhatsApp Business Platform Cloud API (`v21.0`).
- **Webhook Ingestion**: `/api/webhook/whatsapp` with HMAC-SHA256 signature verification (`timingSafeEqual`), message persistence, delivery status callback tracking, and `webhook_events` deduplication.
- **Meta Conversions API (CAPI)**: Server-side business messaging events with `ctwa_clid` attribution, triggered strictly upon explicit salesperson qualification.
- **Telecaller Portal**: One-click call outcome logging (`Connected`, `Callback Requested`, `Ringing`, `Busy`, `Not Interested`), click-to-dial links, and formatted Excel calling sheet exports (`.xlsx`).

---

## 2. Database Migrations

Run the SQL migration in your **Supabase Dashboard → SQL Editor**:

### Primary Migration:
- **`supabase/migrations/20261021_upgrade_and_sync_schema.sql`**
  - Reconciles existing `leads` and `whatsapp_messages` tables without dropping existing rows.
  - Adds missing columns (`lead_source`, `interested_destination`, `travel_dates`, `number_of_travelers`, `estimated_budget`, `qualification_status`, `follow_up_date`, `ctwa_clid`, `meta_conversion_sent`, etc.).
  - Creates audit tables: `lead_activities`, `webhook_events`, `profiles`, `meta_conversion_logs`, `integration_settings`.
  - Configures indexes and Row Level Security (RLS) policies.

---

## 3. Environment Variables

Configure these variables in your local `.env.local` file and in your **Vercel Project Settings → Environment Variables**:

| Variable Name | Required | Client/Server | Description |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_APP_URL` | Yes | Browser & Server | Public URL (e.g. `https://tripinn-whatsapp-crm.vercel.app` or `http://localhost:3000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Browser & Server | Supabase project URL (e.g. `https://<project-id>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser & Server | Supabase publishable anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server ONLY | Supabase secret service-role key (bypasses RLS for webhook ingestion) |
| `WHATSAPP_ACCESS_TOKEN` | Yes | Server ONLY | Meta System User permanent access token with `whatsapp_business_messaging` |
| `WHATSAPP_PHONE_NUMBER_ID` | Yes | Server ONLY | Meta Phone Number ID from WhatsApp App Dashboard |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Yes | Server ONLY | Meta WhatsApp Business Account (WABA) ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Yes | Server ONLY | Secret verify token configured in Meta App Dashboard Webhooks |
| `WHATSAPP_APP_SECRET` | Yes | Server ONLY | Meta App Secret from App Dashboard (used for `x-hub-signature-256` HMAC validation) |
| `WHATSAPP_API_VERSION` | Optional | Server ONLY | Meta Graph API version (default: `v21.0`) |
| `META_DATASET_ID` | Optional | Server ONLY | Meta Pixel / Dataset ID for Conversions API |
| `META_CONVERSIONS_API_TOKEN` | Optional | Server ONLY | Meta Conversions API System User access token |
| `META_TEST_EVENT_CODE` | Optional | Server ONLY | Test event code from Meta Events Manager |

> [!IMPORTANT]
> **Where to get `SUPABASE_SERVICE_ROLE_KEY`**:
> Open Supabase Dashboard → **Project Settings** → **API** → Scroll to **Project API keys** → Reveal and copy the **`service_role` (secret)** key.
> Never prefix this with `NEXT_PUBLIC_` and never expose it in client-side code.

---

## 4. Meta Webhook Setup in Meta App Dashboard

1. In the **Meta for Developers** portal, go to your app → **WhatsApp** → **Configuration**.
2. Click **Edit** next to Webhook:
   - **Callback URL**: `https://<your-domain>.vercel.app/api/webhook/whatsapp`
   - **Verify Token**: Must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your environment.
3. Click **Verify and Save**. Meta sends a `GET` request to verify the challenge.
4. Click **Manage Webhook Fields** and subscribe to:
   - `messages` (incoming texts, images, CTWA referral metadata)
   - `message_status` (sent, delivered, read, failed callbacks)

---

## 5. Verification Steps

### Step 1: Run SQL Migration
1. Go to your Supabase project dashboard → **SQL Editor**.
2. Copy and execute [supabase/migrations/20261021_upgrade_and_sync_schema.sql](file:///d:/tripinn-whatsapp-crm/supabase/migrations/20261021_upgrade_and_sync_schema.sql).
3. Verify tables created: `leads`, `whatsapp_messages`, `lead_activities`, `webhook_events`, `profiles`, `meta_conversion_logs`.

### Step 2: Test Diagnostics Endpoint
Visit:
```bash
curl https://<your-domain>/api/integrations/status
```
Response will return verified database connectivity, Meta verified phone number (`displayPhoneNumber`), quality rating (`GREEN`), and active HMAC security.

### Step 3: Run the Test Suite
Run the 40 automated integration tests:
```bash
npm test
```
All 40 tests across phone normalization, schema validation, lead service database mapping, telecaller Excel export, WhatsApp HMAC verification, and idempotency will execute with 0 failures.

### Step 4: Test Inbound WhatsApp Webhook
Send a test message from a real phone number to your Meta WhatsApp Business number.
- The webhook verifies HMAC-SHA256 signature using `WHATSAPP_APP_SECRET`.
- The contact is created as a new `NEW` lead in Supabase PostgreSQL (or updated if already present).
- The incoming message is stored in `whatsapp_messages` and recorded in `lead_activities`.
- Refreshing the CRM dashboard will display the new lead with live WhatsApp chat history.

### Step 5: Test Telecaller Calling Sheet Export
1. In the CRM, click **Export Telecaller Calling Sheet**.
2. Select telecaller name (`Priya Sharma` or `All Telecallers`).
3. Click **Download Telecaller Excel Sheet (.xlsx)**.
4. Open the generated spreadsheet in Microsoft Excel or Google Sheets:
   - Verify columns: `S.No`, `Priority`, `Customer Name`, `Phone Number`, `Direct Dial Link`, `WhatsApp Link`, `Destination`, `Estimated Budget (INR)`, `Travel Dates`, `Call Outcome`, `Telecaller Remarks`.

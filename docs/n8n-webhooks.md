# VELORA ↔ n8n integration

VELORA talks to n8n in three ways:

| Direction | What | Configure |
|---|---|---|
| n8n → VELORA | REST API for the AI booking chat and benefits articles | `N8N_API_KEY` |
| VELORA → n8n | Signed event webhooks (bookings, procedures, rota) | `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` |
| VELORA → n8n → VELORA | Admin AI rota assistant (request/response) | `N8N_SCHEDULER_WEBHOOK_URL`, `N8N_API_KEY` |

All dates are `YYYY-MM-DD` and times are `HH:MM` in the studio timezone, **Europe/Sofia**. Prices are in EUR.

---

## 1. Inbound API (n8n → VELORA)

Base URL: `APP_URL` (for example `https://velora-spa.bg`). Every request needs this header:

```
Authorization: Bearer <N8N_API_KEY>
```

Requests without the key get `401`. The key must be at least 32 characters; until it is set, every endpoint answers `503`. Errors look like `{ "error": "CODE", "message": "…" }`:

| HTTP | `error` | Meaning |
|---|---|---|
| 400 | `INVALID` | Missing or malformed field, or a time that is not bookable (`detail` or `issues` explain why) |
| 401 | `unauthorized` | Missing or wrong API key |
| 403 | `FORBIDDEN` | The email does not match the booking |
| 404 | `NOT_FOUND` | Unknown booking code, procedure or variant |
| 409 | `SLOT_TAKEN` | Someone took the slot first. Fetch availability again. |
| 409 | `CANCELLED` | The booking is already cancelled |
| 422 | `TOO_LATE` | Less than 24h before the booking |
| 503 | `not_configured` | `N8N_API_KEY` is missing or shorter than 32 characters |

### Catalog

`GET /api/n8n/procedures` returns the active procedures with their variants. Use `variantId` for availability and booking.

```json
{
  "currency": "EUR",
  "procedures": [
    {
      "id": "…", "slug": "swedish-relaxation",
      "nameEn": "Relaxation (Swedish) massage", "nameBg": "Релаксиращ (шведски) масаж",
      "summaryEn": "…", "summaryBg": "…",
      "therapistsRequired": 1, "hasArticle": true,
      "variants": [{ "variantId": "…", "durationMin": 60, "price": 75 }]
    }
  ]
}
```

`GET /api/n8n/therapists` returns the active therapists and the procedures each one performs.

### Availability

`GET /api/n8n/availability?variantId=…&date=2026-11-20[&therapistId=…]`

```json
{ "date": "2026-11-20", "timezone": "Europe/Sofia", "times": ["10:00", "10:15", "14:00"] }
```

Every listed time can be booked right now. The rules are already applied: shifts, 20-minute room prep, a lunch break that must still fit between 12:00 and 14:00, free rooms, and two therapists and two rooms for couples.

### Bookings

`POST /api/n8n/bookings`

```json
{
  "variantId": "…",
  "date": "2026-11-20",
  "time": "14:00",
  "name": "Maria Georgieva",
  "email": "maria@example.com",
  "phone": "+359 88 123 4567",
  "notes": "Lower back pain",
  "locale": "bg",
  "therapistId": null
}
```

- You can send `"procedureSlug": "deep-tissue", "durationMin": 90` instead of `variantId`.
- `therapistId` counts **only** when the email belongs to a registered client, because preferred therapists are an account feature. For guests, the least busy free therapist is assigned.
- `201` returns `{ "appointment": <AppointmentPayload> }`, with `source: "AI"`.

Other booking endpoints:

- `GET /api/n8n/bookings?date=2026-11-20` lists a day's bookings, for reminder workflows.
- `GET /api/n8n/bookings?email=maria@example.com` lists one client's bookings.
- `GET /api/n8n/bookings/:code` returns one booking.
- `POST /api/n8n/bookings/:code/cancel` takes `{ "email": "…", "force": false }`.
  - Clients can cancel up to 24h before the start.
  - `force: true` skips the email check and the 24h rule. Only use it for staff-confirmed requests.
- `POST /api/n8n/bookings/:code/reschedule` takes `{ "date": "…", "time": "…", "email": "…" }`. The 24h rule applies.

### Benefits articles

When VELORA sends `procedure.created`, an n8n workflow can write the article with OpenAI and store it:

`PUT /api/n8n/articles/:procedureSlug`

```json
{
  "titleEn": "Why bamboo massage works",
  "titleBg": "Защо масажът с бамбук действа",
  "bodyEn": "Intro paragraph…\n\n- Benefit one\n- Benefit two\n\nClosing paragraph…",
  "bodyBg": "…"
}
```

The body is plain text: a blank line starts a new paragraph, and lines starting with `- ` become a bullet list. Sending the same slug again replaces the article.

When VELORA sends `procedure.deleted`, call `DELETE /api/n8n/articles/:procedureSlug`. Removed procedures are already hidden from the site. Until an article exists, the benefits page shows "Article coming soon".

---

## 2. Outbound events (VELORA → n8n)

VELORA POSTs each event to `N8N_WEBHOOK_URL`:

```
Content-Type: application/json
X-Velora-Event: appointment.created
X-Velora-Signature: <hex HMAC-SHA256 of the raw body, key = N8N_WEBHOOK_SECRET>
```

```json
{ "id": "…", "event": "appointment.created", "createdAt": "2026-11-14T12:57:03.120Z", "data": { … } }
```

**Delivery**
- Events are written in the same database transaction as the change (an outbox) and sent right after the response.
- Failed sends are retried up to 8 times.
- Any 2xx response counts as delivered.
- Use `id` to deduplicate.

**Verifying the signature in n8n** (Code node). VELORA signs `JSON.stringify(payload)`, so re-stringifying the parsed body gives the same bytes. Self-hosted n8n needs `NODE_FUNCTION_ALLOW_BUILTIN=crypto` for `require('crypto')`.

```js
const crypto = require('crypto');
const secret = 'N8N_WEBHOOK_SECRET'; // or read it from a Settings node
const expected = crypto.createHmac('sha256', secret).update(JSON.stringify($json.body)).digest('hex');
if (expected !== $json.headers['x-velora-signature']) throw new Error('Bad signature');
```

**Ready-made workflows** are in [`n8n/`](../n8n). Import them in n8n (Workflows → Import from file):

| File | What it does | App variable |
|---|---|---|
| `velora-events.json` | Checks the signature and skips duplicates, emails clients on booking changes, writes or deletes benefits articles with OpenAI | `N8N_WEBHOOK_URL` = its webhook's Production URL |
| `velora-rota-assistant.json` | The admin AI rota chat (section 3) | `N8N_SCHEDULER_WEBHOOK_URL` = its webhook's Production URL |
| `velora-booking-chat.json` | Public AI chat: treatments, availability, book, cancel, reschedule | none |
| `velora-reminders.json` | Emails tomorrow's clients every day at 10:00 | none |

After importing:
- Fill in the **Settings** node of each workflow.
- Create the credentials:
  - **VELORA API**: Header Auth, name `Authorization`, value `Bearer <N8N_API_KEY>`.
  - **OpenAI**.
  - **SMTP**.
- Activate the workflows.

| Event | `data` | Typical n8n use |
|---|---|---|
| `appointment.created` | AppointmentPayload | Confirmation email/SMS |
| `appointment.rescheduled` | AppointmentPayload + `previousStartsAt` | "Your booking moved" message |
| `appointment.cancelled` | AppointmentPayload | Cancellation message |
| `appointment.deleted` | AppointmentPayload | Internal log (admin hard delete) |
| `procedure.created` | ProcedurePayload | Generate the benefits article, then `PUT /api/n8n/articles/:slug` |
| `procedure.updated` | ProcedurePayload | Optionally refresh the article |
| `procedure.deleted` | ProcedurePayload | `DELETE /api/n8n/articles/:slug` |
| `rota.updated` | `{ weeks, added[], removed[], absences[] }` | Notify therapists of shift changes |

**AppointmentPayload**

```json
{
  "code": "VEL-7K2M9Q", "status": "BOOKED",
  "startsAt": "2026-11-20T12:00:00.000Z", "endsAt": "2026-11-20T13:00:00.000Z",
  "localDate": "2026-11-20", "localTime": "14:00", "durationMin": 60,
  "price": { "amount": 75, "currency": "EUR" },
  "procedure": { "slug": "swedish-relaxation", "nameEn": "…", "nameBg": "…" },
  "therapists": [{ "id": "…", "name": "Maria Ivanova" }],
  "rooms": ["Olive"],
  "client": { "name": "…", "email": "…", "phone": "…" },
  "notes": null, "source": "WEB", "locale": "bg",
  "manageUrl": "https://velora-spa.bg/bg/booking/VEL-7K2M9Q"
}
```

`manageUrl` opens the booking's manage page. Guests also need the private cancel link shown on their confirmation screen.

**ProcedurePayload**

```json
{
  "id": "…", "slug": "bamboo", "nameEn": "…", "nameBg": "…", "summaryEn": "…", "summaryBg": "…",
  "therapistsRequired": 1,
  "variants": [{ "durationMin": 60, "price": 90, "currency": "EUR" }],
  "articleEndpoint": "https://velora-spa.bg/api/n8n/articles/bamboo"
}
```

---

## 3. AI rota assistant (Admin → Work rota)

When the admin writes something like *"Georgi is sick till 6th January, Maria wants paid leave 13–18 January, Ivana wants an extra 2 shifts"*, VELORA POSTs the following to `N8N_SCHEDULER_WEBHOOK_URL`, with `Authorization: Bearer <N8N_API_KEY>`:

```json
{
  "message": "Georgi is sick till 6th january, …",
  "today": "2026-11-14",
  "timezone": "Europe/Sofia",
  "rotaHorizon": { "from": "2026-11-09", "to": "2027-01-03" },
  "therapists": [{ "id": "cmw…", "name": "Georgi Petrov" }, { "id": "…", "name": "Maria Ivanova" }],
  "history": [{ "role": "ADMIN", "content": "…" }, { "role": "AI", "content": "…" }],
  "rules": ["Therapists work 10:00-19:00; …", "Target 3 therapists per day …"],
  "responseFormat": { "reply": "…", "changes": ["…examples…"] }
}
```

The workflow must answer **synchronously** (Webhook node → "Respond: using Respond to Webhook node") with JSON. VELORA also accepts `[ {…} ]` or `{ "output": {…} }`, which is what an AI Agent node usually returns.

```json
{
  "reply": "Got it: Georgi on sick leave until 6 Jan, Maria on paid leave 13–18 Jan, 2 extra shifts for Ivana this week.",
  "changes": [
    { "type": "absence", "therapist": "<id or name>", "from": "2026-11-14", "to": "2027-01-06", "absenceType": "SICK" },
    { "type": "absence", "therapist": "Maria", "from": "2027-01-13", "to": "2027-01-18", "absenceType": "PAID_LEAVE", "note": "optional" },
    { "type": "extra_shifts", "therapist": "Ivana", "count": 2 },
    { "type": "day_off", "therapist": "Petar", "date": "2026-11-21" },
    { "type": "add_shift", "therapist": "Elena", "date": "2026-11-22" }
  ]
}
```

- `absenceType` is one of `SICK`, `PAID_LEAVE`, `UNPAID` or `OTHER`.
- `extra_shifts` can take an optional `from`/`to`. Without them it means "this week".
- `therapist` can be an id or a name. Bulgarian names are transliterated, so "Георги" matches "Georgi".

**The AI never writes shifts directly.** VELORA validates the changes, then its own rota engine rebuilds the affected weeks within the rules. The rules are:
- max 5 working days in a row
- 2 consecutive days off in each Mon–Sun week
- 3 therapists per day where possible, never fewer than 2

The admin sees a preview with added and removed shifts and warnings: understaffed days, bookings that need reassigning, and extras that could not fit. Nothing changes until the admin clicks **Apply**. Manual edits in the grid are checked against the same rules.

### Suggested n8n workflow

1. **Webhook** (POST, Header Auth with the same Bearer key, Respond: "Using Respond to Webhook node").
2. **OpenAI Chat Model** + **Structured Output Parser** using the JSON schema below, with temperature 0.
3. **Respond to Webhook** with the parsed object.

System prompt:

```
You turn a spa manager's free-text request into rota changes. Today is {{$json.body.today}} (timezone Europe/Sofia).
Therapists (use their ids): {{JSON.stringify($json.body.therapists)}}.
Resolve relative dates ("till 6th January", "next week", "tomorrow") against today; assume the next
occurrence of a date if no year is given. "Sick", "ill", "болен" → SICK; "paid leave", "vacation", "отпуск" → PAID_LEAVE.
"Extra shifts" without dates means this week. Do not invent changes the manager did not ask for.
If something is ambiguous, return no change for it and ask in `reply`. Reply in the manager's language, in one or two sentences.
```

JSON schema for the parser:

```json
{
  "type": "object",
  "required": ["reply", "changes"],
  "properties": {
    "reply": { "type": "string" },
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["type", "therapist"],
        "properties": {
          "type": { "enum": ["absence", "extra_shifts", "day_off", "add_shift"] },
          "therapist": { "type": "string" },
          "from": { "type": "string" }, "to": { "type": "string" },
          "absenceType": { "enum": ["SICK", "PAID_LEAVE", "UNPAID", "OTHER"] },
          "note": { "type": "string" },
          "count": { "type": "integer", "minimum": 1, "maximum": 10 },
          "date": { "type": "string" }
        }
      }
    }
  }
}
```

Until `N8N_SCHEDULER_WEBHOOK_URL` is set, the chat shows "AI not connected". The manual change form beside it does the same operations without AI.

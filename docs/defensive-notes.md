# Defensive notes

The insecure snippets in the UI are conceptual comparisons. They are never registered as API routes. Do not copy them into another app.

## Request path

The browser sends a request to the local server. For private trades, middleware validates the cookie session. The handler validates the ID and selects a row with both `id` and `owner_id`. The server returns only that row. Hiding a button in the browser alone would not protect the record.

## HTTP outcomes

| Code | Meaning here |
| --- | --- |
| 200 | Request succeeded |
| 400 | Input did not match the route schema |
| 401 | No valid demo session |
| 403 | Browser Origin outside the local allowlist |
| 404 | No route or no trade accessible to this user |
| 429 | Too many local login attempts in a one-minute window |

## Defense in depth

Parameterized SQL separates input from query syntax. React text rendering keeps untrusted text out of HTML interpretation. A Content Security Policy limits script execution in supported browsers but does not fix unsafe HTML insertion. Real apps also need HTTPS, password hashing, CSRF review, monitoring, recovery tests, and a threat model for their specific environment.

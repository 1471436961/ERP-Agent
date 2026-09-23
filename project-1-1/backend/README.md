# Enterprise ERP Agent — OpenWorker on Render

This is an undeployed backend source baseline. The Dockerfile pins OpenWorker
`30d6e9a0144868caf37e780d70003f03ff520a87`; the local Step-1 installation used
`295dc1622abc7cc111347611233e43545a1e20aa`. This hosted integration has not
been validated at either revision. The demo configuration targets `https://erp.agentist.org`.

## Deployment

Docker web service, one instance, 1 CPU / 2 GB, 1 GB persistent disk at `/var/data`.
Health check: `/healthz`. Required environment variables:

- `AGENT_OPERATOR_TOKEN`: random server-side operator credential, at least 32 characters.
- `AGENT_GATEWAY_TOKEN`: optional independent server-to-server credential for the
  course gateway, at least 32 characters. Never distribute either token to students.
- `ERP_URL`, `ERP_API_KEY`, `ERP_API_SECRET`: restricted ERP identity; never Administrator.
- `ERP_PROFILE_JSON`: the server-owned read-only connector profile.
- `OPENAI_API_KEY`: model API credential; never sent to the browser or model prompt.
- `AGENT_MODEL`: defaults to `gpt-4.1-mini`; `AGENT_RUNS_PER_HOUR` defaults to 30.

Authenticated endpoints: `GET /v1/tools`, `POST /v1/chat` with
`Authorization: Bearer <operator-token>`. Chat body: `{"message":"查询销售订单"}`;
use returned `session_id` for the next turn. No anonymous inference.

The student gateway instead uses `Authorization: Bearer <gateway-token>` and
`X-Agent-Owner: <verified-user-UUID>`. It must validate the user's cookie session and
cohort-2 paid entitlement before forwarding. Caller-supplied UUIDs alone confer no
access. Student session owners use a separate namespace from operator owners.

## Security and delivery boundaries

This is the protected **Agent backend**, not a standalone student UI. The student
gateway boundary is implemented; the Vercel course portal and Supabase conversation
store live in the Parallight repository. Staging and paid-session end-to-end acceptance
are separate from backend acceptance. Production student publication, Cloudflare
gateway controls, Langfuse and human approval UI remain separate integration gates.
No shell/file/config administration tools are registered. Only `erp.query` and `erp.get`
are registered; the downstream MCP policy and ERP role both enforce read-only access.
Write/approval examples remain in the original course connector; this service does not
silently grant them or claim that the write workflow has been deployed.

Session history and run quota counters persist on disk. One process/one instance is
required. Per-hour run limits and bounded iterations/output are not a dollar budget.
Timeouts/provider failures return a generic error; never retry business writes.
An operator token rotation intentionally invalidates ownership of old sessions.

The ERP connector is copied from the course's `demos/erp-governed` source. Keep changes
synchronized; do not copy runtime SQLite files, tokens or environment files into Git.

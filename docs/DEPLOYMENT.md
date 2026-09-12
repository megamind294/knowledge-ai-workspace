# Keystone deployment and operations guide

This runbook describes how to operate the artifacts committed to this repository and how to translate them into a cloud deployment. It does not claim a live deployment, provisioned cloud resources, or validation against a live AI provider.

## Supported deployment artifact

The release artifact is the pair of production images defined by `apps/api/Dockerfile` and `apps/web/Dockerfile`, plus PostgreSQL 16 with pgvector. `compose.yaml` is the executable single-host reference topology:

- `web` is the only public service and proxies same-origin `/api` traffic to `api`.
- `api` runs database migrations before listening and stores document bytes under `/var/lib/keystone/objects`.
- `database-data` retains PostgreSQL data and `document-data` retains uploaded document bytes.
- both application images run as non-root users and are built from digest-pinned base images.

Promote images by immutable image digest. Do not rebuild a tag independently in each environment; build once, scan it, record the digest, and promote that same digest.

## Managed demo path

The lowest-risk portfolio demo is one managed Linux VM with Node.js 20.19 or newer, Docker Engine, the Compose plugin, TLS termination, and encrypted persistent disks. This preserves the tested service-DNS name `api` and the two named-volume boundaries without pretending that the filesystem adapter supports horizontal scaling.

1. Create a small VM in an Azure or AWS private network and restrict administrative access to a VPN, bastion, or tightly scoped source addresses.
2. Attach an encrypted data disk for Docker volumes. Keep the OS and Docker runtime patched.
3. Install Node.js 20.19 or newer, Docker Engine, and Compose; clone a reviewed release; and create an untracked `.env` owned by the deployment account with mode `0600`.
4. Put a managed HTTPS load balancer or reverse proxy in front of VM port 8080. Do not expose PostgreSQL or API port 4000 publicly.
5. Start and verify the exact release:

   ```bash
   docker compose build --pull
   docker compose up --detach --wait --wait-timeout 120
   node scripts/smoke-containers.mjs
   ```

6. Verify `/healthz`, `/api/health`, and `/api/ready` through the HTTPS hostname before allowing demo traffic.

The base Compose file intentionally runs the credential-authenticated product with provider and Google integrations disabled. For a public provider-backed demo, set `KEYSTONE_PUBLIC_URL`, `EMBEDDING_API_KEY`, and `GENERATION_API_KEY` in the protected `.env`, then create this untracked `compose.public.yaml` override:

```yaml
services:
  api:
    environment:
      WEB_APP_URL: ${KEYSTONE_PUBLIC_URL:?Set the public HTTPS origin}
      EMBEDDING_API_KEY: ${EMBEDDING_API_KEY:?Set the embedding provider key}
      GENERATION_API_KEY: ${GENERATION_API_KEY:?Set the generation provider key}
```

Use `docker compose -f compose.yaml -f compose.public.yaml ...` for build, start, and stop commands. Add `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and an exact HTTPS `GOOGLE_OAUTH_REDIRECT_URI` to the same override only when all three are configured. The optional provider endpoint, model, dimension, and timeout variables must likewise be explicitly forwarded by the override; never assume arbitrary host environment variables reach the container.

For a disposable local demo, the same commands work on a developer machine. `docker compose down` preserves data; `docker compose down --volumes` intentionally destroys both named volumes.

## Production reference architecture

Use separate web and API services behind one HTTPS ingress, a private managed PostgreSQL service with pgvector enabled, a managed secret store, centralized JSON logs, metrics/alerts, and immutable images in a private registry.

An Azure design maps these responsibilities to Azure Front Door or Application Gateway, Container Apps or AKS, Azure Database for PostgreSQL Flexible Server, Key Vault, Azure Monitor, and a private registry. An AWS design maps them to CloudFront plus an Application Load Balancer, ECS/Fargate or EKS, RDS for PostgreSQL, Secrets Manager, CloudWatch, and ECR.

The committed Nginx image expects the internal API DNS name `api:4000`. A target platform must provide that name or build a reviewed Nginx configuration for its actual private API endpoint. Keep PostgreSQL private and require encrypted connections.

The current `FileSystemObjectStore` supports one writable API filesystem. A single API replica may mount encrypted persistent storage. Multiple API replicas require a reviewed shared-object-store adapter and migration of existing bytes before scaling out; merely mounting independent disks is data loss, not horizontal scaling.

## Secrets and provider data flow

Required production secrets are `DATABASE_URL` and a randomly generated `ACCESS_TOKEN_SECRET` of at least 32 characters. Compose derives `DATABASE_URL` from `KEYSTONE_DATABASE_PASSWORD`; that password must be URL-safe. Rotate secrets through the platform secret store, not committed files or image layers.

Google OAuth is enabled only when its client ID, client secret, and exact callback URI are all configured. Embedding requires `EMBEDDING_API_KEY`; grounded chat requires both embedding and generation keys. Public provider endpoints and public application URLs must use HTTPS.

Document indexing sends normalized document chunks to the embedding provider in batches of at most 64; each default chunk contains at most 300 words with a 50-word overlap. Provider-backed chat separately sends the user's question to the embedding endpoint. When retrieval passes the confidence threshold, the generation endpoint receives the question and at most eight retrieved passages, bounded to 24,000 source characters. Both indexing chunks and retrieved passages can contain private workspace text. Approve provider region, retention, training, subprocessors, and deletion terms before enabling either integration. Keystone cannot delete copies retained by an external provider.

Never place tokens, passwords, document text, prompts, provider bodies, or full request URLs in operational logs. The API intentionally emits only allow-listed JSON fields for lifecycle, request completion, correlation, and readiness-transition events.

## Networking and health probes

- `/healthz` proves the Nginx process can serve traffic.
- `/api/health` is dependency-free API liveness. Use it for restart decisions.
- `/api/ready` performs a bounded PostgreSQL probe. Use it for load-balancer admission and remove a replica from traffic on `503`.

Expose only HTTPS on the public ingress. Keep API-to-database and web-to-API traffic on private networks, restrict database security groups to the API identity/subnet, and deny direct public access to ports 4000 and 5432. Production configuration rejects non-HTTPS public origins.

The committed Nginx proxy overwrites `X-Forwarded-Proto` with its internal `$scheme`, so TLS terminated before Nginx is represented as `http` to the API. The current API does not use that header for cookie security or authorization, but a platform that needs accurate downstream scheme telemetry must deploy and test a trusted-ingress forwarding policy. In that design, port 8080 must accept traffic only from the trusted TLS ingress so clients cannot spoof forwarding headers.

Readiness intentionally excludes AI-provider availability. A provider outage should disable or fail provider-backed workflows safely without removing authentication and document-management traffic from service.

## Migrations

The API applies ordered, idempotent migrations from `apps/api/migrations` inside a transaction before it starts listening. A PostgreSQL advisory lock serializes concurrent migration attempts, and `schema_migrations` records applied files.

Before a release, back up both persistence domains and review every new SQL file for lock duration and compatibility. Deploy one API instance with no traffic, wait for `/api/ready`, inspect migration logs/database state, then roll out the remaining instances. Never edit an already released migration; add a new forward migration.

There is no automatic down-migration command. Application rollback is safe only while the new schema remains backward compatible. A destructive schema rollback requires an approved restore rehearsal and a maintenance window.

## Backup and restore

PostgreSQL rows and document bytes form one logical backup. Assign both artifacts the same backup identifier and retention policy. A shared identifier is not a consistency guarantee: maintain a write-quiescence window from before the first capture until after the second capture completes.

For the Compose demo, quiesce writes before capture:

```bash
mkdir -p backups
docker compose stop web api
docker compose exec -T database pg_dump -U "${KEYSTONE_DATABASE_USER:-keystone}" -d "${KEYSTONE_DATABASE_NAME:-keystone}" --format=custom > backups/keystone.dump
docker compose cp api:/var/lib/keystone/objects backups/objects
docker compose start api web
```

In cloud environments, remove the public ingress or otherwise quiesce writes across the entire managed PostgreSQL backup and filesystem-snapshot window. If the platform cannot coordinate those captures, this release does not provide an application-level checkpoint protocol and the pair must not be described as a consistent backup. Encrypt backups, restrict restore permissions, test retention expiry, and keep at least one copy outside the failure domain of the primary service.

Restore only into an isolated environment first. For a disposable Compose restore target, keep application services stopped, start only `database`, recreate the database, and restore the matching dump:

```bash
docker compose stop web api
docker compose up --detach --wait database
docker compose exec -T database dropdb --if-exists -U "${KEYSTONE_DATABASE_USER:-keystone}" "${KEYSTONE_DATABASE_NAME:-keystone}"
docker compose exec -T database createdb -U "${KEYSTONE_DATABASE_USER:-keystone}" "${KEYSTONE_DATABASE_NAME:-keystone}"
docker compose exec -T database pg_restore -U "${KEYSTONE_DATABASE_USER:-keystone}" -d "${KEYSTONE_DATABASE_NAME:-keystone}" --clean --if-exists --no-owner < backups/keystone.dump
```

Restore the object snapshot with the platform's volume-restore mechanism, preserving its paths and assigning ownership to the API container's `node` user. Then start the candidate release and run the smoke and browser acceptance checks. Promote the restore only after row counts, representative downloads, indexing state, grounded citations, and `/api/ready` have been verified. A production restore procedure must be rehearsed for the chosen storage platform; the repository cannot supply a portable ownership-safe volume restore command.

## Monitoring and alerting

Collect the API's JSON stdout events and container/platform metrics. The current allow-listed events support request count, aggregate status class, duration, correlation, lifecycle, and readiness state; platform metrics provide restarts, CPU, memory, disk, and database resource signals. Provider-specific telemetry is not currently emitted. Provider latency/error dashboards require additional privacy-safe operation, outcome, and duration instrumentation before they can be built without inferring from aggregate request data.

Alert on sustained `/api/ready` failures, elevated aggregate 5xx rate, latency regression, restart loops, low database or document-volume capacity, migration failure, expired TLS certificates, backup failure, and missed restore rehearsal. Add provider alerts only after the provider instrumentation described above exists. Correlation IDs connect safe request-completion events to platform traces without logging user content.

Treat `/api/health` failure as a process incident, `/api/ready` failure as a database/service-admission incident, and provider failures as degraded AI functionality. Define recovery-time and recovery-point objectives before choosing alert thresholds and backup frequency.

## Release and rollback

1. Run the acceptance checklist on the release commit and require exact-head CI.
2. Record the API image digest, web image digest, migration set, configuration version, and backup identifier.
3. Deploy the new images without traffic, wait for health/readiness, and run the container smoke test against the candidate URL.
4. Shift traffic gradually while watching readiness, aggregate 5xx rate, latency, and restarts. When provider-backed workflows are enabled, run a manual provider canary with non-sensitive test content and verify the expected indexed-source and grounded-answer result; do not infer provider health from telemetry this release does not emit.
5. If application behavior regresses and the schema is backward compatible, route traffic to the previous immutable image digests.
6. If data or an incompatible migration is involved, stop writes and execute the rehearsed database-plus-document restore procedure. Do not mix a restored database with document bytes from another backup identifier.

Keep the previous working revision and its image digests until the observation window and backup verification complete.

## Acceptance checklist

- `npm ci` succeeds from a clean checkout on Node.js 20.19 or newer.
- `npm run lint`, `npm run typecheck`, `npm test -- --run`, `npm run evaluate:grounded`, and `npm run build` pass with PostgreSQL 16 plus pgvector available through `TEST_DATABASE_URL`.
- `docker compose build --pull` and `docker compose up --detach --wait --wait-timeout 120` succeed.
- Both application containers run as non-root users.
- `node scripts/smoke-containers.mjs` passes against built containers.
- `npx playwright test` passes against `compose.yaml` plus `compose.e2e.yaml` and emits only privacy-safe diagnostics.
- The release has an immutable commit SHA and exact-head GitHub Actions success.
- Backup age, restore ownership, migration state, TLS, provider privacy terms, and rollback image digests are reviewed by an operator.

The deterministic provider and browser flows prove integration behavior, not live-model answer quality.

## Known limitations

- No production cloud resources or public deployment are included.
- Scanned or image-only PDFs require OCR, which is not implemented.
- The filesystem object store is durable for one shared filesystem but is not a multi-region or horizontally scalable object store.
- The groundedness benchmark detects its unsupported-answer negative control but does not prove general semantic entailment.
- External provider availability, output quality, retention, and regional processing are outside Keystone's control.

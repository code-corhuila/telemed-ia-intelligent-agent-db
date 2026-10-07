# telemed-ia-intelligent-agent-db

MongoDB persistence and migration repository for the **TeleMed IA Intelligent Agent** bounded context.

## Governance and project documentation

[https://github.com/code-corhuila/telemed-ia-docs/tree/main](https://github.com/code-corhuila/telemed-ia-docs/tree/main)

## Purpose

This repository owns the database structure, versioned migrations, indexes,
validators, roles, and data evolution required by `agent-service`.

Its current business scope is **HU-06 — Pre-Consultation with Intelligent Agent**.

The Agent Service owns:

- Pre-consultation conversations.
- Conversation messages.
- Patient-provided information collected during pre-consultation.
- Structured `PreConsultationSummary`.
- Pre-consultation session state.

No other service writes directly to this database.

## Technology

- Database engine: **MongoDB**
- Migration tool: **Liquibase**
- Liquibase image: `liquibase/liquibase:5.0.4`
- MongoDB Liquibase packages: `liquibase-mongodb` and `mongodb`
- Domain database: `intelligent_agent`
- Replica set: `rs0`

MongoDB is supplied by `telemed-ia-infra-mongo`.

This repository does **not** define its own MongoDB service or persistent
database volume.

## HU-06 persistence model

The planned persistence model contains:

| Collection | Responsibility |
|---|---|
| `conversations` | Pre-consultation lifecycle and patient association |
| `messages` | Patient and Intelligent Agent messages |
| `preconsultation_summaries` | Final structured pre-consultation summary |
| `idempotency_records` | Prevent duplicate resource creation on retries |
| `outbox_events` | Reliably persist domain events before publication |

`patientId` is an external identifier. No cross-domain database relationship
or MongoDB foreign key is created.

## Clinical safety boundary

The database model must support the Agent Service clinical boundary.

A `PreConsultationSummary` may store patient-provided information such as:

- Consultation reason.
- Symptoms described by the patient.
- Evolution time when provided.
- Relevant history provided by the patient.

It must not contain AI-generated:

- Diagnoses.
- Medication prescriptions.
- Medication recommendations.
- Treatment decisions.
- Clinical referrals.
- Final medical conclusions.

Those responsibilities belong to the Medical Consultation bounded context.

## Idempotency

Resource creation is protected through `Idempotency-Key`.

The persistence model will maintain `idempotency_records` so a retry of the
same creation request returns the previously created resource instead of
creating a duplicate.

The idempotency record and created resource must be persisted atomically.

MongoDB therefore runs as a replica set so multi-document transactions are
available.

## Outbox

When generation of a `PreConsultationSummary` produces the domain event:

```text
PreConsultationSummaryGenerated
```

the event is first persisted in `outbox_events` in the same transaction as the
business change.

The event payload exposes identifiers only and does not duplicate the full
conversation or clinical content.

## MongoDB schema rules

Collections are governed by MongoDB `$jsonSchema` validators.

Rules:

- `validationLevel: strict`
- `validationAction: error`
- `additionalProperties: false`
- Explicit field types and allowed values
- Explicitly named indexes
- Unique constraints implemented with unique indexes
- No MongoDB foreign keys
- Every changeset is independently idempotent
- Every changeset defines its rollback
- Applied changesets are never edited; corrections use new changesets

## Repository structure

```text
01_ddl/
├── 00_collections/
├── 01_validators/
├── 02_indexes/
├── 03_views/
└── changelog.yaml

02_dml/
├── 00_inserts/
├── 01_updates/
├── 02_deletes/
├── 03_upserts/
├── 04_patches/
└── changelog.yaml

03_dcl/
├── 00_roles/
└── changelog.yaml

changelog/
└── changelog-master.yaml

deploy/
├── compose.yml
└── liquibase.Dockerfile
```

`changelog/changelog-master.yaml` is the single Liquibase entry point.

## Liquibase control collections

This domain uses dedicated Liquibase control collections:

- `databasechangelog_intelligent_agent`
- `databasechangeloglock_intelligent_agent`

They must not be shared with migrations from another domain.

## Environment variables

The migration runner reads:

- `INTELLIGENT_AGENT_DB_NAME`
- `MONGO_HOST`
- `MONGO_PORT`
- `MONGO_REPLICA_SET`
- `MONGO_ADMIN_USER`
- `MONGO_ADMIN_PASSWORD`

Real credentials and `.env` files must never be committed.

## Running migrations

The MongoDB instance and external platform network must already exist.

The migration runner is defined in `deploy/compose.yml` and applies only
pending changesets.

Example from the infrastructure composition:

```bash
docker compose --env-file env/dev.env --profile tooling run --rm intelligent-agent-db-migrate
```

## Database CI

Database CI verifies the migration lifecycle against an empty MongoDB replica set:

```text
update
→ update again
→ rollback all changesets
→ update again
```

This verifies that:

- The database can be reconstructed from zero.
- Reapplying migrations does not duplicate changes.
- Rollbacks restore the previous state.
- The schema can be rebuilt after rollback.

## Branching and promotion

Permanent branches:

- `develop`
- `qa`
- `main`

No permanent branch accepts direct commits.

Changes enter through child branches and Pull Requests.

Promotion between environments uses re-application:

```bash
git cherry-pick -x <commit>
```

Permanent branches are never merged into each other.

Full governance:

[telemed-ia-docs](https://github.com/code-corhuila/telemed-ia-docs/tree/main)
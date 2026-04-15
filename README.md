# Barcelona

I have a habit of spinning up new side projects, and i got tired of the friction of manually creating a new postgres database for every single idea. It was the same tedious psql commands, every single time.

So, i built Barcelona. It's a simple, opinionated dashboard that automates the entire provisioning process. It handles creating the database, the user, and instantly provides both the direct postgres and a pgbouncer connection string.

## How to use it?

You give Barcelona a slug like `folks`, and it will:

- create a postgres user
- create a postgres database
- grant the right permissions
- show you the connection strings

## Running it in docker

You can run Barcelona directly with `docker run`:

```bash
docker run -d \
  --name barcelona \
  -p 5352:5352 \
  -e BARCELONA_SECRET_KEY=replace-me-with-a-long-random-secret \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/postgres \
  -e POSTGRES_CONNECTION_HOST=localhost:5432 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/backups:/app/backups" \
  ghcr.io/johnyrokita/barcelona:latest
```

That will:

- expose Barcelona on `http://localhost:5352`
- store the SQLite database in `./data`
- store SQL backups in `./backups`

If you prefer docker compose, here's the basic snippet:

```yaml
services:
  barcelona:
    image: ghcr.io/johnyrokita/barcelona:latest
    container_name: barcelona
    restart: unless-stopped
    ports:
      - "5352:5352"
    environment:
      BARCELONA_SECRET_KEY: replace-me-with-a-long-random-secret
      DATABASE_URL: postgresql://postgres:postgres@host.docker.internal:5432/postgres
      POSTGRES_CONNECTION_HOST: localhost:5432
      # Optional
      # PGBOUNCER_CONNECTION_HOST: localhost:6432
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
```

What the env vars do:

- `BARCELONA_SECRET_KEY`: encrypts the managed database passwords stored in the local SQLite file
- `DATABASE_URL`: the real postgres admin connection Barcelona uses for provisioning, stats, and backups
- `POSTGRES_CONNECTION_HOST`: only used for the displayed direct postgres connection string
- `PGBOUNCER_CONNECTION_HOST`: only used for the displayed pgbouncer connection string, and only if you set it

You can generate a good `BARCELONA_SECRET_KEY` with:

```bash
openssl rand -hex 32
```

If you want a full compose example with both postgres and Barcelona in the same file, check [docker-compose.example.yml](./docker-compose.example.yml).

## Running it locally

Install dependencies:

```bash
bun install
```

Start the app:

```bash
bun dev
```

Then open [http://localhost:5352](http://localhost:5352).

You'll need a `DATABASE_URL` that points at a postgres instance Barcelona can administer.

Example:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
BARCELONA_SECRET_KEY=replace-me-with-a-long-random-secret
```

`BARCELONA_SECRET_KEY` is used to encrypt the managed database passwords stored in the local SQLite file.

Optional:

```bash
POSTGRES_CONNECTION_HOST=localhost:5432
PGBOUNCER_CONNECTION_HOST=localhost:6432
```

These two are only for the visual connection strings Barcelona shows you. They are not used for the real admin connection. The real admin connection always comes from `DATABASE_URL`. I added this so it's easier for me to copy the strings that include my EndpointSlice for my k8s cluster.

## Local data

Barcelona stores local state in:

- `data/barcelona.sqlite`
- `backups/`

That includes:

- managed database metadata
- encrypted managed database passwords
- users
- sessions
- 2fa secrets
- local SQL backup files

## Auth

The first registered account becomes the approved admin automatically.

After that, new accounts are created in a pending state until an admin approves them from the dashboard.

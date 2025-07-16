# Frontend of learn.tg

## Getting Started

Copy `.env.template` into `.env`, adjust `.env` and run in 
development mode with:

```bash
bin/dev
```

## Running in production

Configure port for example 3025 in .env:
```
PORT=3025
```

Build and run with:
```sh
./bin/prod.sh
```

nginx should run it with a proxy


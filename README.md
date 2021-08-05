# Jellyfish Worker

Jellyfish workers are in charge of consuming action requests from the queue,
executing them, and reporting back the results. This module provides an lower
level interface to write a worker server. The intention is that we can write
multiple types of workers, optimised for different tasks using a single shared
framework.

# Usage

Below is an example how to use this library:

```js
import { Worker } from '@balena/jellyfish-worker';

const worker = new Worker(
	jellyfish,
	jellyfish.sessions.admin,
	actionLibrary,
	consumer,
);
await worker.initialize(context);

const id = worker.getId();
console.log(`Worker ID: ${worker.getId()}`);
```

# Documentation

[![Publish Documentation](https://github.com/product-os/jellyfish-worker/actions/workflows/publish-docs.yml/badge.svg)](https://github.com/product-os/jellyfish-worker/actions/workflows/publish-docs.yml)

Visit the website for complete documentation: https://product-os.github.io/jellyfish-worker

# Testing

Unit tests can be easily run with the command `npm test`. This will run all unit tests (found in the `/lib` folder).

The integration tests require Postgres and Redis instances. The simplest way to run the tests locally is with `docker-compose`.
You may need to export an `NPM_TOKEN` and values for the environment variables defined in `test.env` before running the command below.

```
npm run test:compose
```

You can also run tests locally against Postgres and Redis instances running in `docker-compose`:
```
$ npm run compose
$ POSTGRES_USER=docker POSTGRES_PASSWORD=docker npx jest test/integration/example.spec.ts
```

You can also access these Postgres and Redis instances:
```
$ PGPASSWORD=docker psql -hlocalhost -Udocker
$ redis-cli -h localhost
```

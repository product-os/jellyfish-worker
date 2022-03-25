# Jellyfish Worker

Jellyfish workers are in charge of consuming action requests from the queue,
executing them, and reporting back the results. This module provides an lower
level interface to write a worker server. The intention is that we can write
multiple types of workers, optimised for different tasks using a single shared
framework.

# Usage

Below is an example how to use this library:

```typescript
import { foobarPlugin } from '@balena/jellyfish-plugin-foobar';
import { PluginManager, Worker } from '@balena/jellyfish-worker';
import * as autumndb from 'autumndb';
import { v4 as uuidv4 } from 'uuid';

const bootstrap = async () => {
	// Define common log context
	const logContext = {
		id: `SERVER-${uuidv4()}`,
	};

	// Set up plugins
	const pluginManager = new PluginManager([
		foobarPlugin(),
	]);
	const integrations = pluginManager.getSyncIntegrations(logContext);
	const actionLibrary = pluginManager.getActions(logContext);

	// Set up cache
	const cache = new autumndb.Cache(environment.redis);
	await cache.connect();

	// Set up database
	const { kernel, pool } = await autumndb.Kernel.withPostgres(
		logContext,
		cache,
		environment.database.options,
	);

	// Create and new worker instance
	const worker = new Worker(
		kernel,
		kernel.adminSession()!,
		actionLibrary,
		pool,
	);

	// Set up a sync instance using integrations from plugins
	const sync = new Sync({
		integrations,
	});

	// Initialize worker instance
	await worker.initialize(context, sync, async (actionRequest) => {
		console.log('actionRequest:', JSON.stringify(actionRequest, null, 4));
	});

	// Check that the worker instance is functioning
	console.log('Worker ID:', worker.getId());

	// Close everything down cleanly
	await worker.consumer.cancel();
	await kernel.disconnect(logContext);
	await cache.disconnect();
}
```

# Documentation

[![Publish Documentation](https://github.com/product-os/jellyfish-worker/actions/workflows/publish-docs.yml/badge.svg)](https://github.com/product-os/jellyfish-worker/actions/workflows/publish-docs.yml)

Visit the website for complete documentation: https://product-os.github.io/jellyfish-worker

# Testing

Unit tests can be easily run with the command `npm test`. This will run all unit tests (found in the `/lib` folder).

The integration tests require Postgres and Redis instances. The simplest way to run the tests locally is with `docker-compose`.

```
$ npm run test:compose
```

You can also run tests locally against Postgres and Redis instances running in `docker-compose`:
```
$ npm run compose
$ REDIS_HOST=localhost POSTGRES_HOST=localhost npx jest test/integration/utils.spec.ts
```

You can also access these Postgres and Redis instances:
```
$ PGPASSWORD=docker psql -hlocalhost -Udocker
$ redis-cli -h localhost
```

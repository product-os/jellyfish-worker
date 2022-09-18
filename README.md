# Jellyfish Worker

The Jellyfish worker is a layer over the top of [`AutumnDB`](https://github.com/product-os/autumndb) that adds a queue and job processing.
To perform writes to the underlying data store, you create a job as an `action-request` contract and the worker will process it.
The Jellyfish worker also provides:

- a framework for building integrations with 3rd party services
- support for formula fields using [Jellyscript](https://github.com/product-os/jellyfish-jellyscript)
- automatic paper trails for updates, creation and authorship
- support for hook functionality using triggered actions
- support for time delayed and recurring actions

Multiple worker instances can be safely run in parralel, as the system utilises postgraphile to enqueue and dequeue jobs.

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

Unit tests can be easily run with the command `npm test`.

You can run integration tests locally against Postgres and Redis instances running in `docker-compose`:
```bash
npm run compose
REDIS_HOST=localhost POSTGRES_HOST=localhost npm run test:integration
```

You can also access these Postgres and Redis instances:
```bash
PGPASSWORD=docker psql -hlocalhost -Udocker
redis-cli -h localhost
```

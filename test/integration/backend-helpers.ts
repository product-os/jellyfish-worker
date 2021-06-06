/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

// TODO: Deep importing core modules in this way is an abomination
// Additionally this code is exactly the same as the code found in the jellyfish queue module
import { defaultEnvironment } from '@balena/jellyfish-environment';
import { v4 as uuidv4 } from 'uuid';
import * as utils from './utils';
import { Context } from '@balena/jellyfish-types/build/core';
import { Backend, Kernel, errors, MemoryCache } from '@balena/jellyfish-core';

export interface BackendTestOptions {
	suffix?: string;
	skipConnect?: boolean;
}

export interface BackendCoreTestContext {
	cache: InstanceType<typeof MemoryCache>;
	context: Context;
	backend: InstanceType<typeof Backend>;
}

const backendBefore = async (
	context: Partial<BackendCoreTestContext>,
	options: BackendTestOptions = {},
): Promise<BackendCoreTestContext> => {
	const suffix = options.suffix || uuidv4();
	const dbName = `test_${suffix.replace(/-/g, '_')}`;

	context.cache = new MemoryCache(
		Object.assign({}, defaultEnvironment.redis, {
			namespace: dbName,
		}),
	);

	context.context = {
		id: `CORE-TEST-${uuidv4()}`,
	};

	if (context.cache) {
		await context.cache.connect();
	}

	const backend = new Backend(
		context.cache,
		errors,
		Object.assign({}, defaultEnvironment.database.options, {
			database: dbName,
		}),
	);

	if (!options.skipConnect) {
		await backend.connect(context.context);
	}

	context.backend = backend;

	return context as BackendCoreTestContext;
};

const backendAfter = async (context: BackendCoreTestContext): Promise<void> => {
	/*
	 * We can just disconnect and not destroy the whole
	 * database as test databases are destroyed before
	 * the next test run anyways.
	 */
	await context.backend.disconnect(context.context);

	if (context.cache) {
		await context.cache.disconnect();
	}
};

export interface BackendGeneralTestContext {
	kernel: InstanceType<typeof Kernel>;
	generateRandomSlug: typeof utils.generateRandomSlug;
	generateRandomID: typeof utils.generateRandomID;
}

export interface BackendTestContext
	extends BackendCoreTestContext,
		BackendGeneralTestContext {}

export const before = async (
	contextInput: Partial<BackendTestContext>,
	options: { suffix?: string } = {},
): Promise<BackendTestContext> => {
	const context = (await backendBefore(contextInput, {
		skipConnect: true,
		suffix: options.suffix,
	})) as BackendCoreTestContext & Partial<BackendGeneralTestContext>;

	if (options.suffix) {
		await context.backend.connect(context.context);
		await context.backend.reset(context.context);
	}

	const kernel = new Kernel(context.backend);
	await kernel.initialize(context.context);
	context.kernel = kernel;
	context.generateRandomSlug = utils.generateRandomSlug;
	context.generateRandomID = utils.generateRandomID;

	return context as BackendTestContext;
};

export const after = async (context: BackendTestContext): Promise<void> => {
	await context.backend.drop(context.context);
	await context.kernel.disconnect(context.context);
	await backendAfter(context);
};

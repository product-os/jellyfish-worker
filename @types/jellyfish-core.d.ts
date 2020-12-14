/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

declare module '@balena/jellyfish-core/lib/cards/mixins' {
	const mixins: any;
	export default mixins;
}

// TS-TODO: These additional tpyes are required because of the abominated subpath imports used in `backend-helpers.ts`
// This needs to be cleaned up.
declare module '@balena/jellyfish-core' {
	import { core } from '@balena/jellyfish-types';

	export class Backend extends core.Backend {
		constructor(arg1: any, arg2: any, arg3: any): core.Backend;
		connect: core.Backend['connect'];
		cache: core.Backend['cache'];
		errors: core.Backend['errors'];
		connection: core.Backend['connection'];
		disconnect: core.Backend['disconnect'];
		drop: core.Backend['drop'];
		reset: core.Backend['reset'];
		insertElement: core.Backend['insertElement'];
		upsertElement: core.Backend['upsertElement'];
		withTransaction: core.Backend['withTransaction'];
		withSerializableTransaction: core.Backend['withSerializableTransaction'];
		getElementById: core.Backend['getElementById'];
		getElementBySlug: core.Backend['getElementBySlug'];
		getElementsById: core.Backend['getElementsById'];
		query: core.Backend['query'];
		prepareQueryForStream: core.Backend['prepareQueryForStream'];
		stream: core.Backend['stream'];
		getStatus: core.Backend['getStatus'];
		createTypeIndex: core.Backend['createTypeIndex'];
		createFullTextSearchIndex: core.Backend['createFullTextSearchIndex'];
	}

	export class MemoryCache implements core.Cache {
		constructor(arg: any): core.Cache;
		connect: () => Promise<void>;
		disconnect: () => Promise<void>;
		set: <TElement>(table: string, element: TElement) => Promise<void>;
		unset: <TElement>(element: TElement) => Promise<void>;
		reset: () => Promise<void>;
		getById: <TElement>(
			table: string,
			id: string,
		) => Promise<CacheResult<TElement>>;
		getBySlug: <TElement>(
			table: string,
			slug: string,
		) => Promise<CacheResult<TElement>>;
		setMissingId: (table: string, id: string) => Promise<void>;
		setMissingSlug: (table: string, slug: string) => Promise<void>;
	}

	export class Kernel extends core.JellyfishKernel {
		constructor(arg: any): core.JellyfishKernel;
		initialize: core.JellyfishKernel['initialize'];
		backend: core.JellyfishKernel['backend'];
		errors: core.JellyfishKernel['errors'];
		cards: core.JellyfishKernel['cards'];
		sessions: core.JellyfishKernel['sessions'];
		disconnect: core.JellyfishKernel['disconnect'];
		getCardById: core.JellyfishKernel['getCardById'];
		getCardBySlug: core.JellyfishKernel['getCardBySlug'];
		insertCard: core.JellyfishKernel['insertCard'];
		replaceCard: core.JellyfishKernel['replaceCard'];
		patchCardBySlug: core.JellyfishKernel['patchCardBySlug'];
		query: core.JellyfishKernel['query'];
		stream: core.JellyfishKernel['stream'];
		defaults: core.JellyfishKernel['defaults'];
		getStatus: core.JellyfishKernel['getStatus'];
	}

	export const errors: any;
}

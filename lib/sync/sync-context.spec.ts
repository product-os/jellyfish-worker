import type { Contract } from '@balena/jellyfish-types/build/core';
import jsonpatch from 'fast-json-patch';
import _ from 'lodash';
import sinon from 'sinon';
import skhema from 'skhema';
import * as uuid from 'uuid';
import type { WorkerContext } from '../types';
import { getActionContext } from './sync-context';

const makeWorkerContextStub = (
	cardFixtures: Array<Partial<Contract>>,
): WorkerContext => {
	const defaults = (contract: Partial<Contract>) => {
		if (!contract.id) {
			contract.id = uuid.v4();
		}
		if (!contract.slug) {
			contract.slug = `${contract.type}-${uuid.v4()}`;
		}

		return contract;
	};

	const store = _.cloneDeep(cardFixtures).map(defaults) as Contract[];

	return {
		query: async (_session: string, schema: any) => {
			return _.filter(store, (card) => {
				return skhema.isValid(schema, card);
			});
		},
		getCardBySlug: async (_session, slugWithVersion) => {
			const slug = slugWithVersion.split('@')[0];
			return (
				_.find(store, {
					slug,
				}) || null
			);
		},
		getCardById: async (_session, id) => {
			return (
				_.find(store, {
					id,
				}) || null
			);
		},
		insertCard: async (_session, _typeCard, _options, object) => {
			if (
				_.find(store, {
					slug: object.slug,
				})
			) {
				throw new Error(`${object.slug} already exists`);
			}
			store.push(defaults(object) as Contract);
			return object;
		},
		patchCard: async (_session, _typeCard, _options, current, patch) => {
			const existing = _.find(store, {
				id: current.id,
			});
			if (!existing) {
				throw new Error(`Can't find contract to patch: ${current.id}`);
			}
			jsonpatch.applyPatch(existing, patch);
			return existing;
		},
		defaults: defaults as any,
		errors: {
			WorkerNoElement: {} as any,
		},
		privilegedSession: uuid.v4(),
	};
};

describe('context.getElementByMirrorId()', () => {
	test('should match mirrors exactly', async () => {
		const mirrorId = 'test://1';
		const card1 = {
			id: uuid.v4(),
			slug: `card-${uuid.v4()}`,
			type: 'card',
			data: {
				mirrors: [mirrorId],
			},
		};

		const card2 = {
			id: uuid.v4(),
			slug: `card-${uuid.v4()}`,
			type: 'card',
			data: {
				mirrors: ['test://2'],
			},
		};

		const workerContextStub = makeWorkerContextStub([card1, card2]);

		const context = getActionContext('foobar', workerContextStub, {}, '');

		const result: any = await context.getElementByMirrorId('card', mirrorId);

		expect(result).toEqual(card1);
	});

	test('should match by type', async () => {
		const mirrorId = 'test://1';
		const card1 = {
			id: uuid.v4(),
			slug: `card-${uuid.v4()}`,
			type: 'card',
			data: {
				mirrors: [mirrorId],
			},
		};

		const card2 = {
			id: uuid.v4(),
			slug: `card-${uuid.v4()}`,
			type: 'foo',
			data: {
				mirrors: [mirrorId],
			},
		};

		const workerContextStub = makeWorkerContextStub([card1, card2]);

		const context = getActionContext('foobar', workerContextStub, {}, '');

		const result: any = await context.getElementByMirrorId('card', mirrorId);

		expect(result).toEqual(card1);
	});

	test('should not return anything if there is no match', async () => {
		const mirrorId = 'test://1';
		const card1 = {
			type: 'card',
			data: {
				mirrors: [mirrorId],
			},
		};

		const card2 = {
			type: 'card',
			data: {
				mirrors: ['test://2'],
			},
		};

		const workerContextStub = makeWorkerContextStub([card1, card2]);

		const context = getActionContext('foobar', workerContextStub, {}, '');

		const result = await context.getElementByMirrorId('card', 'foobarbaz');

		expect(result).toBeFalsy();
	});

	test('should optionally use a pattern match for the mirror Id', async () => {
		const card1 = {
			id: uuid.v4(),
			slug: `card-${uuid.v4()}`,
			type: 'card',
			data: {
				mirrors: ['test://foo/1'],
			},
		};

		const card2 = {
			id: uuid.v4(),
			slug: `card-${uuid.v4()}`,
			type: 'card',
			data: {
				mirrors: ['test://bar/2'],
			},
		};

		const workerContextStub = makeWorkerContextStub([card1, card2]);

		const context = getActionContext('foobar', workerContextStub, {}, '');

		const result: any = await context.getElementByMirrorId('card', 'foo/1', {
			usePattern: true,
		});

		expect(result).toEqual(card1);
	});
});

describe('context.upsertElement()', () => {
	test('should create a new element', async () => {
		const typeCard = {
			type: 'type',
			slug: 'card',
			data: {
				schema: {
					type: 'object',
				},
			},
		};

		const workerContextStub = makeWorkerContextStub([typeCard]);

		const insertSpy = sinon.spy(workerContextStub, 'insertCard');
		const patchSpy = sinon.spy(workerContextStub, 'patchCard');

		const context = getActionContext(
			'foobar',
			workerContextStub,
			{
				id: 1,
			},
			'',
		);

		const newCard = {
			type: 'card',
			slug: 'card-foobarbaz',
			data: {
				test: 1,
			},
		};

		const result = await context.upsertElement('card', newCard, {
			actor: 'ahab',
		});

		expect(insertSpy.calledOnce).toBe(true);
		expect(patchSpy.notCalled).toBe(true);

		expect(result.slug).toBe(newCard.slug);
	});

	test('should patch an element if the slug exists but no id is provided', async () => {
		const typeCard = {
			type: 'type',
			slug: 'card',
			data: {
				schema: {
					type: 'object',
				},
			},
		};

		const card1 = {
			type: 'card',
			slug: 'card-foobarbaz',
			data: {
				test: 1,
			},
		};

		const newCard = {
			...card1,
			data: {
				test: 2,
			},
		};

		const workerContextStub = makeWorkerContextStub([typeCard, card1]);

		const insertSpy = sinon.spy(workerContextStub, 'insertCard');
		const patchSpy = sinon.spy(workerContextStub, 'patchCard');

		const context = getActionContext(
			'foobar',
			workerContextStub,
			{
				id: 1,
			},
			'',
		);

		const result = await context.upsertElement('card', newCard, {
			actor: 'ahab',
		});

		expect(insertSpy.notCalled).toBe(true);
		expect(patchSpy.calledOnce).toBe(true);

		expect(result.slug).toBe(card1.slug);
		expect(result.data.test).toBe(newCard.data.test);
	});

	test('should patch an element by id even if the slugs differ', async () => {
		const typeCard = {
			type: 'type',
			slug: 'card',
			data: {
				schema: {
					type: 'object',
				},
			},
		};

		const card1 = {
			id: 'f41b64b3-153c-438d-b8f2-0c592f742b4c',
			type: 'card',
			slug: 'card-foobarbaz',
			data: {
				test: 1,
			},
		};

		const workerContextStub = makeWorkerContextStub([typeCard, card1]);

		const insertSpy = sinon.spy(workerContextStub, 'insertCard');
		const patchSpy = sinon.spy(workerContextStub, 'patchCard');

		const context = getActionContext(
			'foobar',
			workerContextStub,
			{
				id: 1,
			},
			'',
		);

		const newCard = {
			...card1,
			slug: `${card1.slug}-fuzzbuzzfizz`,
			data: {
				test: 2,
			},
		};

		const result = await context.upsertElement('card', newCard, {
			actor: 'ahab',
		});

		expect(insertSpy.notCalled).toBe(true);
		expect(patchSpy.calledOnce).toBe(true);

		expect(result.slug).toBe(card1.slug);
		expect(result.id).toBe(card1.id);
		expect(result.data.test).toBe(newCard.data.test);
	});

	test('should patch an element by id when the slugs are the same', async () => {
		const typeCard = {
			type: 'type',
			slug: 'card',
			data: {
				schema: {
					type: 'object',
				},
			},
		};

		const card1 = {
			id: 'f41b64b3-153c-438d-b8f2-0c592f742b4c',
			type: 'card',
			slug: 'card-foobarbaz',
			data: {
				test: 1,
			},
		};

		const workerContextStub = makeWorkerContextStub([typeCard, card1]);

		const insertSpy = sinon.spy(workerContextStub, 'insertCard');
		const patchSpy = sinon.spy(workerContextStub, 'patchCard');

		const context = getActionContext(
			'foobar',
			workerContextStub,
			{
				id: 1,
			},
			'',
		);

		const newCard = {
			...card1,
			data: {
				test: 2,
			},
		};

		const result = await context.upsertElement('card', newCard, {
			actor: 'ahab',
		});

		expect(insertSpy.notCalled).toBe(true);
		expect(patchSpy.calledOnce).toBe(true);

		expect(result.slug).toBe(card1.slug);
		expect(result.id).toBe(card1.id);
		expect(result.data.test).toBe(newCard.data.test);
	});

	test('should patch an element using a patch object', async () => {
		const typeCard = {
			type: 'type',
			slug: 'card',
			data: {
				schema: {
					type: 'object',
				},
			},
		};

		const card1 = {
			id: 'f41b64b3-153c-438d-b8f2-0c592f742b4c',
			type: 'card',
			slug: 'card-foobarbaz',
			data: {
				test: 1,
			},
		};

		const workerContextStub = makeWorkerContextStub([typeCard, card1]);

		const insertSpy = sinon.spy(workerContextStub, 'insertCard');
		const patchSpy = sinon.spy(workerContextStub, 'patchCard');

		const context = getActionContext(
			'foobar',
			workerContextStub,
			{
				id: 1,
			},
			'',
		);

		const update = {
			id: card1.id,
			patch: [
				{
					op: 'replace',
					path: '/data/test',
					value: 2,
				},
			],
		};

		const result = await context.upsertElement('card', update, {
			actor: 'ahab',
		});

		expect(insertSpy.notCalled).toBe(true);
		expect(patchSpy.calledOnce).toBe(true);

		expect(result.slug).toBe(card1.slug);
		expect(result.id).toBe(card1.id);
		expect(result.data.test).toBe(update.patch[0].value);
	});
});

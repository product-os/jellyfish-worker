/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import sinon from 'sinon';
import _ from 'lodash';
import { v4 as uuid } from 'uuid';
import * as transformers from './transformers';
import { core } from '@balena/jellyfish-types';

const getEvaluateParamsStub = (
	transformerCards: core.Contract[],
	oldCard: core.Contract | null,
	newCard: core.Contract,
	returnActor: boolean = true,
) => {
	const executeSpy = sinon.spy((actionRequest) => {
		// This stub assumes that action requests only ever create a card
		return {
			error: false,
			data: {
				id: uuid(),
				slug: `${actionRequest.card.split('@')[0]}-${uuid()}`,
			},
		};
	});

	const params: transformers.EvaluateOptions = {
		transformers: _.castArray(transformerCards),
		oldCard,
		newCard,
		context: {
			id: 'foobar',
			api: '0',
		},

		// Query is only used to receive and actorId, so just stub the response here
		query: async (
			_schema: Parameters<transformers.EvaluateOptions['query']>[0],
			_opts: Parameters<transformers.EvaluateOptions['query']>[1],
		) => {
			return returnActor
				? [
						{
							type: 'user',
							id: uuid(),
							data: {},
						} as core.Contract,
				  ]
				: [];
		},
		executeAndAwaitAction: (executeSpy as any) as transformers.EvaluateOptions['executeAndAwaitAction'],
	};

	// Return the spy and stub as a tuple
	return {
		executeSpy,
		params,
	};
};

describe('.evaluate()', () => {
	test('should create a task if a transformer matches a card that has been set to artifactReady:true', async () => {
		const transformer = {
			id: uuid(),
			slug: 'test-transformer',
			type: 'transformer@@1.0.0',
			data: {
				inputFilter: {
					type: 'object',
				},
			},
		};

		const oldCard = {
			type: 'card@1.0.0',
			data: {
				$transformer: {
					artifactReady: false,
				},
			},
		};
		const newCard = {
			type: 'card@1.0.0',
			data: {
				$transformer: {
					artifactReady: true,
				},
			},
		};

		const { executeSpy, params } = getEvaluateParamsStub(
			[(transformer as any) as core.Contract],
			(oldCard as any) as core.Contract,
			(newCard as any) as core.Contract,
		);

		await transformers.evaluate(params as transformers.EvaluateOptions);

		// Two actions were executed
		expect(executeSpy.calledTwice).toBe(true);
		// The first call was for a task
		expect(executeSpy.firstCall.firstArg.card).toBe('task@1.0.0');
		// The first call was to create a card
		expect(executeSpy.firstCall.firstArg.action).toBe(
			'action-create-card@1.0.0',
		);

		// The second call was for a link
		expect(executeSpy.secondCall.firstArg.card).toBe('link@1.0.0');

		// The second call was to create a card
		expect(executeSpy.secondCall.firstArg.action).toBe(
			'action-create-card@1.0.0',
		);
	});

	test('should only create a task when a transformer matches the input for an updated card', async () => {
		const transformer = {
			id: uuid(),
			slug: 'test-transformer',
			type: 'transformer@@1.0.0',
			data: {
				inputFilter: {
					type: 'object',
					properties: {
						name: {
							type: 'string',
							const: 'baz',
						},
					},
				},
			},
		};
		const oldCard = {
			type: 'card@1.0.0',
			name: 'foo',
			data: {
				$transformer: {
					artifactReady: false,
				},
			},
		};
		const newCard = {
			type: 'card@1.0.0',
			name: 'foo',
			data: {
				$transformer: {
					artifactReady: true,
				},
			},
		};

		const { executeSpy, params } = getEvaluateParamsStub(
			[(transformer as any) as core.Contract],
			(oldCard as any) as core.Contract,
			(newCard as any) as core.Contract,
		);

		await transformers.evaluate(params);

		// No actions were executed
		expect(executeSpy.notCalled).toBe(true);
	});

	test('should not create a task when a there is no previous card', async () => {
		const transformer = {
			id: uuid(),
			slug: 'test-transformer',
			type: 'transformer@@1.0.0',
			data: {
				inputFilter: {
					type: 'object',
				},
			},
		};

		const newCard = {
			type: 'card@1.0.0',
			data: {
				$transformer: {
					artifactReady: true,
				},
			},
		};

		const { executeSpy, params } = getEvaluateParamsStub(
			[(transformer as any) as core.Contract],
			null,
			(newCard as any) as core.Contract,
		);

		await transformers.evaluate(params);

		// No actions were executed
		expect(executeSpy.notCalled).toBe(true);
	});

	test("should not create a task if a transformer doesn't have an owner", async () => {
		const transformer = {
			id: uuid(),
			slug: 'test-transformer',
			type: 'transformer@@1.0.0',
			data: {
				inputFilter: {
					type: 'object',
				},
			},
		};

		const oldCard = {
			type: 'card@1.0.0',
			data: {
				$transformer: {
					artifactReady: false,
				},
			},
		};
		const newCard = {
			type: 'card@1.0.0',
			data: {
				$transformer: {
					artifactReady: true,
				},
			},
		};

		const { executeSpy, params } = getEvaluateParamsStub(
			[(transformer as any) as core.Contract],
			(oldCard as any) as core.Contract,
			(newCard as any) as core.Contract,
			false,
		);

		await transformers.evaluate(params);

		// No actions were executed
		expect(executeSpy.notCalled).toBe(true);
	});
});

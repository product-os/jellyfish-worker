import { Contract, SessionContract } from '@balena/jellyfish-types/build/core';
import { errors as coreErrors, Kernel } from 'autumndb';
import {
	ActionContract,
	ActionRequestData,
	ProducerOptions,
	queueErrors,
	testUtils,
} from '../../../lib';

let context: testUtils.TestContext;

beforeAll(async () => {
	context = await testUtils.newContext();
});

afterAll(async () => {
	await testUtils.destroyContext(context);
});

describe('queue', () => {
	describe('.enqueue()', () => {
		test('should include the actor from the passed session', async () => {
			const typeCard = (await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			)) as Contract;
			const session = await context.kernel.getContractById<SessionContract>(
				context.logContext,
				context.session,
				context.session,
			);
			expect(session).not.toBe(null);
			await context.worker.producer.enqueue(context.actor, context.session, {
				action: 'action-create-card@1.0.0',
				logContext: context.logContext,
				card: typeCard!.id,
				type: typeCard!.type,
				arguments: {
					properties: {
						version: '1.0.0',
						slug: 'foo',
						data: {
							foo: 'bar',
						},
					},
				},
			});

			const request = await context.dequeue();
			expect(request).not.toBe(null);
			expect(session!.data.actor).toBe(request!.data.actor);
		});

		test('should include the whole passed action', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			const actionCard = await context.kernel.getContractBySlug<ActionContract>(
				context.logContext,
				context.session,
				'action-create-card@latest',
			);
			await context.worker.producer.enqueue(context.actor, context.session, {
				action: 'action-create-card@1.0.0',
				logContext: context.logContext,
				card: typeCard!.id,
				type: typeCard!.type,
				arguments: {
					properties: {
						version: '1.0.0',
						slug: 'foo',
						data: {
							foo: 'bar',
						},
					},
				},
			});

			const request = await context.dequeue();
			expect(request).not.toBe(null);
			expect(request!.data.action).toBe(
				`${actionCard!.slug}@${actionCard!.version}`,
			);
		});

		test('should set an originator', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			await context.worker.producer.enqueue(context.actor, context.session, {
				action: 'action-create-card@1.0.0',
				logContext: context.logContext,
				card: typeCard!.id,
				type: typeCard!.type,
				originator: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				arguments: {
					properties: {
						slug: 'foo',
						version: '1.0.0',
					},
				},
			});

			const request = await context.dequeue();
			expect(request).not.toBe(null);
			expect(request!.data.originator).toBe(
				'4a962ad9-20b5-4dd8-a707-bf819593cc84',
			);
		});

		test('should take a current date', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			const date = new Date();

			await context.worker.producer.enqueue(context.actor, context.session, {
				action: 'action-create-card@1.0.0',
				logContext: context.logContext,
				card: typeCard!.id,
				type: typeCard!.type,
				currentDate: date,
				arguments: {
					properties: {
						slug: 'foo',
						version: '1.0.0',
					},
				},
			});

			// Removing this as context.dequeue already retries!
			// const dequeue = async (times = 10) => {
			// 	const dequeued = await context.dequeue();
			// 	if (dequeued) {
			// 		return dequeued;
			// 	}

			// 	if (times <= 0) {
			// 		throw new Error("Didn't dequeue in time");
			// 	}

			// 	return dequeue(times - 1);
			// };

			const request = await context.dequeue();
			expect(request).not.toBe(null);
			expect(request!.data.timestamp).toBe(date.toISOString());
		});

		test('should set a present timestamp', async () => {
			const currentDate = new Date();
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			await context.worker.producer.enqueue(context.actor, context.session, {
				action: 'action-create-card@1.0.0',
				logContext: context.logContext,
				card: typeCard!.id,
				type: typeCard!.type,
				arguments: {
					properties: {
						version: '1.0.0',
						slug: 'foo',
						data: {
							foo: 'bar',
						},
					},
				},
			});

			const request = await context.dequeue();
			expect(request).not.toBe(null);
			expect(new Date(request!.data.timestamp) >= currentDate).toBe(true);
		});

		test('should throw if the type is a slug and was not found', async () => {
			expect(() => {
				return context.worker.producer.enqueue(context.actor, context.session, {
					action: 'action-create-card@1.0.0',
					logContext: context.logContext,
					card: 'foo-bar-baz-qux',
					type: 'type',
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
							data: {
								foo: 'bar',
							},
						},
					},
				});
			}).rejects.toThrowError(queueErrors.QueueInvalidRequest);
		});

		test('should throw if the action was not found', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			expect(() => {
				return context.worker.producer.enqueue(context.actor, context.session, {
					action: 'action-foo-bar@1.0.0',
					logContext: context.logContext,
					card: typeCard!.id,
					type: typeCard!.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
							data: {
								foo: 'bar',
							},
						},
					},
				});
			}).rejects.toThrowError(queueErrors.QueueInvalidAction);
		});

		test('should throw if the session was not found', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
			expect(() => {
				return context.worker.producer.enqueue(context.actor, id, {
					action: 'action-create-card@1.0.0',
					logContext: context.logContext,
					card: typeCard!.id,
					type: typeCard!.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
							data: {
								foo: 'bar',
							},
						},
					},
				});
			}).rejects.toThrowError(coreErrors.JellyfishInvalidSession);
		});
	});

	describe('.dequeue()', () => {
		test('should return nothing if no requests', async () => {
			const request = await context.dequeue();
			expect(request).toBe(null);
		});

		test('should not let the same owner take a request twice', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			const actionRequest = await context.worker.producer.enqueue(
				context.actor,
				context.session,
				{
					action: 'action-create-card@1.0.0',
					logContext: context.logContext,
					card: typeCard!.id,
					type: typeCard!.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
							data: {
								foo: 'bar',
							},
						},
					},
				},
			);

			const request1 = await context.dequeue();
			expect(request1).not.toBe(null);
			expect(request1!.slug).toBe(actionRequest.slug);

			const request2 = await context.dequeue();

			expect(request2).toBe(null);
		});

		test('should cope with link materialization failures', async () => {
			const typeCard = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				'card@latest',
			);
			expect(typeCard).not.toBe(null);

			const producerOptions: ProducerOptions = {
				action: 'action-create-card@1.0.0',
				logContext: context.logContext,
				card: typeCard!.id,
				type: typeCard!.type,
				arguments: {
					properties: {
						slug: 'foo',
						version: '1.0.0',
					},
				},
			};

			const enqueued = await context.worker.producer.enqueue(
				context.actor,
				context.session,
				producerOptions,
			);

			const actionRequest = Kernel.defaults<ActionRequestData>({
				id: enqueued.id,
				slug: enqueued.slug,
				type: enqueued.type,
				data: enqueued.data,
			});

			await context.worker.consumer.postResults(
				context.actor,
				context.logContext,
				actionRequest as any,
				{
					error: false,
					data: {
						foo: 'true',
					},
				},
			);

			// Simulate non-materialized links
			await context.kernel.replaceContract(
				context.logContext,
				context.session,
				Object.assign({}, enqueued, {
					links: {},
				}),
			);

			const currentRequest = await context.kernel.getContractBySlug(
				context.logContext,
				context.session,
				`${enqueued.slug}@${enqueued.version}`,
			);
			expect(currentRequest).not.toBe(null);

			expect(currentRequest!.links).toEqual({});
		});
	});
});

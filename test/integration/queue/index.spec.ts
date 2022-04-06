import type { SessionContract } from '@balena/jellyfish-types/build/core';
import { strict as assert } from 'assert';
import { Kernel, testUtils as autumndbTestUtils } from 'autumndb';
import {
	ActionContract,
	ActionRequestData,
	errors,
	testUtils,
} from '../../../lib';

let ctx: testUtils.TestContext;

beforeAll(async () => {
	ctx = await testUtils.newContext();
});

afterAll(() => {
	return testUtils.destroyContext(ctx);
});

describe('queue', () => {
	describe('.enqueue()', () => {
		test('should include the actor from the passed session', async () => {
			const session = await ctx.kernel.getContractById<SessionContract>(
				ctx.logContext,
				ctx.session,
				ctx.session,
			);
			assert(session);

			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					timestamp: new Date().toISOString(),
					attachEvents: false,
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract.id,
						type: typeContract.type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract.id,
						},
						timestamp: new Date().toISOString(),
						arguments: {
							reason: null,
							properties: {
								version: '1.0.0',
								slug: 'foo',
								data: {
									foo: 'bar',
								},
							},
						},
					},
				},
			);
			assert(actionRequest);

			const dequeued = await ctx.dequeue();
			assert(dequeued);
			expect(dequeued.id).toEqual(actionRequest.id);
			expect(dequeued.data.actor).toEqual(session.data.actor);
		});

		test('should include the whole passed action', async () => {
			const actionContract = await ctx.kernel.getContractBySlug<ActionContract>(
				ctx.logContext,
				ctx.session,
				'action-create-card@latest',
			);
			assert(actionContract);

			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract.id,
						type: typeContract.type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract.id,
						},
						timestamp: new Date().toISOString(),
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
				},
			);
			assert(actionRequest);

			const dequeued = await ctx.dequeue();
			assert(dequeued);
			expect(dequeued.id).toEqual(actionRequest.id);
			expect(dequeued.data.action).toBe(
				`${actionContract.slug}@${actionContract.version}`,
			);
		});

		test('should set an originator', async () => {
			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract.id,
						type: typeContract.type,
						originator: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract.id,
						},
						timestamp: new Date().toISOString(),
						arguments: {
							properties: {
								slug: 'foo',
								version: '1.0.0',
							},
						},
					},
				},
			);
			assert(actionRequest);

			const dequeued = await ctx.dequeue();
			assert(dequeued);
			expect(dequeued.id).toBe(actionRequest.id);
			expect(dequeued.data.originator).toBe(
				'4a962ad9-20b5-4dd8-a707-bf819593cc84',
			);
		});

		test('should take a current date', async () => {
			const date = new Date();
			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract.id,
						type: typeContract.type,
						currentDate: date,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract.id,
						},
						timestamp: new Date().toISOString(),
						arguments: {
							properties: {
								slug: 'foo',
								version: '1.0.0',
							},
						},
					},
				},
			);
			assert(actionRequest);

			const dequeued = await ctx.dequeue();
			assert(dequeued);
			expect(dequeued.id).toEqual(actionRequest.id);
			expect(dequeued.data.timestamp).toBe(date.toISOString());
		});

		test('should set a present timestamp', async () => {
			const currentDate = new Date();
			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract.id,
						type: typeContract.type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract.id,
						},
						timestamp: new Date().toISOString(),
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
				},
			);
			assert(actionRequest);

			const dequeued = await ctx.dequeue();
			assert(dequeued);
			expect(dequeued.id).toEqual(actionRequest.id);
			expect(new Date(dequeued.data.timestamp) >= currentDate).toBe(true);
		});

		test('should throw if the type is a slug and was not found', async () => {
			const fakeId = autumndbTestUtils.generateRandomId();
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					id: autumndbTestUtils.generateRandomId(),
					slug: autumndbTestUtils.generateRandomSlug({
						prefix: 'action-request',
					}),
					version: '1.0.0',
					type: 'action-request@1.0.0',
					tags: [],
					markers: [],
					active: true,
					created_at: new Date().toISOString(),
					capabilities: [],
					requires: [],
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: fakeId,
						type: 'type',
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: fakeId,
						},
						timestamp: new Date().toISOString(),
						arguments: {
							reason: null,
							properties: {
								version: '1.0.0',
								slug: 'foo',
								data: {
									foo: 'bar',
								},
							},
						},
					},
				},
			);
			assert(actionRequest);

			await expect(() => {
				return ctx.flush(ctx.session);
			}).rejects.toThrow();
		});

		test('should throw if the action was not found', async () => {
			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					id: autumndbTestUtils.generateRandomId(),
					slug: autumndbTestUtils.generateRandomSlug({
						prefix: 'action-request',
					}),
					version: '1.0.0',
					type: 'action-request@1.0.0',
					tags: [],
					markers: [],
					active: true,
					created_at: new Date().toISOString(),
					capabilities: [],
					requires: [],
					data: {
						action: 'action-foo-bar@1.0.0',
						context: ctx.logContext,
						card: typeContract.id,
						type: typeContract.type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract.id,
						},
						timestamp: new Date().toISOString(),
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
				},
			);
			assert(actionRequest);

			await expect(() => {
				return ctx.flush(ctx.session);
			}).rejects.toThrowError(errors.WorkerInvalidAction);
		});
	});

	describe('.dequeue()', () => {
		test('should return nothing if no requests', async () => {
			const request = await ctx.dequeue();
			expect(request).toBe(null);
		});

		test('should not let the same owner take a request twice', async () => {
			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const actionRequest = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract!.id,
						type: typeContract!.type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract!.id,
						},
						timestamp: new Date().toISOString(),
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
				},
			);
			assert(actionRequest);

			const dequeued1 = await ctx.dequeue();
			assert(dequeued1);
			expect(dequeued1.id).toEqual(actionRequest.id);
			expect(dequeued1.slug).toEqual(actionRequest.slug);

			const dequeued2 = await ctx.dequeue();
			expect(dequeued2).toBe(null);
		});

		test('should cope with link materialization failures', async () => {
			const typeContract = ctx.worker.typeContracts['card@1.0.0'];
			const enqueued = await ctx.worker.insertCard(
				ctx.logContext,
				ctx.session,
				ctx.worker.typeContracts['action-request@1.0.0'],
				{
					attachEvents: false,
					timestamp: new Date().toISOString(),
				},
				{
					type: 'action-request@1.0.0',
					data: {
						action: 'action-create-card@1.0.0',
						context: ctx.logContext,
						card: typeContract!.id,
						type: typeContract!.type,
						actor: ctx.adminUserId,
						epoch: new Date().valueOf(),
						input: {
							id: typeContract!.id,
						},
						timestamp: new Date().toISOString(),
						arguments: {
							properties: {
								slug: 'foo',
								version: '1.0.0',
							},
						},
					},
				},
			);
			assert(enqueued);

			const actionRequest = Kernel.defaults<ActionRequestData>({
				id: enqueued.id,
				slug: enqueued.slug,
				type: enqueued.type,
				data: enqueued.data as ActionRequestData,
			});

			await ctx.worker.consumer.postResults(
				ctx.actor,
				ctx.logContext,
				actionRequest as any,
				{
					error: false,
					data: {
						foo: 'true',
					},
				},
			);

			// Simulate non-materialized links
			await ctx.kernel.replaceContract(
				ctx.logContext,
				ctx.session,
				Object.assign({}, enqueued, {
					links: {},
				}),
			);

			const currentRequest = await ctx.kernel.getContractBySlug(
				ctx.logContext,
				ctx.session,
				`${enqueued.slug}@${enqueued.version}`,
			);
			expect(currentRequest).not.toBe(null);
			expect(currentRequest!.links).toEqual({});
		});
	});
});

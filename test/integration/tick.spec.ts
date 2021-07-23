/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import { strict as assert } from 'assert';
import * as helpers from './helpers';
import { TriggeredActionContract } from '@balena/jellyfish-types/build/worker';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.before();
});

afterAll(() => {
	return helpers.after(ctx);
});

describe('.tick()', () => {
	it('should not enqueue actions if there are no triggers', async () => {
		ctx.worker.setTriggers(ctx.context, []);
		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date(),
		});

		const request = await ctx.dequeue();
		expect(request).toBeFalsy();
	});

	it('should not enqueue actions if there are no time triggers', async () => {
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: 'action-foo-bar@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					filter: {
						type: 'object',
					},
					arguments: {
						foo: 'bar',
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date(),
		});

		const request = await ctx.dequeue();
		expect(request).toBeFalsy();
	});

	it('should not enqueue an action if there is a time trigger with a future start date', async () => {
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: 'action-foo-bar@1.0.0',
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1H',
					startDate: '2018-09-05T12:00:00.000Z',
					arguments: {
						foo: 'bar',
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date('2018-08-05T12:00:00.000Z'),
		});

		const request = await ctx.dequeue();
		expect(request).toBeFalsy();
	});

	it('should evaluate the current timestamp in a time triggered action', async () => {
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(actionCard !== null);

		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: `${actionCard.slug}@${actionCard.version}`,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1D',
					startDate: '2018-08-05T12:00:00.000Z',
					arguments: {
						reason: null,
						properties: {
							slug: 'foo',
							data: {
								timestamp: {
									$eval: 'timestamp',
								},
							},
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date('2018-08-06T12:00:00.000Z'),
		});

		// TS-TODO: Correctly type this
		const request: any = await ctx.dequeue();
		expect(request.data.arguments.properties.data).toEqual({
			timestamp: '2018-08-06T12:00:00.000Z',
		});
	});

	it('should enqueue an action if there is a time trigger with a past start date', async () => {
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(actionCard !== null);

		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: `${actionCard.slug}@${actionCard.version}`,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1D',
					startDate: '2018-08-05T12:00:00.000Z',
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date('2018-08-06T12:00:00.000Z'),
		});

		// TS-TODO: Correctly type this
		const request: any = await ctx.dequeue();
		expect(request).toEqual(
			ctx.jellyfish.defaults({
				id: request.id,
				created_at: request.created_at,
				name: null,
				links: request.links,
				slug: request.slug,
				type: 'action-request@1.0.0',
				data: {
					input: {
						id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					},
					context: ctx.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: ctx.actor.id,
					originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					timestamp: '2018-08-06T12:00:00.000Z',
					epoch: 1533556800000,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
						},
					},
				},
			}),
		);
	});

	it('should enqueue an action if there is a time trigger with a present start date', async () => {
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);
		assert(actionCard !== null);
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: `${actionCard.slug}@${actionCard.version}`,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1D',
					startDate: '2018-08-05T12:00:00.000Z',
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date('2018-08-05T12:00:00.000Z'),
		});

		// TS-TODO: Correctly type this
		const request: any = await ctx.dequeue();
		expect(request).toEqual(
			ctx.jellyfish.defaults({
				id: request.id,
				slug: request.slug,
				name: null,
				links: request.links,
				created_at: request.created_at,
				updated_at: null,
				type: 'action-request@1.0.0',
				data: {
					input: {
						id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					},
					context: ctx.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: ctx.actor.id,
					originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					timestamp: '2018-08-05T12:00:00.000Z',
					epoch: 1533470400000,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
						},
					},
				},
			}),
		);
	});

	it('should not enqueue an action using a past timestamp', async () => {
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);
		assert(actionCard !== null);
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: `${actionCard.slug}@${actionCard.version}`,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1H',
					startDate: '2050-08-05T12:00:00.000Z',
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo',
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date('2050-08-06T12:00:00.000Z'),
		});

		const request = await ctx.dequeue();
		assert(request !== null);
		const requestDate = new Date(request.data.timestamp);
		expect(requestDate.getTime() < Date.now()).toBe(false);
	});

	it('should enqueue two actions if there are two time triggers with a past start dates', async () => {
		const actionCard = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			'action-create-card@latest',
		);

		assert(actionCard !== null);

		const slug1 = ctx.generateRandomSlug();
		const slug2 = ctx.generateRandomSlug();
		ctx.worker.setTriggers(ctx.context, [
			ctx.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				type: 'triggered-action@1.0.0',
				data: {
					action: `${actionCard.slug}@${actionCard.version}`,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT1D',
					startDate: '2018-08-05T12:00:00.000Z',
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: slug1,
						},
					},
				},
			}) as TriggeredActionContract,
			ctx.jellyfish.defaults({
				id: '673bc300-88f7-4376-92ed-d32543d69429',
				slug: 'triggered-action-foo-baz',
				type: 'triggered-action@1.0.0',
				data: {
					action: `${actionCard.slug}@${actionCard.version}`,
					target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					interval: 'PT2D',
					startDate: '2018-08-04T12:00:00.000Z',
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: slug2,
						},
					},
				},
			}) as TriggeredActionContract,
		]);

		await ctx.worker.tick(ctx.context, ctx.session, {
			currentDate: new Date('2018-08-06T12:00:00.000Z'),
		});

		const actionRequests = _.sortBy(
			await ctx.jellyfish.query(ctx.context, ctx.session, {
				type: 'object',
				required: ['type'],
				additionalProperties: true,
				properties: {
					type: {
						type: 'string',
						const: 'action-request@1.0.0',
					},
					data: {
						type: 'object',
						required: ['arguments'],
						properties: {
							arguments: {
								type: 'object',
								required: ['properties'],
								properties: {
									properties: {
										type: 'object',
										required: ['slug'],
										properties: {
											slug: {
												type: 'string',
												enum: [slug1, slug2],
											},
										},
									},
								},
							},
						},
					},
				},
			}),
			'data.originator',
		);

		expect(actionRequests).toEqual([
			ctx.jellyfish.defaults({
				id: actionRequests[0].id,
				slug: actionRequests[0].slug,
				name: null,
				links: actionRequests[0].links,
				created_at: actionRequests[0].created_at,
				type: 'action-request@1.0.0',
				data: {
					input: {
						id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					},
					context: ctx.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: ctx.actor.id,
					originator: '673bc300-88f7-4376-92ed-d32543d69429',
					timestamp: '2018-08-06T12:00:00.000Z',
					epoch: 1533556800000,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: slug2,
						},
					},
				},
			}),
			ctx.jellyfish.defaults({
				id: actionRequests[1].id,
				slug: actionRequests[1].slug,
				name: null,
				links: actionRequests[1].links,
				created_at: actionRequests[1].created_at,
				type: 'action-request@1.0.0',
				data: {
					input: {
						id: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
					},
					context: ctx.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: ctx.actor.id,
					originator: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
					timestamp: '2018-08-06T12:00:00.000Z',
					epoch: 1533556800000,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: slug1,
						},
					},
				},
			}),
		]);
	});
});

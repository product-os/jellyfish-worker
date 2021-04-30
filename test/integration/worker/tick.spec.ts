/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import * as helpers from './helpers';

let context: any;

beforeAll(async () => {
	context = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(context);
});

describe('.tick()', () => {
	it('should not enqueue actions if there are no triggers', async () => {
		context.worker.setTriggers(context.context, []);
		await context.worker.tick(context.context, context.session, {
			currentDate: new Date(),
		});

		const request = await context.dequeue();
		expect(request).toBeFalsy();
	});

	it('should not enqueue actions if there are no time triggers', async () => {
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				filter: {
					type: 'object',
				},
				arguments: {
					foo: 'bar',
				},
			},
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date(),
		});

		const request = await context.dequeue();
		expect(request).toBeFalsy();
	});

	it('should not enqueue an action if there is a time trigger with a future start date', async () => {
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: 'action-foo-bar@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				interval: 'PT1H',
				startDate: '2018-09-05T12:00:00.000Z',
				arguments: {
					foo: 'bar',
				},
			},
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date('2018-08-05T12:00:00.000Z'),
		});

		const request = await context.dequeue();
		expect(request).toBeFalsy();
	});

	it('should evaluate the current timestamp in a time triggered action', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: `${actionCard.slug}@${actionCard.version}`,
				type: 'card@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				context: context.context,
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
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date('2018-08-06T12:00:00.000Z'),
		});

		const request = await context.dequeue();
		expect(request.data.arguments.properties.data).toEqual({
			timestamp: '2018-08-06T12:00:00.000Z',
		});
	});

	it('should enqueue an action if there is a time trigger with a past start date', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: `${actionCard.slug}@${actionCard.version}`,
				type: 'card@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				context: context.context,
				interval: 'PT1D',
				startDate: '2018-08-05T12:00:00.000Z',
				arguments: {
					properties: {
						version: '1.0.0',
						slug: 'foo',
					},
				},
			},
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date('2018-08-06T12:00:00.000Z'),
		});

		const request = await context.dequeue();
		expect(request).toEqual(
			context.jellyfish.defaults({
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
					context: context.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: context.actor.id,
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
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: `${actionCard.slug}@${actionCard.version}`,
				type: 'card@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				context: context.context,
				interval: 'PT1D',
				startDate: '2018-08-05T12:00:00.000Z',
				arguments: {
					properties: {
						version: '1.0.0',
						slug: 'foo',
					},
				},
			},
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date('2018-08-05T12:00:00.000Z'),
		});

		const request = await context.dequeue();
		expect(request).toEqual(
			context.jellyfish.defaults({
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
					context: context.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: context.actor.id,
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
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		context.worker.setTriggers(context.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: `${actionCard.slug}@${actionCard.version}`,
				type: 'card@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				context: context.context,
				interval: 'PT1H',
				startDate: '2050-08-05T12:00:00.000Z',
				arguments: {
					properties: {
						version: '1.0.0',
						slug: 'foo',
					},
				},
			},
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date('2050-08-06T12:00:00.000Z'),
		});

		const request = await context.dequeue();
		const requestDate = new Date(request.data.timestamp);
		expect(requestDate.getTime() < Date.now()).toBe(false);
	});

	it('should enqueue two actions if there are two time triggers with a past start dates', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);

		const slug1 = context.generateRandomSlug();
		const slug2 = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
			context.jellyfish.defaults({
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				action: `${actionCard.slug}@${actionCard.version}`,
				type: 'card@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				context: context.context,
				interval: 'PT1D',
				startDate: '2018-08-05T12:00:00.000Z',
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: slug1,
					},
				},
			}),
			context.jellyfish.defaults({
				id: '673bc300-88f7-4376-92ed-d32543d69429',
				slug: 'triggered-action-foo-baz',
				action: `${actionCard.slug}@${actionCard.version}`,
				type: 'card@1.0.0',
				target: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				context: context.context,
				interval: 'PT2D',
				startDate: '2018-08-04T12:00:00.000Z',
				arguments: {
					reason: null,
					properties: {
						version: '1.0.0',
						slug: slug2,
					},
				},
			}),
		]);

		await context.worker.tick(context.context, context.session, {
			currentDate: new Date('2018-08-06T12:00:00.000Z'),
		});

		const actionRequests = _.sortBy(
			await context.jellyfish.query(context.context, context.session, {
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
			context.jellyfish.defaults({
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
					context: context.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: context.actor.id,
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
			context.jellyfish.defaults({
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
					context: context.context,
					action: `${actionCard.slug}@${actionCard.version}`,
					actor: context.actor.id,
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

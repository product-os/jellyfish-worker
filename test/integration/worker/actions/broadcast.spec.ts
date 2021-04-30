/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import { strict as assert } from 'assert';
import * as helpers from '../helpers';

let context: helpers.IntegrationTestContext;

beforeAll(async () => {
	context = await helpers.worker.before();
});

afterAll(() => {
	return helpers.worker.after(context);
});

describe('action-broadcast', () => {
	it('should post a broadcast message to an empty thread', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		assert.ok(threadWithLinks);
		assert.ok(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];

		assert.ok(result.data);

		expect(
			_.map(timeline, (card) => {
				return _.pick(card, ['type', 'slug', 'data']);
			}),
		).toEqual([
			{
				type: 'message@1.0.0',
				slug: (result.data as any).slug,
				data: {
					actor: timeline[0].data.actor,
					timestamp: timeline[0].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
		]);
	});

	it('should post a broadcast message to a non empty thread', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Foo',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const request = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result: any = await context.queue.producer.waitResults(
			context.context,
			request,
		);
		expect(result.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		assert.ok(threadWithLinks);
		assert.ok(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = _.map(
			_.sortBy(timeline, 'data.timestamp'),
			(card) => {
				return _.pick(card, ['type', 'slug', 'data']);
			},
		);

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: sortedTimeline[0].slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Foo',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: result.data.slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
		]);
	});

	it('should not broadcast the same message twice', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const request1 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result1: any = await context.queue.producer.waitResults(
			context.context,
			request1,
		);
		expect(result1.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Foo',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const request2 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result2 = await context.queue.producer.waitResults(
			context.context,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		assert.ok(threadWithLinks);
		assert.ok(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = _.map(
			_.sortBy(timeline, 'data.timestamp'),
			(card) => {
				return _.pick(card, ['type', 'slug', 'data']);
			},
		);

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: result1.data.slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: sortedTimeline[1].slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Foo',
					},
				},
			},
		]);
	});

	it('should broadcast different messages', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const request1 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test 1',
				},
			},
		);

		await context.flush(context.session);
		const result1: any = await context.queue.producer.waitResults(
			context.context,
			request1,
		);
		expect(result1.error).toBe(false);

		const messageRequest = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Foo',
					},
				},
			},
		);

		await context.flush(context.session);
		const messageResult = await context.queue.producer.waitResults(
			context.context,
			messageRequest,
		);
		expect(messageResult.error).toBe(false);

		const request2 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test 2',
				},
			},
		);

		await context.flush(context.session);
		const result2: any = await context.queue.producer.waitResults(
			context.context,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		assert.ok(threadWithLinks);
		assert.ok(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = _.map(
			_.sortBy(timeline, 'data.timestamp'),
			(card) => {
				return _.pick(card, ['type', 'slug', 'data']);
			},
		);

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: result1.data.slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test 1',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: sortedTimeline[1].slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Foo',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: result2.data.slug,
				data: {
					actor: sortedTimeline[2].data.actor,
					timestamp: sortedTimeline[2].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test 2',
					},
				},
			},
		]);
	});

	it('should broadcast the same message twice given different actors', async () => {
		const thread = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug(),
				data: {},
			},
		);

		const rogueUser = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'user@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'user',
				}),
				data: {
					email: 'accounts+jellyfish@resin.io',
					hash: 'PASSWORDLESS',
					roles: ['user-community'],
				},
			},
		);

		const rogueSession = await context.jellyfish.insertCard(
			context.context,
			context.session,
			{
				type: 'session@1.0.0',
				version: '1.0.0',
				slug: context.generateRandomSlug({
					prefix: 'session',
				}),
				data: {
					actor: rogueUser.id,
				},
			},
		);

		const request1 = await context.queue.producer.enqueue(
			context.worker.getId(),
			rogueSession.id,
			{
				action: 'action-create-event@1.0.0',
				context: context.context,
				card: thread.id,
				type: thread.type,
				arguments: {
					type: 'message',
					payload: {
						message: 'Broadcast test',
					},
				},
			},
		);

		await context.flush(context.session);
		const result1: any = await context.queue.producer.waitResults(
			context.context,
			request1,
		);
		expect(result1.error).toBe(false);

		const request2 = await context.queue.producer.enqueue(
			context.worker.getId(),
			context.session,
			{
				action: 'action-broadcast@1.0.0',
				card: thread.id,
				type: thread.type,
				context: context.context,
				arguments: {
					message: 'Broadcast test',
				},
			},
		);

		await context.flush(context.session);
		const result2: any = await context.queue.producer.waitResults(
			context.context,
			request2,
		);
		expect(result2.error).toBe(false);

		const [threadWithLinks] = await context.jellyfish.query(
			context.context,
			context.session,
			{
				type: 'object',
				$$links: {
					'has attached element': {
						type: 'object',
						additionalProperties: true,
					},
				},
				required: ['id', 'type'],
				additionalProperties: true,
				properties: {
					id: {
						type: 'string',
						const: thread.id,
					},
					type: {
						type: 'string',
						const: thread.type,
					},
					links: {
						type: 'object',
					},
				},
			},
		);

		assert.ok(threadWithLinks);
		assert.ok(threadWithLinks.links);

		const timeline = threadWithLinks.links['has attached element'];

		const sortedTimeline = _.map(
			_.sortBy(timeline, 'data.timestamp'),
			(card) => {
				return _.pick(card, ['type', 'slug', 'data']);
			},
		);

		expect(sortedTimeline).toEqual([
			{
				type: 'message@1.0.0',
				slug: result1.data.slug,
				data: {
					actor: sortedTimeline[0].data.actor,
					timestamp: sortedTimeline[0].data.timestamp,
					target: thread.id,
					payload: {
						message: 'Broadcast test',
					},
				},
			},
			{
				type: 'message@1.0.0',
				slug: result2.data.slug,
				data: {
					actor: sortedTimeline[1].data.actor,
					timestamp: sortedTimeline[1].data.timestamp,
					target: thread.id,
					payload: {
						alertsUser: [],
						mentionsUser: [],
						alertsGroup: [],
						mentionsGroup: [],
						message: 'Broadcast test',
					},
				},
			},
		]);
	});
});

/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import * as helpers from './helpers';
import Bluebird from 'bluebird';
import { errors, executor } from '../../lib';

let context: any;

// TODO: test this functionality at the worker interface level.
// Testing at this lower level runs the risk of obscuring bugs
beforeAll(async () => {
	context = await helpers.before();

	context.triggers = [];
	context.executeAction = _.noop;

	context.actionContext = context.worker.getActionContext();

	context.waitForMatch = async (waitQuery: any, times = 20) => {
		if (times === 0) {
			throw new Error('The wait query did not resolve');
		}
		const results = await context.jellyfish.query(
			context.context,
			context.session,
			waitQuery,
		);
		if (results.length > 0) {
			return results[0];
		}
		await Bluebird.delay(500);
		return context.waitForMatch(waitQuery, times - 1);
	};
});

afterAll(() => {
	return helpers.after(context);
});

describe('.run()', () => {
	test('should create a card', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const slug = context.generateRandomSlug();
		const result = await executor.run(
			context.jellyfish,
			context.session,
			context.actionContext,
			{
				'action-create-card': context.actionLibrary['action-create-card'],
			},
			{
				actor: context.actor.id,
				context: context.context,
				action: actionCard,
				timestamp: '2018-07-04T00:22:52.247Z',
				card: typeCard.id,
				type: typeCard.type,
				arguments: {
					reason: null,
					properties: {
						slug,
						version: '1.0.0',
					},
				},
			},
		);

		expect(result).toEqual({
			id: result.id,
			type: 'card@1.0.0',
			version: '1.0.0',
			slug,
		});
	});

	test('should throw if the input card does not exist', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: 'foobarbaz@9.9.9',
					type: 'card@1.0.0',
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerNoElement);
	});

	test('should throw if the actor does not exist', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: typeCard.id,
					type: typeCard.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerNoElement);
	});

	test('should throw if input card does not match the action filter', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: actionCard.id,
					type: actionCard.type,
					arguments: {
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerSchemaMismatch);
	});

	test('should throw if the arguments do not match the action', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{
					'action-create-card': context.actionLibrary['action-create-card'],
				},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: typeCard.id,
					type: typeCard.type,
					arguments: {
						foo: 'bar',
						bar: 'baz',
					},
				},
			),
		).rejects.toThrow(errors.WorkerSchemaMismatch);
	});

	test('should throw if the action has no corresponding implementation', async () => {
		const actionCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'action-create-card@latest',
		);
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		await expect(
			executor.run(
				context.jellyfish,
				context.session,
				context.actionContext,
				{},
				{
					actor: context.actor.id,
					action: actionCard,
					context: context.context,
					timestamp: '2018-07-04T00:22:52.247Z',
					card: typeCard.id,
					type: typeCard.type,
					arguments: {
						reason: null,
						properties: {
							version: '1.0.0',
							slug: 'foo-bar-baz',
						},
					},
				},
			),
		).rejects.toThrow(errors.WorkerInvalidAction);
	});
});

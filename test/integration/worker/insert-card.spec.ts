/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from './helpers';
import { strict as assert } from 'assert';
import { TypeContract } from '@balena/jellyfish-types/build/core';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.worker.before(ctx);
});

afterAll(() => {
	return helpers.worker.after(ctx);
});

describe('.insertCard()', () => {
	test('should pass a triggered action originator', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.setTriggers(ctx.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				schedule: 'sync',
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: command,
								},
							},
						},
					},
				},
				action: 'action-test-originator@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: command,
						version: '1.0.0',
					},
				},
			},
		]);

		await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				attachEvents: true,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@1.0.0`,
		);

		assert(card !== null);
		expect(card.data.originator).toBe('cb3523c5-b37d-41c8-ae32-9e7cc9309165');
	});

	test('should take an originator option', async () => {
		const typeCard = await ctx.jellyfish.getCardBySlug<TypeContract>(
			ctx.context,
			ctx.session,
			'card@latest',
		);

		assert(typeCard !== null);

		const command = ctx.generateRandomSlug();
		ctx.worker.setTriggers(ctx.context, [
			{
				id: 'cb3523c5-b37d-41c8-ae32-9e7cc9309165',
				slug: 'triggered-action-foo-bar',
				schedule: 'sync',
				filter: {
					type: 'object',
					required: ['data'],
					properties: {
						data: {
							type: 'object',
							required: ['command'],
							properties: {
								command: {
									type: 'string',
									const: command,
								},
							},
						},
					},
				},
				action: 'action-test-originator@1.0.0',
				target: typeCard.id,
				arguments: {
					properties: {
						slug: command,
					},
				},
			},
		]);

		await ctx.worker.insertCard(
			ctx.context,
			ctx.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: ctx.actor.id,
				originator: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				attachEvents: true,
				reason: null,
			},
			{
				slug: ctx.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const card = await ctx.jellyfish.getCardBySlug(
			ctx.context,
			ctx.session,
			`${command}@latest`,
		);
		assert(card !== null);
		expect(card.data.originator).toBe('4a962ad9-20b5-4dd8-a707-bf819593cc84');
	});
});

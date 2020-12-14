/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as helpers from './helpers';

let context: any;

beforeAll(async () => {
	try {
		context = await helpers.worker.before(context);
	} catch (error) {
		console.error(error);
	}
});

afterAll(async () => {
	helpers.worker.after(context);
});

describe('.insertCard()', () => {
	test.only('should pass a triggered action originator', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
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

		await context.worker.insertCard(
			context.context,
			context.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: context.actor.id,
				attachEvents: true,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@1.0.0`,
		);
		expect(card.data.originator).toBe('cb3523c5-b37d-41c8-ae32-9e7cc9309165');
	});

	test('should take an originator option', async () => {
		const typeCard = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			'card@latest',
		);

		const command = context.generateRandomSlug();
		context.worker.setTriggers(context.context, [
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

		await context.worker.insertCard(
			context.context,
			context.session,
			typeCard,
			{
				timestamp: new Date().toISOString(),
				actor: context.actor.id,
				originator: '4a962ad9-20b5-4dd8-a707-bf819593cc84',
				attachEvents: true,
			},
			{
				slug: context.generateRandomSlug(),
				version: '1.0.0',
				data: {
					command,
				},
			},
		);

		const card = await context.jellyfish.getCardBySlug(
			context.context,
			context.session,
			`${command}@latest`,
		);
		expect(card.data.originator).toBe('4a962ad9-20b5-4dd8-a707-bf819593cc84');
	});
});

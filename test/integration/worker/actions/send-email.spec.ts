/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import * as _ from 'lodash';
import * as nock from 'nock';
import * as helpers from '../helpers';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';

let ctx: helpers.IntegrationTestContext;

beforeAll(async () => {
	ctx = await helpers.worker.before();
});

afterAll(async () => {
	await helpers.worker.after(ctx);
	nock.cleanAll();
});

const MAIL_OPTIONS: any = environment.mail.options;

const jestTest = _.some(_.values(MAIL_OPTIONS), _.isEmpty) ? it.skip : it;

const checkForKeyValue = (key, value, text) => {
	const pattern = new RegExp(`name="${key}"\\s*${value}`, 'm');
	const regex = text.search(pattern);
	return regex !== -1;
};

describe('action-send-email', () => {
	it('should send an email', async () => {
		let actualBody;

		nock(`${MAIL_OPTIONS.baseUrl}/${MAIL_OPTIONS.domain}`)
			.post('/messages', (body) => {
				actualBody = body;
				return body;
			})
			.basicAuth({
				user: 'api',
				pass: MAIL_OPTIONS.token,
			})
			.reply(200);

		const requestPasswordResetCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: 'password-reset-1',
				data: {},
			},
		);

		const toAddress = 'to@address.com';
		const fromAddress = 'from@address.com';
		const subject = 'fake subject';
		const html = 'fake body';

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-send-email@1.0.0',
				context: ctx.context,
				card: requestPasswordResetCard.id,
				type: requestPasswordResetCard.type,
				arguments: {
					toAddress,
					fromAddress,
					subject,
					html,
				},
			},
		);

		await ctx.flush(ctx.session);

		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(result.error).toBe(false);
		const fromIsInBody = checkForKeyValue('from', fromAddress, actualBody);
		const toIsInBody = checkForKeyValue('to', toAddress, actualBody);
		const subjectIsInBody = checkForKeyValue('subject', subject, actualBody);
		const textIsInBody = checkForKeyValue('html', html, actualBody);

		expect(fromIsInBody).toBe(true);
		expect(toIsInBody).toBe(true);
		expect(subjectIsInBody).toBe(true);
		expect(textIsInBody).toBe(true);
	});

	jestTest('should send an email', async () => {
		const requestPasswordResetCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: 'password-reset-1',
				data: {},
			},
		);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-send-email@1.0.0',
				context: ctx.context,
				card: requestPasswordResetCard.id,
				type: requestPasswordResetCard.type,
				arguments: {
					toAddress: 'test1@balenateam.m8r.co',
					fromAddress: 'hello@balena.io',
					subject: 'sending real email',
					html: 'with real text in the body',
				},
			},
		);

		await ctx.flush(ctx.session);

		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(JSON.parse((result as any).data).message).toBe('Queued. Thank you.');
	});

	jestTest('should throw an error when the email is invalid', async () => {
		const requestPasswordResetCard = await ctx.jellyfish.insertCard(
			ctx.context,
			ctx.session,
			{
				type: 'card@1.0.0',
				version: '1.0.0',
				slug: 'password-reset-1',
				data: {},
			},
		);

		const request = await ctx.queue.producer.enqueue(
			ctx.worker.getId(),
			ctx.session,
			{
				action: 'action-send-email@1.0.0',
				context: ctx.context,
				card: requestPasswordResetCard.id,
				type: requestPasswordResetCard.type,
				arguments: {
					toAddress: 'test@test',
					fromAddress: 'hello@balena.io',
					subject: 'sending real email',
					html: 'with real text in the body',
				},
			},
		);

		await expect(ctx.flush(ctx.session)).rejects.toThrow();
		const result = await ctx.queue.producer.waitResults(ctx.context, request);

		expect(result.error).toBe(true);
		expect((result.data as any).name).toBe('StatusCodeError');
	});
});

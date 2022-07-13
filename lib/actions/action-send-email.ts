import { defaultEnvironment } from '@balena/jellyfish-environment';
import { MailOptions } from '@balena/jellyfish-environment';
import axios from 'axios';
import FormData from 'form-data';
import type { ActionDefinition } from '../';

interface SendEmailOptions {
	toAddress: string;
	fromAddress: string;
	subject: string;
	html: string;
}

class Mailgun {
	public options: MailOptions;
	public domain: string;
	public requestDomain: string;
	public auth: {
		user: string;
		pass: string;
	};

	constructor(options: MailOptions) {
		this.options = options;
		this.domain = options.domain;
		this.requestDomain = `${this.options.baseUrl}/${this.domain}`;
		this.auth = {
			user: 'api',
			pass: this.options.token,
		};
	}

	/**
	 * @summary Send email using Mailgun api
	 * @function
	 *
	 * @param options - send email options
	 * @returns API request result
	 *
	 * @example
	 * ```typescript
	 * const result = await sendEmail({
	 *   toAddress: 'user@domain.com',
	 *   fromAddress: 'us@domain.com',
	 *   subject: 'Hello',
	 *   html: '<b>Hello</b>',
	 * });
	 * ```
	 */
	public async sendEmail(options: SendEmailOptions): Promise<any> {
		const from = options.fromAddress
			? options.fromAddress
			: `Jel.ly.fish <no-reply@${this.domain}>`;

		const form = new FormData();
		form.append('from', from);
		form.append('to', options.toAddress);
		form.append('subject', options.subject);
		form.append('html', options.html);

		return await axios.post(`${this.requestDomain}/messages`, form, {
			auth: {
				username: this.auth.user,
				password: this.auth.pass,
			},
			headers: form.getHeaders(),
		});
	}
}

const handler: ActionDefinition['handler'] = async (
	_session,
	_context,
	_card,
	request,
) => {
	const { fromAddress, toAddress, subject, html } = request.arguments;

	if (
		defaultEnvironment.mail.type === 'mailgun' &&
		defaultEnvironment.mail.options
	) {
		const client = new Mailgun(defaultEnvironment.mail.options);
		await client.sendEmail({
			toAddress,
			fromAddress,
			subject,
			html,
		});
		return null;
	} else {
		throw new Error('Mail integration not found');
	}
};

export const actionSendEmail: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-send-email',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Send email',
		data: {
			arguments: {
				toAddress: {
					type: 'string',
					format: 'email',
				},
				fromAddress: {
					type: 'string',
					format: 'email',
				},
				subject: {
					type: 'string',
				},
				html: {
					type: 'string',
				},
			},
		},
	},
};

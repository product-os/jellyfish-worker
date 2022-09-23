import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { AutumnDBSession, JsonSchema, Kernel } from 'autumndb';
import type { PostResults } from './consumer';
import type { ActionRequestContract } from '../types';

const logger = getLogger(__filename);

/**
 * @summary Mark action-request contract as executed
 * @function
 * @public
 *
 * @param logContext - log context
 * @param kernel - kernel instance
 * @param session - session id
 * @param slug - action-request contract versioned slug
 * @param results - execution results
 * @returns updated action-request contract
 *
 * @example
 * await events.post(logContext, kernel, session, 'action-request-414f2345-4f5e-4571-820f-28a49731733d@1.0.0', {
 *   data: {
 *     ...
 *   },
 *   error: false,
 * });
 */
export const post = async (
	logContext: LogContext,
	kernel: Kernel,
	session: AutumnDBSession,
	slug: string,
	results: PostResults,
): Promise<ActionRequestContract> => {
	return kernel.patchContractBySlug(logContext, session, slug, [
		{
			op: 'replace',
			path: '/data/executed',
			value: true,
		},
		{
			op: 'replace',
			path: '/data/results',
			value: {
				error: results.error,
				data: results.data,
			},
		},
	]);
};

export interface WaitOptions {
	id: string;
	actor: string;
	action?: string;
	card?: string;
}

/**
 * @summary Wait for an execution request event
 * @function
 * @public
 *
 * @param logContext - log context
 * @param kernel - kernel instance
 * @param session - session id
 * @param actionRequestId - action-request id
 * @returns executed action-request contract
 *
 * @example
 * await wait(logContext, kernel, session, '4a962ad9-20b5-4dd8-a707-bf819593cc84');
 */
export const wait = async (
	logContext: LogContext,
	kernel: Kernel,
	session: AutumnDBSession,
	actionRequestId: string,
): Promise<ActionRequestContract> => {
	const schema: JsonSchema = {
		type: 'object',
		additionalProperties: true,
		required: ['id', 'active', 'type', 'data'],
		properties: {
			id: {
				const: actionRequestId,
			},
			active: {
				const: true,
			},
			type: {
				const: 'action-request@1.0.0',
			},
			data: {
				type: 'object',
				additionalProperties: true,
				required: ['executed'],
				properties: {
					executed: {
						const: true,
					},
				},
			},
		},
	};

	let result: ActionRequestContract;

	const stream = await kernel.stream(logContext, session, schema);
	logger.info(logContext, 'Wait stream opened', {
		id: actionRequestId,
	});

	stream.once('data', (change) => {
		result = change.after;

		logger.info(logContext, 'Found results using stream', {
			slug: result?.slug,
			data: Object.keys(result?.data || {}),
		});

		stream.close();
	});

	return new Promise((resolve, reject) => {
		stream.once('error', (error) => {
			stream.removeAllListeners();
			logger.exception(logContext, 'Wait stream error', error);
			reject(error);
		});

		stream.once('closed', () => {
			stream.removeAllListeners();
			logger.info(logContext, 'Closing wait stream', {
				id: actionRequestId,
			});

			resolve(result);
		});

		kernel
			.query(logContext, session, schema, {
				limit: 1,
			})
			.then((contracts) => {
				if (!contracts[0]) {
					// Don't close stream here, attempt to wait for match
					return;
				}

				logger.info(logContext, 'Found results on query', {
					id: contracts[0].id,
					data: Object.keys(contracts[0].data),
				});

				result ??= contracts[0] as ActionRequestContract;
				stream.close();
			})
			.catch((error) => {
				stream.removeAllListeners();
				reject(error);
			});
	});
};

import { RetriesExhaustedError } from '../errors';
import { Contract } from 'autumndb';
import { SyncActionContext } from './sync-context';

/**
 * Execute `fn`, retrying it if a QueryTimeout error occurs
 * `fn` must be idempotent
 *
 * @param context any
 * @param fn
 * @param retries max retries
 * @returns
 */
async function handleQueryTimeout(
	context: SyncActionContext,
	fn: any,
	retries = 100,
	delay = 2000,
): Promise<any> {
	try {
		return await fn();
	} catch (error: any) {
		if (isRetryAllowed(error)) {
			if (retries > 0) {
				context.log.warn(
					`handleQueryTimeout retrying because ${error.message} in ${delay}ms. Retries remaining: ${retries}`,
					{},
				);

				await new Promise((resolve) => {
					setTimeout(resolve, delay);
				});
				return await handleQueryTimeout(context, fn, retries - 1, delay);
			} else {
				const msg = `handleQueryTimeout retries exhausted! error message ${error.message}`;
				context.log.error(msg, {
					error,
				});
				throw new RetriesExhaustedError(error);
			}
		}
		throw error;
	}
}

function isRetryAllowed(error: Error): boolean {
	return (
		(error.name === 'Error' && error.message === 'Query read timeout') ||
		error.name === 'JellyfishDatabaseTimeoutError'
	);
}

const DEFAULT_OPTIONS = {
	retries: 5,
	delay: 2000,
};

/**
 * Wraps a worker context, making some operations retry if there's a retryable error
 * @param context
 * @param options
 * @returns
 */
export function retryableContext(
	context: SyncActionContext,
	options: { retries: number; delay: number } = DEFAULT_OPTIONS,
) {
	return {
		...context,
		getContactByEmail: (email: string): Promise<Contract | null> => {
			return handleQueryTimeout(
				context,
				async () => context.getContactByEmail(email),
				options.retries,
				options.delay,
			);
		},
		getElementBySlug: async (slug: string, usePrivilegedSession = false) => {
			return handleQueryTimeout(
				context,
				async () => context.getElementBySlug(slug, usePrivilegedSession),
				options.retries,
				options.delay,
			);
		},
		getElementById: async (id: string) => {
			return handleQueryTimeout(
				context,
				async () => context.getElementById(id),
				options.retries,
				options.delay,
			);
		},
		getOauthProviderByIntegration: async (integration: string) => {
			return handleQueryTimeout(
				context,
				async () => context.getOauthProviderByIntegration(integration),
				options.retries,
				options.delay,
			);
		},
		getElementByMirrorId: async (
			type: string,
			mirrorId: string,
			getOptions: { usePattern?: boolean } = {},
		) => {
			return handleQueryTimeout(
				context,
				async () => context.getElementByMirrorId(type, mirrorId, getOptions),
				options.retries,
				options.delay,
			);
		},
		getElementByMirrorIds: async (type: string, mirrorIds: string[]) => {
			return handleQueryTimeout(
				context,
				async () => context.getElementByMirrorIds(type, mirrorIds),
				options.retries,
				options.delay,
			);
		},
	};
}

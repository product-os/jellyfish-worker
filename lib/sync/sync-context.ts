import * as assert from '@balena/jellyfish-assert';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type {
	Contract,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import { Kernel } from 'autumndb';
import jsonpatch, { Operation } from 'fast-json-patch';
import _ from 'lodash';
import * as workerErrors from '../errors';
import type { WorkerContext } from '../types';

const logger = getLogger(__filename);

/*
 * Deal with some username differences that we can't
 * fix in any other way.
 */
interface ActorTranslatorMap {
	local: string;
	remote: string;
}

const ACTOR_TRANSLATORS: { [key: string]: ActorTranslatorMap[] } = {
	discourse: [
		{
			local: 'page-',
			remote: '_page',
		},
	],
};

export type SyncActionContext = ReturnType<typeof getActionContext>;

/**
 * @name getActionContext
 * @description This function generates a "context" object that provides a common interface for use by sync integrations.
 *
 * @param provider - the name of the integration e.g. 'github', 'discourse'
 * @param workerContext - context object provided to action functions by the jellyfish worker
 * @param logContext - log context
 * @param session - session token used to interact with Jellyfish
 *
 * @returns action context
 *
 * @example
 *
 * const handler = async (session, logContext, contract, request) => {
 * 	const syncContext = context.sync.getActionContext(request.arguments.provider,
 * 			context, request.context, context.privilegedSession)
 * 	)
 * 	.....
 * }
 */
export const getActionContext = (
	provider: string,
	workerContext: WorkerContext,
	logContext: LogContext,
	session: string,
) => {
	const getDefaultActor = async (): Promise<null | string> => {
		const sessionContract = await workerContext.getCardById(session, session);

		if (!sessionContract) {
			return null;
		}

		// TODO: Replace this return type with the session contract interface
		return sessionContract.data.actor as string;
	};

	const contextObject = {
		log: {
			warn: (message: string, data: any) => {
				logger.warn(logContext, message, data);
			},
			error: (message: string, data: any) => {
				logger.error(logContext, message, data);
			},
			debug: (message: string, data: any) => {
				logger.debug(logContext, message, data);
			},
			info: (message: string, data: any) => {
				logger.info(logContext, message, data);
			},

			// "exception" will log to sentry if it's enabled
			exception: (message: string, error: any) => {
				logger.exception(logContext, message, error);
			},
		},
		getLocalUsername: (username: string): string => {
			const map = _.find(ACTOR_TRANSLATORS[provider] || [], {
				remote: username,
			});

			return map ? map.local : username;
		},
		getRemoteUsername: (username: string): string => {
			const map = _.find(ACTOR_TRANSLATORS[provider] || [], {
				local: username,
			});

			return map ? map.remote : username;
		},

		// The upsertElement function has the property of being eventually
		// consistent, sanely handling two seperate sync events on a new
		// object with the same slug. If an ID is provided we don't need to do any
		// checking though, as the object already exists and it can be patched
		// immediately.
		// Object can either be a partial contract object or an object with keys
		// "id" and "patch", where id is the id of the target contract and patch is
		// a jsonpatch
		upsertElement: async (
			type: string,
			object:
				| Partial<Contract>
				| { id: string; type: string; patch: Operation[] },
			options: { actor?: string; timestamp?: Date; originator?: string },
		): Promise<Contract | null> => {
			const typeContract = await workerContext.getCardBySlug(session, type);

			assert.INTERNAL(
				logContext,
				typeContract !== null,
				workerErrors.WorkerNoElement,
				`No such type: ${type}`,
			);

			const actor = options.actor || (await getDefaultActor());
			strict(actor);

			// If an ID was passed in, use that ID to load the current contract, this
			// prevents the situation where an integration may unintentionally
			// generate a new slug for an existing contract.

			// TS-TODO: tidy up this casting as its not quite correct.
			// The main issue here is that "object" is union type and could be a partial contract, or a patch wrapper with a contract ID
			const targetContract = object as Contract;

			const current: Contract | null = targetContract.id
				? await workerContext.getCardById(session, targetContract.id)
				: await workerContext.getCardBySlug(
						session,
						`${targetContract.slug}@${targetContract.version}`,
				  );

			let patch: Operation[] = [];

			if (object.hasOwnProperty('patch')) {
				patch = (object as any).patch;
				if (!current) {
					throw new Error(
						`Can\'t patch a contract that doesn\'t exist: ${object.id}`,
					);
				}
			} else {
				if (current) {
					// TODO: Migrate all integrations to use the JSON patch interface on this function
					// so we don't have to do this diff comparison thing.
					patch = jsonpatch.compare(
						Kernel.defaults(current),
						Kernel.defaults(
							Object.assign({}, object, {
								id: current.id,
								slug: current.slug,
								name:
									typeof (object as any).name === 'string'
										? (object as any).name
										: current.name || null,
								created_at: current.created_at,
								updated_at: current.updated_at,
								linked_at: current.linked_at,
								type: current.type,
							}),
						),
					);
				} else {
					logger.info(
						logContext,
						'Inserting contract from sync context',
						object,
					);
					return workerContext
						.insertCard(
							session,
							typeContract! as TypeContract,
							{
								attachEvents: true,
								timestamp: options.timestamp,
								actor,
								originator: options.originator,
							},
							targetContract,
						)
						.catch((error: { name: string }) => {
							// Retry, and next time we will automatically go
							// to through patch approach
							if (error.name === 'JellyfishElementAlreadyExists') {
								return contextObject.upsertElement(type, object, options);
							}

							throw error;
						});
				}
			}

			logger.info(logContext, 'Patching contract from sync context', {
				patch,
			});

			// If the only thing being updated is the origin, skip the update as
			// it is a meaningless change.
			// TODO: refactor the "origin" to be a link to the origin instead of hard coded value
			if (
				patch.length === 1 &&
				patch[0].op === 'replace' &&
				patch[0].path === '/data/origin'
			) {
				return current;
			}

			return workerContext.patchCard(
				session,
				typeContract! as TypeContract,
				{
					attachEvents: true,
					timestamp: options.timestamp,
					actor,
					originator: options.originator,
				},
				current,
				patch,
			);
		},
		getElementBySlug: async (slug: string, usePrivilegedSession = false) => {
			return workerContext.getCardBySlug(
				usePrivilegedSession ? workerContext.privilegedSession : session,
				slug,
			);
		},
		getElementById: async (id: string) => {
			return workerContext.getCardById(session, id);
		},
		getElementByMirrorId: async (
			type: string,
			mirrorId: string,
			options: { usePattern?: boolean } = {},
		) => {
			assert.INTERNAL(
				logContext,
				!!mirrorId,
				Error,
				'You must supply a mirrorId as key',
			);

			const elements = await workerContext.query(
				session,
				{
					type: 'object',
					required: ['type', 'data'],
					additionalProperties: true,
					properties: {
						type: {
							type: 'string',
							const: type,
						},
						data: {
							type: 'object',
							required: ['mirrors'],
							additionalProperties: true,
							properties: {
								mirrors: {
									type: 'array',
									contains: options.usePattern
										? {
												type: 'string',
												pattern: mirrorId,
										  }
										: {
												type: 'string',
												const: mirrorId,
										  },
								},
							},
						},
					},
				},
				{
					limit: 1,
				},
			);

			return elements[0];
		},
	};

	return contextObject;
};

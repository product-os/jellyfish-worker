import * as assert from '@balena/jellyfish-assert';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { Jellyscript } from '@balena/jellyfish-jellyscript';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import type { JsonSchema } from '@balena/jellyfish-types';
import type {
	Contract,
	ContractData,
	ContractDefinition,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict } from 'assert';
import { CONTRACTS, Kernel, StreamChange } from 'autumndb';
import Bluebird from 'bluebird';
import { parseExpression } from 'cron-parser';
import * as fastEquals from 'fast-equals';
import type { Operation } from 'fast-json-patch';
import _ from 'lodash';
import type { Pool } from 'pg';
import * as semver from 'semver';
import { serializeError } from 'serialize-error';
import * as skhema from 'skhema';
import { v4 as uuidv4 } from 'uuid';
import { actions } from './actions';
import { contracts } from './contracts';
import * as errors from './errors';
import * as formulas from './formulas';
import { PluginDefinition, PluginManager } from './plugin';
import {
	ActionContract,
	ActionRequestContract,
	Consumer,
	Producer,
	ProducerOptions,
} from './queue';
import type { OnMessageEventHandler } from './queue/consumer';
import * as subscriptionsLib from './subscriptions';
import { Sync } from './sync';
import { evaluate as evaluateTransformers } from './transformers';
import * as triggersLib from './triggers';
import type {
	Action,
	Map,
	ScheduledActionContract,
	ScheduledActionData,
	TransformerContract,
	TriggeredActionContract,
	WorkerContext,
} from './types';
import * as utils from './utils';

export {
	actions,
	triggersLib,
	errors,
	contracts,
	PluginDefinition,
	PluginManager,
	utils,
	Sync,
};
export * as contractMixins from './contracts/mixins';
export {
	errors as syncErrors,
	Integration,
	IntegrationDefinition,
	IntegrationInitializationOptions,
	HttpRequestOptions,
	oauth,
	SequenceItem,
} from './sync';
export {
	ActionContractDefinition,
	ActionDefinition,
	PluginIdentity,
} from './plugin';
export {
	ActionContract,
	ActionData,
	ActionRequestContract,
	ActionRequestData,
	Consumer,
	contracts as queueContracts,
	errors as queueErrors,
	events,
	ExecuteContract,
	ExecuteData,
	Producer,
	ProducerOptions,
	ProducerResults,
} from './queue';
export * as testUtils from './test-utils';
export * from './types';

// TODO: use a single logger instance for the worker
const logger = getLogger('worker');

const formulaParser = new Jellyscript({
	formulas: {
		NEEDS: formulas.NEEDS,
		NEEDS_ALL: formulas.NEEDS_ALL,
	},
});

/**
 * @summary The "type" contract type
 * @private
 */
const CONTRACT_TYPE_TYPE = 'type@1.0.0';

/**
 * @summary Default insert concurrency
 * @private
 */
const INSERT_CONCURRENCY = 3;

/**
 * @summary Query for stream to watch for new triggered action contracts
 * @private
 */
const SCHEMA_ACTIVE_TRIGGERS: JsonSchema = {
	type: 'object',
	required: ['active', 'type', 'data'],
	properties: {
		active: {
			const: true,
		},
		type: {
			const: 'triggered-action@1.0.0',
		},
		data: {
			type: 'object',
			additionalProperties: true,
		},
	},
};

/**
 * @summary Query for stream to watch for new transformer contracts
 * @private
 */
const SCHEMA_ACTIVE_TRANSFORMERS: JsonSchema = {
	type: 'object',
	required: ['active', 'type', 'data', 'version'],
	properties: {
		active: {
			const: true,
		},
		type: {
			const: 'transformer@1.0.0',
		},
		// ignoring draft versions
		version: { not: { pattern: '-' } },
		data: {
			type: 'object',
			required: ['$transformer'],
			properties: {
				$transformer: {
					type: 'object',
					required: ['artifactReady'],
					properties: {
						artifactReady: {
							not: {
								const: false,
							},
						},
					},
				},
			},
		},
	},
};

/**
 * @summary Query for stream to watch for new type contracts
 * @private
 */
const SCHEMA_ACTIVE_TYPE_CONTRACTS: JsonSchema = {
	type: 'object',
	required: ['active', 'type'],
	properties: {
		active: {
			const: true,
		},
		type: {
			const: 'type@1.0.0',
		},
	},
};

/**
 * As it's valid to specify a version without type, this guarantees that we
 * have a fully qualified versioned type.
 *
 * @param {string} type - name of type that may or may not contain a version suffix
 * @returns a type string that contains a version suffix
 */
export const ensureTypeHasVersion = (type: string): string => {
	if (!_.includes(type, '@')) {
		// Types should not default to latest to ensure old "insert" code doesn't break
		return `${type}@1.0.0`;
	}
	const versionPattern = /@(?<major>\d+)(\.(?<minor>\d+))?(\.(?<patch>\d+))?$/;
	if (!versionPattern.test(type)) {
		throw Error(`Contract loader encountered invalid type spec: ${type}`);
	}
	return type;
};

/**
 * @summary Get the request input contract
 * @function
 * @private
 *
 * @param logContext - log context
 * @param kernel - kernel instance
 * @param session - session id
 * @param identifier - id or slug
 * @returns request input contract or null
 *
 * @example
 * const contract = await getInputContract({ ... }, kernel, session, 'foo-bar');
 * if (contract) {
 *   console.log(contract);
 * }
 */
const getInputContract = async (
	logContext: LogContext,
	kernel: Kernel,
	session: string,
	identifier: string,
): Promise<Contract | null> => {
	if (identifier.includes('@')) {
		return kernel.getContractBySlug(logContext, session, identifier);
	}
	return kernel.getContractById(logContext, session, identifier);
};

/**
 * Returns an object that will include all links referenced in evaluated fields
 * in the type contract's schema.
 *
 * If no links are referenced in evaluated fields, the original object is returned
 * immediately.
 *
 * @param logContext - log context
 * @param kernel - kernel instance
 * @param session - session id
 * @param contract - contract to fill with links
 * @param typeContract - type contract
 *
 * @returns the contract with any links referenced in the evaluated fields
 * of it's type contract's schema.
 */
export async function getObjectWithLinks<
	PContract extends Partial<TContract> | TContract,
	TContract extends Contract<TData>,
	TData extends ContractData,
>(
	logContext: LogContext,
	kernel: Kernel,
	session: string,
	contract: PContract,
	typeContract: TypeContract,
): Promise<PContract> {
	const linkVerbs = formulas.getReferencedLinkVerbs(typeContract);
	if (!linkVerbs.length) {
		return contract;
	}
	let queriedContract: TContract | null = null;
	if ((contract.slug && contract.version) || contract.id) {
		const query = utils.getQueryWithOptionalLinks(contract, linkVerbs);
		[queriedContract] = await kernel.query<TContract>(
			logContext,
			session,
			query,
		);
	}
	const contractWithLinks = queriedContract || contract;

	// Optional links may not be populated so explicitly set to an empty array here
	linkVerbs.forEach((linkVerb) => {
		if (!_.has(contractWithLinks, ['links', linkVerb])) {
			_.set(contractWithLinks, ['links', linkVerb], []);
		}
	});

	return contractWithLinks as PContract;
}

/**
 * @summary Get the next execute date-time for a scheduled action
 *
 * @param schedule - schedule configuration
 * @returns next execution date, or null if no future date was found
 */
export function getNextExecutionDate(
	schedule: ScheduledActionData['schedule'],
): Date | null {
	const now = new Date();
	if (schedule.once) {
		const next = new Date(schedule.once.date);
		if (next > now) {
			return schedule.once.date;
		}
	} else if (schedule.recurring) {
		const endDate = new Date(schedule.recurring.end);
		const startDate = new Date(schedule.recurring.start);

		// Ignore anything that will have already ended
		if (endDate > now) {
			try {
				// Handle future start dates
				const options =
					startDate > now
						? {
								currentDate: startDate,
						  }
						: {
								startDate,
						  };

				// Create iterator based on provided configuration
				const iterator = parseExpression(schedule.recurring.interval, {
					endDate,
					...options,
				});

				// Return next execution date if available
				if (iterator.hasNext()) {
					return iterator.next().toDate();
				}
			} catch (error) {
				throw new errors.WorkerInvalidActionRequest(
					`Invalid recurring schedule configuration: ${error}`,
				);
			}
		}
	}

	return null;
}

/**
 * Jellyfish worker library module.
 *
 * @module worker
 */
export class Worker {
	kernel: Kernel;
	pluginManager: PluginManager;
	consumer: Consumer;
	producer: Producer;
	contractsStream: any;
	triggers: TriggeredActionContract[];
	transformers: TransformerContract[];
	latestTransformers: TransformerContract[];
	typeContracts: { [key: string]: TypeContract };
	session: string;
	library: Map<Action>;
	id: string = '0';
	sync: Sync;

	/**
	 * @summary The Jellyfish Actions Worker
	 * @class
	 * @public
	 *
	 * @param kernel - kernel instance
	 * @param session - worker privileged session id
	 * @param pool - postgres pool
	 * @param plugins - list of plugins
	 *
	 * @example
	 * const worker = new Worker({ ... }, '4a962ad9-20b5-4dd8-a707-bf819593cc84', {
	 *     'action-create-card': { ... },
	 *     'action-update-card': { ... },
	 *   },
	 *   pool,
	 *   [foobarPlugin()],
	 * );
	 */
	constructor(
		kernel: Kernel,
		session: string,
		pool: Pool,
		plugins: PluginDefinition[],
	) {
		this.kernel = kernel;
		this.pluginManager = new PluginManager(plugins);
		this.triggers = [];
		this.transformers = [];
		this.latestTransformers = [];
		this.typeContracts = {};
		this.session = session;
		this.library = this.pluginManager.getActions();
		this.consumer = new Consumer(kernel, pool, session);
		this.producer = new Producer(kernel, pool, session);
		this.contractsStream = {};
		this.sync = new Sync({
			integrations: this.pluginManager.getSyncIntegrations(),
		});

		// Add actions defined in this repo
		Object.keys(actions).forEach((name) => {
			this.library[name] = actions[name];
		});
	}

	/**
	 * @summary Get this worker's unique id
	 * @function
	 * @public
	 *
	 * @returns unique worker id
	 *
	 * @example
	 * const worker = new Worker({ ... })
	 * const id = worker.getId()
	 * console.log(id)
	 */
	getId(): string {
		return this.id;
	}

	/**
	 * @summary Initialize the worker
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param onMessageEventHandler - consumer event handler
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * await worker.initialize(logContext, sync, eventHandlerFunction);
	 */
	async initialize(
		logContext: LogContext,
		onMessageEventHandler: OnMessageEventHandler,
	) {
		this.id = uuidv4();

		// Initialize producer and consumer
		await this.producer.initialize(logContext);
		await this.consumer.initializeWithEventHandler(
			logContext,
			onMessageEventHandler,
		);

		// Insert type contracts as prerequisite
		await Promise.all(
			Object.values(contracts).map(async (contract) => {
				if (contract.type.split('@')[0] === 'type') {
					return this.kernel.replaceContract(
						logContext,
						this.session,
						contract,
					);
				}
			}),
		);

		// Insert other worker contracts
		await Promise.all(
			Object.values(contracts).map(async (contract) => {
				const versionedType = ensureTypeHasVersion(contract.type);
				const typeContract = await this.kernel.getContractBySlug<TypeContract>(
					logContext,
					this.session,
					versionedType,
				);
				strict(typeContract);
				return this.replaceCard(
					logContext,
					this.session,
					typeContract,
					{
						attachEvents: false,
					},
					contract,
				);
			}),
		);
		const actionType = await this.kernel.getContractBySlug<TypeContract>(
			logContext,
			this.session,
			'action@latest',
		);
		strict(actionType);
		await Promise.all(
			Object.values(actions).map(async (action) => {
				return this.replaceCard(
					logContext,
					this.session,
					actionType,
					{
						attachEvents: false,
					},
					action.contract,
				);
			}),
		);

		// Get all contracts provided by plugins
		const pluginContracts = this.pluginManager.getCards();

		// Make sure certain contracts are initialized, as they can be prerequisites
		const loopType = await this.kernel.getContractBySlug<TypeContract>(
			logContext,
			this.session,
			'loop@latest',
		);
		strict(loopType);
		await Promise.all(
			Object.values(pluginContracts).map(
				async (contract: ContractDefinition) => {
					if (contract.type.split('@')[0].match(/^(loop|action)$/)) {
						const typeContract =
							contract.type.split('@')[0] === 'loop' ? loopType : actionType;
						return this.replaceCard(
							logContext,
							this.session,
							typeContract,
							{
								attachEvents: false,
							},
							pluginContracts[contract.slug],
						);
					}
				},
			),
		);

		// Only need test user role during development and CI.
		const contractsToSkip: string[] = [];
		if (environment.isProduction() && !environment.isCI()) {
			contractsToSkip.push('user-guest');
			contractsToSkip.push('role-user-test');
		}

		// Insert all other contracts provided by plugins
		const contractLoaders = _.values(this.pluginManager.getCards()).filter(
			(contract: ContractDefinition) => {
				return !contractsToSkip.includes(contract.slug);
			},
		);

		await Bluebird.each(
			contractLoaders,
			async (contract: ContractDefinition) => {
				if (!contract) {
					return;
				}

				// Skip contracts that already exist and do not need updating
				// Need to update omitted list if any similar fields are added to the schema
				contract.name = contract.name ? contract.name : null;
				const currentContract = await this.kernel.getContractBySlug(
					logContext,
					this.session,
					`${contract.slug}@${contract.version}`,
				);
				if (
					currentContract &&
					_.isEqual(
						contract,
						_.omit(currentContract, [
							'id',
							'created_at',
							'updated_at',
							'linked_at',
						]),
					)
				) {
					return;
				}

				const versionedType = ensureTypeHasVersion(contract.type);
				const typeContract = await this.kernel.getContractBySlug<TypeContract>(
					logContext,
					this.session,
					versionedType,
				);

				if (typeContract) {
					logger.info(logContext, 'Inserting default contract', {
						slug: contract.slug,
						type: contract.type,
					});

					await this.replaceCard(
						logContext,
						this.session,
						typeContract,
						{
							attachEvents: false,
						},
						contract,
					);

					logger.info(logContext, 'Inserted default contract using worker', {
						slug: contract.slug,
						type: contract.type,
					});
				} else {
					logger.warn(
						logContext,
						'Failed to insert default contract as type not found',
						{
							slug: contract.slug,
							type: versionedType,
						},
					);
				}
			},
		);

		// For better performance, commonly accessed contracts are stored in cache in the worker.
		// These contracts are streamed from the DB, so the worker always has the most up to date version of them.
		this.contractsStream = await this.kernel.stream(
			logContext,
			this.kernel.adminSession()!,
			{
				anyOf: [
					SCHEMA_ACTIVE_TRIGGERS,
					SCHEMA_ACTIVE_TRANSFORMERS,
					SCHEMA_ACTIVE_TYPE_CONTRACTS,
				],
			},
		);

		this.contractsStream.on('data', (change: StreamChange) => {
			const contract = change.after;
			const contractType = change.contractType.split('@')[0];
			if (
				change.type === 'update' ||
				change.type === 'insert' ||
				change.type === 'unmatch'
			) {
				// If `after` is null, the contract is no longer available: most likely it has
				// been soft-deleted, having its `active` state set to false
				if (!contract) {
					switch (contractType) {
						case 'triggered-action':
							this.removeTrigger(logContext, change.id);
							break;
						case 'transformer':
							this.removeTransformer(logContext, change.id);
							break;
						case 'type':
							const filteredContracts = _.filter(this.typeContracts, (type) => {
								return type.id !== change.id;
							});
							this.setTypeContracts(logContext, filteredContracts);
					}
				} else {
					switch (contractType) {
						case 'triggered-action':
							this.upsertTrigger(logContext, contract);
							break;
						case 'transformer':
							this.upsertTransformer(
								logContext,
								contract as TransformerContract,
							);
						case 'type':
							const filteredContracts = _.filter(this.typeContracts, (type) => {
								return type.id !== change.id;
							});
							filteredContracts.push(contract as TypeContract);
							this.setTypeContracts(logContext, filteredContracts);
					}
				}
			} else if (change.type === 'delete') {
				switch (contractType) {
					case 'triggered-action':
						this.removeTrigger(logContext, change.id);
						break;
					case 'type':
						const filteredContracts = _.filter(this.typeContracts, (type) => {
							return type.id !== change.id;
						});
						this.setTypeContracts(logContext, filteredContracts);
				}
			}
		});

		const [triggers, transformers, types] = await Promise.all(
			[
				SCHEMA_ACTIVE_TRIGGERS,
				SCHEMA_ACTIVE_TRANSFORMERS,
				SCHEMA_ACTIVE_TYPE_CONTRACTS,
			].map((schema) => this.kernel.query(logContext, this.session, schema)),
		);

		logger.info(logContext, 'Loading triggers', {
			triggers: triggers.length,
		});
		this.setTriggers(logContext, triggers as TriggeredActionContract[]);

		logger.info(logContext, 'Loading transformers', {
			transformers: transformers.length,
		});
		this.setTransformers(logContext, transformers as TransformerContract[]);

		logger.info(logContext, 'Loading types', {
			types: types.length,
		});
		this.setTypeContracts(logContext, types as TypeContract[]);
	}

	/**
	 * @summary Get the action context
	 * @function
	 * @private
	 *
	 * @param logContext - log context
	 * @returns action context
	 *
	 * @example
	 * const actionContext = worker.getActionContext({ ... });
	 */
	getActionContext(logContext: LogContext): WorkerContext {
		const self = this;
		return {
			sync: this.sync,
			getEventSlug: utils.getEventSlug,
			getCardById: (lsession: string, id: string) => {
				return self.kernel.getContractById(logContext, lsession, id);
			},
			getCardBySlug: (lsession: string, slug: string) => {
				return self.kernel.getContractBySlug(logContext, lsession, slug);
			},
			query: (
				lsession: string,
				schema: Parameters<Kernel['query']>[2],
				options: Parameters<Kernel['query']>[3],
			) => {
				return self.kernel.query(logContext, lsession, schema, options);
			},
			privilegedSession: this.session,
			insertCard: (
				lsession: string,
				typeCard: Parameters<Worker['insertCard']>[2],
				options: Parameters<Worker['insertCard']>[3],
				card: Parameters<Worker['insertCard']>[4],
			) => {
				return self.insertCard(logContext, lsession, typeCard, options, card);
			},
			replaceCard: (
				lsession: string,
				typeCard: Parameters<Worker['replaceCard']>[2],
				options: Parameters<Worker['replaceCard']>[3],
				card: Parameters<Worker['replaceCard']>[4],
			) => {
				return self.replaceCard(logContext, lsession, typeCard, options, card);
			},
			patchCard: (
				lsession: string,
				typeCard: Parameters<Worker['patchCard']>[2],
				options: Parameters<Worker['patchCard']>[3],
				card: Parameters<Worker['patchCard']>[4],
				patch: Parameters<Worker['patchCard']>[5],
			) => {
				return self.patchCard(
					logContext,
					lsession,
					typeCard,
					options,
					card,
					patch,
				);
			},
			enqueueAction: (...args) => {
				return this.enqueueAction(...args);
			},
			cards: {
				...CONTRACTS,
				...self.getTypeContracts(),
			},
		};
	}

	/**
	 * @summary Enqueus an action request
	 * @function
	 * @public
	 *
	 * @param session - The session with which to enqueue the action
	 * @param actionRequest - request values to be enqueued
	 *
	 * @returns the stored action request contract
	 */
	async enqueueAction(
		session: string,
		actionRequest: ProducerOptions,
	): Promise<ActionRequestContract> {
		return this.producer.enqueue(this.getId(), session, actionRequest);
	}

	/**
	 * @summary Insert a contract
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param insertSession - the Jellyfish session to insert the card with
	 * @param typeContract - the type card for the card that will be inserted
	 * @param options - insert options
	 * @param object - The contract that should be inserted
	 *
	 * @returns inserted contract
	 */
	async insertCard(
		logContext: LogContext,
		insertSession: string,
		typeContract: TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp?: any;
			reason?: any;
			actor?: any;
			originator?: any;
			attachEvents?: any;
		},
		object: Partial<Contract>,
	) {
		const instance = this;
		const kernel = instance.kernel;

		logger.debug(logContext, 'Inserting contract', {
			slug: object.slug,
			type: typeContract.slug,
			attachEvents: options.attachEvents,
		});

		object.type = `${typeContract.slug}@${typeContract.version}`;

		let contract: Contract | null = null;
		if (object.slug) {
			contract = await kernel.getContractBySlug(
				logContext,
				insertSession,
				`${object.slug}@${object.version || 'latest'}`,
			);
		}

		if (!contract && object.id) {
			contract = await kernel.getContractById(
				logContext,
				insertSession,
				object.id,
			);
		}

		if (typeof object.name !== 'string') {
			Reflect.deleteProperty(object, 'name');
		}

		return this.commit(
			logContext,
			insertSession,
			typeContract,
			contract,
			{
				eventPayload: _.omit(object, ['id']),
				eventType: 'create',
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
			async () => {
				const objectWithLinks = await getObjectWithLinks(
					logContext,
					kernel,
					insertSession,
					object,
					typeContract,
				);

				// TS-TODO: Fix these "any" castings
				const result = formulaParser.evaluateObject(
					typeContract.data.schema,
					objectWithLinks as any,
				);
				return kernel.insertContract(logContext, insertSession, result as any);
			},
		);
	}

	/**
	 * @summary Patch a contract
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param insertSession - the Jellyfish session to insert the contract with
	 * @param typeContract - the type contract for the contract that will be inserted
	 * @param options - options
	 * @param contract - The contract that should be inserted
	 * @param patch - json patch
	 *
	 * @returns inserted contract
	 */
	patchCard(
		logContext: LogContext,
		insertSession: string,
		typeContract: TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp?: any;
			reason?: any;
			actor?: any;
			originator?: any;
			attachEvents?: any;
		},
		contract: Partial<Contract>,
		patch: Operation[],
	) {
		const instance = this;
		const kernel = instance.kernel;
		const session = insertSession;
		const object = contract;
		assert.INTERNAL(
			logContext,
			object.version,
			errors.WorkerInvalidVersion,
			`Can't update without a version for: ${object.slug}`,
		);

		logger.debug(logContext, 'Patching contract', {
			slug: object.slug,
			version: object.version,
			type: typeContract.slug,
			attachEvents: options.attachEvents,
			operations: patch.length,
		});

		return this.commit(
			logContext,
			session,
			typeContract,
			object as Contract,
			{
				eventPayload: patch,
				eventType: 'update',
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
				attachEvents: options.attachEvents,
			},
			async () => {
				const objectWithLinks = await getObjectWithLinks(
					logContext,
					kernel,
					session,
					object,
					typeContract,
				);
				// TS-TODO: Remove this any casting
				const newPatch = formulaParser.evaluatePatch(
					typeContract.data.schema,
					objectWithLinks as any,
					patch,
				);
				return kernel.patchContractBySlug(
					logContext,
					session,
					`${object.slug}@${object.version}`,
					newPatch,
				);
			},
		);
	}

	/**
	 * @summary Replace a contract
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param insertSession - The Jellyfish session to insert the contract with
	 * @param typeContract - The type contract for the contract that will be inserted
	 * @param options - options
	 * @param object - the contract that should be inserted
	 *
	 * @returns replaced contract
	 */
	// FIXME: This entire method should be replaced and all operations should
	// be an insert or update.
	async replaceCard(
		logContext: LogContext,
		insertSession: string,
		typeContract: TypeContract,
		// TS-TODO: Use a common type for these options
		options: {
			timestamp?: any;
			reason?: any;
			actor?: any;
			originator?: any;
			attachEvents?: boolean;
		},
		object: Partial<Contract<ContractData>>,
	) {
		const instance = this;
		const kernel = instance.kernel;
		logger.debug(logContext, 'Replacing contract', {
			slug: object.slug,
			type: typeContract.slug,
			attachEvents: options.attachEvents,
		});

		object.type = `${typeContract.slug}@${typeContract.version}`;

		let contract: Contract | null = null;

		if (object.slug) {
			contract = await kernel.getContractBySlug(
				logContext,
				insertSession,
				`${object.slug}@${object.version}`,
			);
		}
		if (!contract && object.id) {
			contract = await kernel.getContractById(
				logContext,
				insertSession,
				object.id,
			);
		}

		let attachEvents = options.attachEvents;

		// If a contract already exists don't attach events
		if (contract) {
			attachEvents = false;
		}

		if (typeof object.name !== 'string') {
			Reflect.deleteProperty(object, 'name');
		}

		return this.commit(
			logContext,
			insertSession,
			typeContract,
			contract,
			{
				attachEvents,
				eventPayload: !!contract ? null : _.omit(object, ['id']),
				eventType: !!contract ? null : 'create',
				timestamp: options.timestamp,
				reason: options.reason,
				actor: options.actor,
				originator: options.originator,
			},
			async () => {
				const { links } = await getObjectWithLinks(
					logContext,
					kernel,
					insertSession,
					object,
					typeContract,
				);

				// Add the expanded links to the new contract object being inserted
				const result = formulaParser.evaluateObject(typeContract.data.schema, {
					...object,
					links: links || {},
				} as any);

				// TS-TODO: Remove these `any` castings
				return kernel.replaceContract(logContext, insertSession, result as any);
			},
		);
	}

	/**
	 * @summary Set all registered triggers
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param triggerContracts - triggers
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.setTriggers([ ... ]);
	 */
	setTriggers(
		logContext: LogContext,
		triggerContracts: TriggeredActionContract[],
	) {
		logger.info(logContext, 'Setting triggers', {
			count: contracts.length,
		});

		this.triggers = triggerContracts;
	}

	/**
	 * @summary Upsert a single registered trigger
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param contract - triggered action contract
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.upsertTrigger({ ... });
	 */
	upsertTrigger(logContext: LogContext, contract: TriggeredActionContract) {
		logger.info(logContext, 'Upserting trigger', {
			slug: contract.slug,
		});

		// Find the index of an existing trigger with the same id
		const existingTriggerIndex = _.findIndex(this.triggers, {
			id: contract.id,
		});

		if (existingTriggerIndex === -1) {
			// If an existing trigger is not found, add the trigger
			this.triggers.push(contract);
		} else {
			// If an existing trigger is found, replace it
			this.triggers.splice(existingTriggerIndex, 1, contract);
		}
	}

	/**
	 * @summary Remove a single registered trigger
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param id - id of trigger contract
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.removeTrigger('ed3c21f2-fa5e-4cdf-b862-392a2697abe4');
	 */
	removeTrigger(logContext: LogContext, id: string) {
		logger.info(logContext, 'Removing trigger', {
			id,
		});

		this.triggers = _.reject(this.triggers, {
			id,
		});
	}

	/**
	 * @summary Get all registered triggers
	 * @function
	 * @public
	 *
	 * @returns trigger contracts
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * const triggers = worker.getTriggers();
	 * console.log(triggers.length);
	 */
	getTriggers() {
		return this.triggers;
	}

	/**
	 * @summary Updates the list of transformers, such that only the latest release version of each major version exists
	 * @function
	 * @private
	 *
	 * @example
	 * this.updateLatestTransformers();
	 */
	updateLatestTransformers() {
		const transformersMap: { [slug: string]: TransformerContract } = {};
		this.transformers.forEach((tf) => {
			const majorV = semver.major(tf.version) || 1; // we treat 0.x.y versions as "drafts" of 1.x.y versions
			const slugMajV = `${tf.slug}@${majorV}`;
			const prerelease = semver.prerelease(tf.version);
			if (
				!prerelease &&
				(!transformersMap[slugMajV] ||
					semver.gt(tf.version, transformersMap[slugMajV].version))
			) {
				transformersMap[slugMajV] = tf;
			}
		});

		this.latestTransformers = Object.values(transformersMap);
	}

	/**
	 * @summary Set all registered transformers
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param transformerContracts - transformer contracts
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.settransformers([ ... ]);
	 */
	// TS-TODO: Make transformers a core cotnract and type them correctly here
	setTransformers(
		logContext: LogContext,
		transformerContracts: TransformerContract[],
	) {
		logger.info(logContext, 'Setting transformers', {
			count: transformerContracts.length,
		});

		this.transformers = transformerContracts;
		this.updateLatestTransformers();
	}

	/**
	 * @summary Set type contracts
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param typeContracts - type contracts
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.setTypeContracts([ ... ]);
	 */
	setTypeContracts(logContext: LogContext, typeContracts: TypeContract[]) {
		logger.info(logContext, 'Setting type contracts', {
			count: typeContracts.length,
		});

		this.typeContracts = typeContracts.reduce((map, typeContract) => {
			map[`${typeContract.slug}@${typeContract.version}`] = typeContract;
			return map;
		}, {});
	}

	/**
	 * @summary Get type contracts
	 * @function
	 * @public
	 *
	 * @returns type contract map
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * const typeContracts = worker.getTypeContracts();
	 * console.log(typeContracts.length);
	 */
	getTypeContracts() {
		return this.typeContracts;
	}

	/**
	 * @summary Upsert a single registered transformer
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param transformer - transformer contract
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.upserttransformer({ ... });
	 */
	upsertTransformer(logContext: LogContext, transformer: TransformerContract) {
		logger.info(logContext, 'Upserting transformer', {
			slug: transformer.slug,
		});

		// Find the index of an existing transformer with the same id
		const existingTransformerIndex = _.findIndex(this.transformers, {
			id: transformer.id,
		});

		if (existingTransformerIndex === -1) {
			// If an existing transformer is not found, add the transformer
			this.transformers.push(transformer);
		} else {
			// If an existing transformer is found, replace it
			this.transformers.splice(existingTransformerIndex, 1, transformer);
		}
		this.updateLatestTransformers();
	}

	/**
	 * @summary Remove a single registered transformer
	 * @function
	 * @public
	 *
	 * @param logContext - log context
	 * @param id - id of transformer contract
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * worker.removetransformer('ed3c21f2-fa5e-4cdf-b862-392a2697abe4');
	 */
	removeTransformer(logContext: LogContext, id: string) {
		logger.info(logContext, 'Removing transformer', {
			id,
		});

		this.transformers = _.reject(this.transformers, {
			id,
		});
		this.updateLatestTransformers();
	}

	/**
	 * @summary Get filtered list of transformers, where only latest release version of each major version exists.
	 * @function
	 * @public
	 *
	 * @returns transformer contracts
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * const transformers = worker.getLatestTransformers();
	 * console.log(transformers.length);
	 */
	getLatestTransformers() {
		return this.latestTransformers;
	}

	/**
	 * @summary Execute the "pre" hook of an action request
	 * @function
	 * @public
	 *
	 * @description
	 * The "pre" hook of an action request is meant to run before
	 * the action request is enqueued. The hook may return a
	 * modified set of arguments.
	 *
	 * @param session - session id
	 * @param request - action request options
	 * @returns request arguments
	 */
	async pre(
		session: string,
		request: {
			action: string;
			logContext: LogContext;
			arguments: any;
			card: string;
			type: string;
		},
	) {
		const actionDefinition = this.library[request.action.split('@')[0]];
		assert.USER(
			request.logContext,
			actionDefinition,
			errors.WorkerInvalidAction,
			`No such action: ${request.action}`,
		);

		if (!actionDefinition.pre) {
			return request;
		}

		const modifiedArguments = await actionDefinition.pre(
			session,
			this.getActionContext(request.logContext),
			request,
		);

		request.arguments = modifiedArguments || request.arguments;
		return request;
	}

	/**
	 * @summary Execute an action request
	 * @function
	 * @public
	 *
	 * @description
	 * You still need to make sure to post the execution event
	 * upon completion.
	 *
	 * @param session - session id
	 * @param request - action request contract
	 * @returns action result
	 *
	 * @example
	 * const worker = new Worker({ ... });
	 * const session = '4a962ad9-20b5-4dd8-a707-bf819593cc84';
	 * const result = await worker.execute(kernel, session, { ... });
	 * console.log(result.error);
	 * console.log(result.data);
	 */
	async execute(session: string, request: ActionRequestContract) {
		const logContext: LogContext = request.data.context || {
			id: `EXECUTE-${request.id}`,
		};
		logger.info(logContext, 'Executing request', {
			request: {
				id: request.id,
				card: request.data.input.id,
				type: request.data.input.type,
				actor: request.data.actor,
				action: request.data.action,
			},
		});

		const actionContract = await this.kernel.getContractBySlug<ActionContract>(
			logContext,
			session,
			request.data.action,
		);

		assert.USER(
			logContext,
			actionContract,
			errors.WorkerInvalidAction,
			`No such action: ${request.data.action}`,
		);

		// TS-TODO: Use asserts correctly so the `assert.USER` call above correctly
		// validates that actionContract is non-null, so this double-check can be removed
		if (!actionContract) {
			throw new errors.WorkerInvalidAction(
				`No such action: ${request.data.action}`,
			);
		}

		const startDate = new Date();

		// TS-TODO: Use proper type
		let result: any;

		try {
			const [input, actor] = await Promise.all([
				getInputContract(
					logContext,
					this.kernel,
					session,
					request.data.input.id,
				),
				this.kernel.getContractById(logContext, session, request.data.actor),
			]);

			assert.USER(
				logContext,
				input,
				errors.WorkerNoElement,
				`No such input contract: ${request.data.input.id}`,
			);
			assert.INTERNAL(
				logContext,
				actor,
				errors.WorkerNoElement,
				`No such actor: ${request.data.actor}`,
			);

			const actionInputContractFilter = _.get(
				actionContract,
				['data', 'filter'],
				{
					type: 'object',
				},
			);

			const results = skhema.match(actionInputContractFilter as any, input);
			if (!results.valid) {
				logger.error(logContext, 'Contract schema mismatch!');
				logger.error(logContext, JSON.stringify(actionInputContractFilter));
				for (const error of results.errors) {
					logger.error(logContext, error);
				}

				throw new errors.WorkerSchemaMismatch(
					`Input contract does not match filter. Action:${actionContract.slug}, Contract:${input?.slug}`,
				);
			}

			// TODO: Action definition bodies are not versioned yet
			// as they are not part of the action contracts.
			const actionName = actionContract.slug.split('@')[0];

			const argumentsSchema = utils.getActionArgumentsSchema(actionContract);

			assert.USER(
				logContext,
				// TS-TODO: remove any casting
				skhema.isValid(argumentsSchema as any, request.data.arguments),
				errors.WorkerSchemaMismatch,
				() => {
					return `Arguments do not match for action ${actionName}: ${JSON.stringify(
						request.data.arguments,
						null,
						2,
					)}`;
				},
			);

			const actionFunction =
				this.library[actionName] && this.library[actionName].handler;

			assert.INTERNAL(
				logContext,
				actionFunction,
				errors.WorkerInvalidAction,
				`Unknown action function: ${actionName}`,
			);

			// Generate an interface object for the action function to use.
			// This ensures that any CRUD operations performed by the action
			// function are mediates by the worker instance, ensuring that
			// things like triggers, transformers etc are always processed correctly.
			const actionContext = this.getActionContext(logContext);

			// TS-TODO: `input` gets verified as non-null by a jellyfish-assert
			// call above, but Typescript doesn't understand this.
			const data: any = await actionFunction(session, actionContext, input!, {
				action: actionContract,
				card: request.data.input.id,
				actor: request.data.actor,
				logContext,
				timestamp: request.data.timestamp,
				epoch: request.data.epoch,
				// TS-TODO: correctly type arguments object on action request contract
				arguments: request.data.arguments as { [arg: string]: JsonSchema },
				originator: request.data.originator,
			});

			const endDate = new Date();
			logger.info(logContext, 'Execute success', {
				data,
				input: request.data.input,
				action: actionContract.slug,
				time: endDate.getTime() - startDate.getTime(),
			});

			// Schedule actions for future execution
			if (
				data &&
				data.id &&
				data.type &&
				data.type.split('@')[0] === 'scheduled-action'
			) {
				await this.scheduleAction(logContext, session, data.id);
			} else if (request.data.schedule) {
				await this.scheduleAction(logContext, session, request.data.schedule);
			}

			result = {
				error: false,
				data,
			};
		} catch (error: any) {
			const endDate = new Date();
			const errorObject = serializeError(error, { maxDepth: 5 });

			const logData = {
				error: errorObject,
				input: request.data.input,
				action: actionContract.slug,
				time: endDate.getTime() - startDate.getTime(),
			};

			if (error.expected) {
				logger.warn(logContext, 'Execute error', logData);
			} else {
				logger.error(logContext, 'Execute error', logData);
			}

			result = {
				error: true,
				data: errorObject,
			};
		}

		const event = await this.consumer.postResults(
			this.getId(),
			logContext,
			request,
			result,
		);
		assert.INTERNAL(
			logContext,
			event,
			errors.WorkerNoExecuteEvent,
			`Could not create execute event for request: ${request.id}`,
		);

		logger.info(logContext, 'Execute event posted', {
			slug: event.slug,
			type: event.type,
			target: event.data.target,
			actor: event.data.actor,
			payload: {
				id: event.data.payload.id,
				card: event.data.payload.card,
				error: event.data.payload.error,
			},
		});

		return result;
	}

	/**
	 * @summary A pipeline function that runs standard logic for all contract
	 * operations ran through the worker
	 * @function
	 * @private
	 *
	 * @param logContext - log context
	 * @param session - session id
	 * @param typeContract - the full type contract for the contract being inserted or updated
	 * @param currentContract - The full contract prior to being updated, if it exists
	 * @param options - options object
	 * @param fn - an asynchronous function that will perform the operation
	 */
	// TS-TODO: Improve the typings for the `options` parameter
	private async commit(
		logContext: LogContext,
		session: string,
		typeContract: TypeContract,
		currentContract: Contract | null,
		options: {
			actor: any;
			originator: any;
			attachEvents: any;
			timestamp: string | number | Date;
			reason: any;
			eventType: any;
			eventPayload: any;
		},
		fn: () => Promise<Contract>,
	) {
		assert.INTERNAL(
			logContext,
			typeContract && typeContract.data && typeContract.data.schema,
			errors.WorkerNoElement,
			`Invalid type: ${typeContract}`,
		);

		const currentTime = new Date();
		const workerContext = this.getActionContext(logContext);

		const insertedContract = await fn();

		logger.info(
			logContext,
			'Worker function complete, now running commit logic',
		);

		if (!insertedContract) {
			return null;
		}

		if (
			currentContract !== null &&
			fastEquals.deepEqual(
				_.omit(insertedContract, [
					'created_at',
					'updated_at',
					'linked_at',
					'links',
				]),
				_.omit(currentContract, [
					'created_at',
					'updated_at',
					'linked_at',
					'links',
				]),
			)
		) {
			logger.debug(logContext, 'Omitting pointless insertion', {
				slug: currentContract.slug,
			});

			return null;
		}

		evaluateTransformers({
			transformers: this.latestTransformers,
			oldContract: currentContract,
			newContract: insertedContract,
			logContext,
			query: (querySchema, queryOpts) => {
				return this.kernel.query(
					logContext,
					workerContext.privilegedSession,
					querySchema,
					queryOpts,
				);
			},
			executeAndAwaitAction: async (actionRequest) => {
				const req = await this.enqueueAction(workerContext.privilegedSession, {
					...actionRequest,
					logContext,
					type: actionRequest.type!,
				});

				const result = await this.producer.waitResults(logContext, req);

				return result;
			},
		});

		subscriptionsLib
			.evaluate({
				oldContract: currentContract,
				newContract: insertedContract,
				getTypeContract: (type) => {
					return this.typeContracts[type];
				},
				getSession: async (userId: string) => {
					return utils.getActorKey(
						logContext,
						this.kernel,
						workerContext.privilegedSession,
						userId,
					);
				},
				insertContract: async (
					insertedContractType: TypeContract,
					actorSession: string,
					object: any,
				) => {
					return workerContext.insertCard(
						actorSession,
						insertedContractType,
						{
							...options,
							attachEvents: true,
							timestamp: Date.now(),
						},
						object,
					);
				},
				query: (querySchema, queryOpts = {}) => {
					return this.kernel.query(
						logContext,
						workerContext.privilegedSession,
						querySchema,
						queryOpts,
					);
				},
				getContractById: (id: string) => {
					return this.kernel.getContractById(logContext, session, id);
				},
			})
			.catch((error) => {
				const errorObject = serializeError(error, { maxDepth: 5 });

				const logData = {
					error: errorObject,
					input: insertedContract.slug,
				};

				if (error.expected) {
					logger.warn(logContext, 'Execute error in subscriptions', logData);
				} else {
					logger.error(logContext, 'Execute error', logData);
				}
			});

		await Promise.all(
			this.triggers.map(async (trigger: TriggeredActionContract) => {
				try {
					// Ignore triggered actions whose start date is in the future
					if (currentTime < triggersLib.getStartDate(trigger)) {
						return null;
					}

					const request = await triggersLib.getRequest(
						this.kernel,
						trigger,
						currentContract,
						insertedContract,
						{
							currentDate: new Date(),
							mode: currentContract ? 'update' : 'insert',
							logContext,
							session,
						},
					);

					if (!request) {
						return null;
					}

					// trigger.target might result in multiple contracts in a single action request
					const identifiers = _.uniq(_.castArray(request.card));

					await Promise.all(
						identifiers.map(async (identifier) => {
							const triggerContract = await getInputContract(
								logContext,
								this.kernel,
								session,
								identifier,
							);

							if (!triggerContract) {
								throw new errors.WorkerNoElement(
									`No such input contract for trigger ${trigger.slug}: ${identifier}`,
								);
							}
							const actionRequest = {
								// Re-enqueuing an action request expects the "contract" option to be an
								// id, not a full contract.
								card: triggerContract.id,
								action: request.action!,
								actor: options.actor,
								logContext: request.logContext,
								timestamp: request.currentDate.toISOString(),
								epoch: request.currentDate.valueOf(),
								arguments: request.arguments,

								// Carry the old originator if present so we
								// don't break the chain
								originator: options.originator || request.originator,
							};

							logger.info(
								logContext,
								'Enqueing new action request due to triggered-action',
								{
									trigger: trigger.slug,
									contract: triggerContract.id,
									arguments: request.arguments,
								},
							);

							// TS-TODO: remove any casting
							return this.enqueueAction(session, actionRequest as any);
						}),
					);
				} catch (error: any) {
					const errorObject = serializeError(error, { maxDepth: 5 });

					const logData = {
						error: errorObject,
						input: insertedContract.slug,
						trigger: trigger.slug,
					};

					if (error.expected) {
						logger.warn(
							logContext,
							'Execute error in asynchronous trigger',
							logData,
						);
					} else {
						logger.error(logContext, 'Execute error', logData);
					}
				}
			}),
		);

		if (options.attachEvents) {
			const time = options.timestamp
				? new Date(options.timestamp)
				: currentTime;

			const request = {
				action: 'action-create-event@1.0.0',
				card: insertedContract,
				actor: options.actor,
				logContext,
				timestamp: time.toISOString(),
				epoch: time.valueOf(),
				arguments: {
					name: options.reason,
					type: options.eventType,
					payload: options.eventPayload,
					tags: [],
				},
			};

			await this.library[request.action.split('@')[0]].handler(
				session,
				workerContext,
				insertedContract,
				request as any,
			);
		}

		// If the contract markers have changed then update the timeline of the contract
		if (
			currentContract &&
			!fastEquals.deepEqual(currentContract.markers, insertedContract.markers)
		) {
			const timeline = await this.kernel.query(logContext, session, {
				$$links: {
					'is attached to': {
						type: 'object',
						required: ['slug', 'type'],
						properties: {
							slug: {
								type: 'string',
								const: insertedContract.slug,
							},
							type: {
								type: 'string',
								const: insertedContract.type,
							},
						},
					},
				},
				type: 'object',
				required: ['slug', 'version', 'type'],
				properties: {
					slug: {
						type: 'string',
					},
					version: {
						type: 'string',
					},
					type: {
						type: 'string',
					},
				},
			});

			for (const event of timeline) {
				if (!fastEquals.deepEqual(event.markers, insertedContract.markers)) {
					await this.kernel.patchContractBySlug(
						logContext,
						session,
						`${event.slug}@${event.version}`,
						[
							{
								op: 'replace',
								path: '/markers',
								value: insertedContract.markers,
							},
						],
					);
				}
			}
		}

		if (insertedContract.type === CONTRACT_TYPE_TYPE) {
			// Remove any previously attached trigger for this type
			const typeTriggers = await triggersLib.getTypeTriggers(
				logContext,
				this.kernel,
				session,
				`${insertedContract.slug}@${insertedContract.version}`,
			);
			await Promise.all(
				typeTriggers.map(
					async (trigger) => {
						await this.kernel.patchContractBySlug(
							logContext,
							session,
							`${trigger.slug}@${trigger.version}`,
							[
								{
									op: 'replace',
									path: '/active',
									value: false,
								},
							],
						);

						// Also from the locally cached triggers
						_.remove(this.triggers, {
							id: trigger.id,
						});
					},
					{
						concurrency: INSERT_CONCURRENCY,
					},
				),
			);

			await Promise.all(
				formulas.getTypeTriggers(insertedContract as TypeContract).map(
					async (trigger) => {
						// We don't want to use the actions queue here
						// so that watchers are applied right away
						const triggeredActionContract = await this.kernel.replaceContract(
							logContext,
							session,
							trigger,
						);

						// Registered the newly created trigger
						// right away for performance reasons
						return this.setTriggers(
							logContext,
							this.triggers.concat([triggeredActionContract]),
						);
					},
					{
						concurrency: INSERT_CONCURRENCY,
					},
				),
			);
		}

		return insertedContract;
	}

	/**
	 * Enqueue an action to be executed later, using schedule configuration
	 * @function
	 *
	 * @param logContext - log context
	 * @param session - session id
	 * @param id - scheduled action contract ID
	 */
	async scheduleAction(
		logContext: LogContext,
		session: string,
		id: string,
	): Promise<void> {
		// Remove any already enqueued jobs
		await this.producer.deleteJob(logContext, id);

		// Enqueue request if schedule configuration results in future date
		const scheduledAction =
			await this.kernel.getContractById<ScheduledActionContract>(
				logContext,
				session,
				id,
			);
		if (scheduledAction && scheduledAction.active) {
			const runAt = getNextExecutionDate(scheduledAction.data.schedule);
			if (runAt) {
				await this.enqueueAction(session, {
					logContext,
					action: scheduledAction.data.options.action,
					card: scheduledAction.data.options.card,
					type: scheduledAction.data.options.type,
					arguments: scheduledAction.data.options.arguments,
					schedule: {
						contract: id,
						runAt,
					},
				});
			}
		}
	}
}

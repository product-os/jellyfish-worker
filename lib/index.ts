import * as assert from '@balena/jellyfish-assert';
import { defaultEnvironment as environment } from '@balena/jellyfish-environment';
import { Jellyscript } from '@balena/jellyfish-jellyscript';
import { getLogger, LogContext } from '@balena/jellyfish-logger';
import { strict } from 'assert';
import {
	AutumnDBSession,
	CONTRACTS,
	Contract,
	ContractData,
	ContractDefinition,
	JsonSchema,
	Kernel,
	TypeContract,
	RelationshipContract,
	LinkContract,
	contractMixins,
} from 'autumndb';
import * as fastEquals from 'fast-equals';
import type { Operation } from 'fast-json-patch';
import _ from 'lodash';
import type { Pool } from 'pg';
import { serializeError } from 'serialize-error';
import * as skhema from 'skhema';
import { setTimeout as delay } from 'timers/promises';
import { v4 as uuidv4 } from 'uuid';
import { actions } from './actions';
import { contracts } from './contracts';
import * as errors from './errors';
import * as formulas from './formulas';
import { PluginDefinition, PluginManager } from './plugin';
import { Consumer, Producer } from './queue';
import type { OnMessageEventHandler } from './queue/consumer';
import { enqueue, getNextExecutionDate } from './queue/producer';
import * as subscriptionsLib from './subscriptions';
import { Sync } from './sync';
import * as triggersLib from './triggers';
import type {
	Action,
	ActionContract,
	ActionPreRequest,
	ActionRequestContract,
	ActionRequestData,
	Map,
	ScheduledActionContract,
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
	Consumer,
	errors as queueErrors,
	events,
	Producer,
	ProducerOptions,
	ProducerResults,
} from './queue';
export * as testUtils from './test-utils';
export * from './types';
export { mirror } from './actions/mirror';

// TODO: use a single logger instance for the worker
const logger = getLogger('worker');

const formulaParser = new Jellyscript();

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
	session: AutumnDBSession,
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
	session: AutumnDBSession,
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

// Only org members can add other users to an org
// Here we check to see if the user is an org member, or the creator of the org, before allowing the link creation
// TODO: This is a temporary solution until we have a better way to handle this.
// Once we are able to distinctly permission writes in AutumnDB, we can remove this.
const validateOrgMembership = async (
	logContext: LogContext,
	kernel: Kernel,
	session: AutumnDBSession,
	contract: Partial<Contract>,
): Promise<void> => {
	if (contract.type === 'link@1.0.0' && session.actor.slug !== 'user-admin') {
		const linkContract: Partial<LinkContract> = contract as any;
		if (
			linkContract.name === 'is creator of' &&
			linkContract?.data?.from.type === 'user@1.0.0' &&
			linkContract.data.inverseName === 'was created by'
		) {
			throw new Error('Cannot create link with reserved name "is creator of"');
		}
		if (
			linkContract.name === 'has member' &&
			linkContract?.data?.from.type === 'org@1.0.0' &&
			linkContract.data.to.type === 'user@1.0.0'
		) {
			const [sessionUserWithOrg] = await kernel.query(
				logContext,
				session,
				{
					type: 'object',
					properties: {
						id: {
							const: session.actor.id,
						},
					},
					anyOf: [
						{
							$$links: {
								'is member of': {
									type: 'object',
									properties: {
										type: {
											const: 'org@1.0.0',
										},
										id: {
											const: linkContract?.data.from.id,
										},
									},
								},
							},
						},
						{
							$$links: {
								'is creator of': {
									type: 'object',
									properties: {
										type: {
											const: 'org@1.0.0',
										},
										id: {
											const: linkContract?.data.from.id,
										},
									},
								},
							},
						},
					],
				},
				{
					limit: 1,
				},
			);

			if (!sessionUserWithOrg) {
				throw new Error('You are not a member of this org');
			}
		}
	}
};

/**
 * Jellyfish worker library module.
 *
 * @module worker
 */
export class Worker {
	kernel: Kernel;
	pluginManager: PluginManager;
	pool: Pool;
	consumer: Consumer;
	producer: Producer;
	triggers: TriggeredActionContract[];
	typeContracts: { [key: string]: TypeContract };
	session: AutumnDBSession;
	library: Map<Action>;
	id: string = '0';
	sync: Sync;
	private cacheRefreshInterval: null | NodeJS.Timeout = null;

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
		session: AutumnDBSession,
		pool: Pool,
		plugins: PluginDefinition[],
	) {
		this.kernel = kernel;
		this.pluginManager = new PluginManager(plugins);
		this.pool = pool;
		this.triggers = [];
		this.typeContracts = {};
		this.session = session;
		this.library = this.pluginManager.getActions();
		this.consumer = new Consumer(kernel, pool, session);
		this.producer = new Producer(kernel, pool, session);
		this.sync = new Sync({
			integrations: this.pluginManager.getSyncIntegrations(),
		});

		// Add actions defined in this repo
		for (const action of actions) {
			this.library[action.contract.slug] = action;
		}
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

		// Checks if all the values on object a are equal to the matching values on object b
		const existingKeysMatch = (a: any, b: any) => {
			return _.isEqual(_.pick(b, _.keys(a)), a);
		};

		// Get the existing contract and if it is not found or is different, replace it
		const checkThenReplaceContract = async (
			baseContract: Partial<Contract> & { type: string },
		) => {
			if (!baseContract) {
				return;
			}
			// Add sane defaults to the contract, such as a uiSchema reset
			const contract = contractMixins.initialize(baseContract as Contract);
			const current = await this.kernel.getContractBySlug(
				logContext,
				this.session,
				`${contract.slug}@${contract.version}`,
			);
			if (!current || !existingKeysMatch(contract, current)) {
				const versionedType = ensureTypeHasVersion(contract.type);
				const typeContract = await this.kernel.getContractBySlug<TypeContract>(
					logContext,
					this.session,
					versionedType,
				);

				if (typeContract) {
					logger.debug(logContext, 'Inserting default contract', {
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
			}
		};

		// Initialize producer and consumer
		await this.producer.initialize(logContext);
		await this.consumer.initializeWithEventHandler(
			logContext,
			onMessageEventHandler,
		);

		const [defaultTypeContracts, nonTypeContracts] = _.partition(
			Object.values(contracts),
			(contract) => {
				return contract.type.split('@')[0] === 'type';
			},
		);

		const [defaultLoopContracts, defaultContracts] = _.partition(
			Object.values(nonTypeContracts),
			(contract) => {
				return contract.type.split('@')[0] === 'loop';
			},
		);

		// Insert type contracts as prerequisite
		await Promise.all(defaultTypeContracts.map(checkThenReplaceContract));

		// Insert loop contracts as prerequisite
		await Promise.all(defaultLoopContracts.map(checkThenReplaceContract));

		// Insert other worker contracts
		const contractsToSkip: string[] = [];
		if (environment.isProduction() && !environment.isCI()) {
			contractsToSkip.push('user-guest');
		}
		const defaultContractsToLoad = _.values(defaultContracts).filter(
			(contract: ContractDefinition) => {
				return !contractsToSkip.includes(contract.slug);
			},
		);
		await Promise.all(defaultContractsToLoad.map(checkThenReplaceContract));

		await Promise.all(
			actions.map((action) => {
				return checkThenReplaceContract(action.contract);
			}),
		);

		// Get all contracts provided by plugins
		const pluginContracts = this.pluginManager.getCards();

		// Make sure certain contracts are initialized, as they can be prerequisites
		const [pluginContractPreReqs, pluginContractsRest] = _.partition(
			pluginContracts,
			(contract) => {
				return contract.type.split('@')[0].match(/^(loop|action|type)$/);
			},
		);
		await Promise.all(pluginContractPreReqs.map(checkThenReplaceContract));
		await Promise.all(pluginContractsRest.map(checkThenReplaceContract));

		// For better performance, commonly accessed contracts are stored in cache in the worker.
		// Periodically poll for these contracts, so the worker always has the most up to date version of them.
		await this.fetchCacheData(logContext);

		// Refresh the cache every 10 seconds
		this.cacheRefreshInterval = setInterval(async () => {
			await this.fetchCacheData(logContext);
		}, 10 * 1000);
	}

	async fetchCacheData(logContext: LogContext) {
		const [triggers, types] = await Promise.all(
			[SCHEMA_ACTIVE_TRIGGERS, SCHEMA_ACTIVE_TYPE_CONTRACTS].map((schema) =>
				this.kernel.query(logContext, this.session, schema),
			),
		);

		if (!_.isEqual(triggers, this.getTriggers())) {
			logger.info(logContext, 'Loading triggers', {
				triggers: triggers.length,
			});
			this.setTriggers(logContext, triggers as TriggeredActionContract[]);
		}

		if (!_.isEqual(types, Object.values(this.getTypeContracts()))) {
			logger.info(logContext, 'Loading types', {
				types: types.length,
			});
			this.setTypeContracts(logContext, types as TypeContract[]);
		}
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
			getCardById: (lsession: AutumnDBSession, id: string) => {
				return self.kernel.getContractById(logContext, lsession, id);
			},
			getCardBySlug: (lsession: AutumnDBSession, slug: string) => {
				return self.kernel.getContractBySlug(logContext, lsession, slug);
			},
			query: (
				lsession: AutumnDBSession,
				schema: Parameters<Kernel['query']>[2],
				options: Parameters<Kernel['query']>[3],
			) => {
				return self.kernel.query(logContext, lsession, schema, options);
			},
			privilegedSession: this.session,
			insertCard: (
				lsession: AutumnDBSession,
				typeCard: Parameters<Worker['insertCard']>[2],
				options: Parameters<Worker['insertCard']>[3],
				card: Parameters<Worker['insertCard']>[4],
			) => {
				return self.insertCard(logContext, lsession, typeCard, options, card);
			},
			replaceCard: (
				lsession: AutumnDBSession,
				typeCard: Parameters<Worker['replaceCard']>[2],
				options: Parameters<Worker['replaceCard']>[3],
				card: Parameters<Worker['replaceCard']>[4],
			) => {
				return self.replaceCard(logContext, lsession, typeCard, options, card);
			},
			patchCard: (
				lsession: AutumnDBSession,
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
			cards: {
				...CONTRACTS,
				...self.getTypeContracts(),
			},
			relationships: self.kernel.getRelationships(),
		};
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
	async insertCard<T extends Contract = Contract>(
		logContext: LogContext,
		insertSession: AutumnDBSession,
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
	): Promise<T | null> {
		const instance = this;
		const kernel = instance.kernel;

		logger.debug(logContext, 'Inserting contract', {
			slug: object.slug,
			type: typeContract.slug,
			attachEvents: options.attachEvents,
		});

		object.type = `${typeContract.slug}@${typeContract.version}`;

		if (typeof object.name !== 'string') {
			Reflect.deleteProperty(object, 'name');
		}

		return this.commit<T>(
			logContext,
			insertSession,
			typeContract,
			null,
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
				const evaluatedContract = formulaParser.evaluateObject(
					typeContract.data.schema,
					objectWithLinks as any,
				);

				await validateOrgMembership(
					logContext,
					kernel,
					insertSession,
					evaluatedContract,
				);

				const result = await kernel.insertContract<T>(
					logContext,
					insertSession,
					evaluatedContract as any,
				);

				// Create a link between the contract and the creator
				if (options.actor && typeContract.slug !== 'link') {
					const actor = await kernel.getContractById(
						logContext,
						instance.session,
						options.actor,
					);
					if (
						actor &&
						actor.type === 'user@1.0.0' &&
						!['user-admin', 'user-guest', 'user-hubot'].includes(actor.slug)
					) {
						await kernel.insertContract(logContext, insertSession, {
							// A lot of these links are created, so relying on the default slug
							// can be unreliable and potenitally cause slug collisions.
							// Specifying the slug here allows us to use a full uuid instead.
							slug: `link-creator-${uuidv4()}`,
							type: 'link@1.0.0',
							name: 'is creator of',
							data: {
								inverseName: 'was created by',
								from: {
									id: actor.id,
									type: actor.type,
								},
								to: {
									id: result.id,
									type: result.type,
								},
							},
						});
					}
				}

				return result;
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
		insertSession: AutumnDBSession,
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

				await validateOrgMembership(
					logContext,
					kernel,
					insertSession,
					objectWithLinks,
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
		insertSession: AutumnDBSession,
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
			count: triggerContracts.length,
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
	async pre(session: AutumnDBSession, request: ActionPreRequest) {
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
	async execute(session: AutumnDBSession, request: ActionRequestContract) {
		const logContext: LogContext = request.data.context || {
			id: `EXECUTE-${request.id}`,
		};
		logger.debug(logContext, 'Executing request', {
			request: {
				id: request.id,
				card: request.data.input.id,
				type: request.data.input.type,
				actor: request.data.actor,
				action: request.data.action,
				session,
			},
		});

		const [actionContract, actionRequestContract] = await Promise.all([
			this.kernel.getContractBySlug<ActionContract>(
				logContext,
				session,
				request.data.action,
			),
			this.kernel.getContractById<ActionRequestContract>(
				logContext,
				this.kernel.adminSession()!,
				request.id,
			),
		]);
		strict(
			actionContract,
			new errors.WorkerInvalidAction(`No such action: ${request.data.action}`),
		);
		strict(
			actionRequestContract,
			new errors.WorkerInvalidActionRequest(
				`No such action-request: ${request.id}`,
			),
		);
		if (actionRequestContract.data.executed) {
			throw new errors.WorkerInvalidActionRequest(
				`action-request already executed: ${request.id}`,
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
			// things like triggers etc are always processed correctly.
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
			logger.debug(logContext, 'Execute success', {
				data,
				input: request.data.input,
				action: actionContract.slug,
				time: endDate.getTime() - startDate.getTime(),
			});

			// Schedule initial execution for new scheduled-action contracts
			if (
				data &&
				data.id &&
				data.type &&
				data.type.split('@')[0] === 'scheduled-action'
			) {
				await this.scheduleAction(
					logContext,
					session,
					request.data.actor,
					request.data.epoch,
					data.id,
					request.data.originator,
				);
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

		// Schedule future executions even if previous attempt failed
		if (request.data.schedule) {
			await this.scheduleAction(
				logContext,
				session,
				request.data.actor,
				request.data.epoch,
				request.data.schedule,
				request.data.originator,
			);
		}

		await this.consumer.postResults(logContext, request, result);
		logger.debug(logContext, 'action-request executed', {
			id: request.id,
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
	private async commit<T extends Contract | TypeContract>(
		logContext: LogContext,
		session: AutumnDBSession,
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
		fn: () => Promise<T>,
	): Promise<T | null> {
		assert.INTERNAL(
			logContext,
			typeContract && typeContract.data && typeContract.data.schema,
			errors.WorkerNoElement,
			`Invalid type: ${typeContract}`,
		);

		const currentTime = new Date();
		const workerContext = this.getActionContext(logContext);

		const insertedContract = await fn();

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

		subscriptionsLib
			.evaluate({
				logContext,
				oldContract: currentContract,
				newContract: insertedContract,
				session,
				privilegedSession: workerContext.privilegedSession,
				getTypeContract: (type) => {
					return this.typeContracts[type];
				},
				insertContract: async (
					insertedContractType: TypeContract,
					actorSession: AutumnDBSession,
					object: any,
					actor: string,
				) => {
					return workerContext.insertCard(
						actorSession,
						insertedContractType,
						{
							actor,
							timestamp: Date.now(),
							attachEvents: false,
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
				getCreatorSession: async (creatorId: string) => {
					const actor = await this.kernel.getContractById(
						logContext,
						workerContext.privilegedSession,
						creatorId,
					);
					return actor ? { actor } : null;
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

							logger.debug(
								logContext,
								'Enqueing new action request due to triggered-action',
								{
									trigger: trigger.slug,
									contract: triggerContract.id,
									arguments: request.arguments,
									session,
									actor: session.actor.id,
								},
							);

							return this.insertCard(
								request.logContext,
								this.session,
								this.typeContracts['action-request@1.0.0'],
								{
									timestamp: request.currentDate.toISOString(),
									actor: session.actor.id,
									originator: options.originator || request.originator,
								},
								{
									data: {
										card: triggerContract.id,
										action: request.action!,
										actor: session.actor.id,
										context: request.logContext,
										input: {
											id: triggerContract.id,
										},
										epoch: request.currentDate.valueOf(),
										timestamp: request.currentDate.toISOString(),
										originator: options.originator || request.originator,
										arguments: request.arguments,
									},
								},
							);
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

			await this.generateFormulaTypeTriggers(
				logContext,
				session,
				insertedContract as TypeContract,
			);
		}

		if (insertedContract.type.split('@')[0] === 'relationship') {
			const relationship = insertedContract as RelationshipContract;
			// There is potential for a race condition here where we try to get
			// the relationship before its been set in the kernel cache.
			// Set up a small loop to ensure the relationship is available before proceeding
			while (true) {
				if (
					_.find(this.kernel.getRelationships(), { slug: relationship.slug })
				) {
					break;
				}
				await delay(50);
			}
			const fromType = relationship.data.from.type;
			const toType = relationship.data.to.type;
			for (const slug of [fromType, toType]) {
				// Calculate the formulas for the most recent version of the type
				const contract = await this.kernel.getContractBySlug<TypeContract>(
					logContext,
					session,
					`${slug}@latest`,
				);
				// The type not be available yet if the relationship is inserted first
				if (contract) {
					await this.generateFormulaTypeTriggers(logContext, session, contract);
				}
			}
		}

		// Add inserted action-request contracts to queue
		if (insertedContract.type.split('@')[0] === 'action-request') {
			await enqueue(
				logContext,
				this.pool,
				options.actor,
				insertedContract as ActionRequestContract,
			);
		}

		return insertedContract;
	}

	async generateFormulaTypeTriggers(
		logContext: LogContext,
		session: AutumnDBSession,
		typeContract: TypeContract,
	) {
		await Promise.all(
			formulas
				.getTypeTriggers(this.kernel.getRelationships(), typeContract)
				.map(
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

	/**
	 * Enqueue an action to be executed later, using schedule configuration
	 * @function
	 *
	 * @param logContext - log context
	 * @param session - session id
	 * @param actor - actor id
	 * @param epoch - epoch
	 * @param id - scheduled action contract ID
	 */
	async scheduleAction(
		logContext: LogContext,
		session: AutumnDBSession,
		actor: string,
		epoch: number,
		id: string,
		originator: string | undefined,
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
		if (
			scheduledAction &&
			scheduledAction.active &&
			scheduledAction.type.split('@')[0] === 'scheduled-action' &&
			scheduledAction.data.options.arguments
		) {
			const runAt = getNextExecutionDate(scheduledAction.data.schedule);
			if (runAt) {
				// Create new action-request contract
				const data: ActionRequestData = {
					actor,
					input: {
						id: scheduledAction.data.options.card || scheduledAction.id,
					},
					card: scheduledAction.data.options.card || scheduledAction.id,
					action: scheduledAction.data.options.action,
					context: logContext,
					epoch,
					timestamp: new Date().toISOString(),
					arguments: scheduledAction.data.options.arguments,
					schedule: scheduledAction.id,
				};
				if (originator) {
					data.originator = originator;
				}
				const actionRequest =
					await this.kernel.insertContract<ActionRequestContract>(
						logContext,
						this.session,
						{
							slug: utils.getEventSlug('action-request'),
							type: 'action-request@1.0.0',
							data,
						},
					);
				strict(
					actionRequest,
					new errors.WorkerNoElement(
						`Failed to insert action-request for scheduled action`,
					),
				);

				// Enqueue new action-request
				await enqueue(logContext, this.pool, actor, actionRequest, {
					runAt,
					contract: scheduledAction.id,
				});
			}
		}
	}

	// Safely stop the worker, waiting for any ongoing jobs to complete.
	async stop() {
		await this.consumer.cancel();
		if (this.cacheRefreshInterval) {
			clearInterval(this.cacheRefreshInterval);
		}
	}
}

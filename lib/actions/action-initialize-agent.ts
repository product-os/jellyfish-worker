import { strict as assert } from 'assert';
import type { Contract, TypeContract } from 'autumndb';
import _ from 'lodash';
import { ActionDefinition, errors, WorkerContext } from '../';

/**
 * Search through a contract query result for a matching settings link
 * @param contracts Contracts with links to check against
 * @param predicate Data shape to check for
 * @returns boolean representing whether the predicate was found in the links
 */
export function agentHasSettings(
	contracts: Array<Partial<Contract>>,
	predicate: any,
): boolean {
	if (contracts[0]?.links && contracts[0].links['has settings']) {
		if (_.find(contracts[0].links['has settings'], predicate)) {
			return true;
		}
	}
	return false;
}

/**
 * Create settings contract for an agent
 * @param session - execution session
 * @param context - worker context
 * @param agent - agent contract to create settings for
 * @param type - type of settings contract to create
 */
export async function createSettingsForAgent(
	session: string,
	context: WorkerContext,
	agent: Contract,
	type: string,
): Promise<void> {
	const settings = await context.insertCard(
		session,
		context.cards[`${type}@1.0.0`] as TypeContract,
		{},
		{
			type,
		},
	);
	await context.insertCard(
		session,
		context.cards['link@1.0.0'] as TypeContract,
		{},
		{
			type: 'link',
			name: 'has settings',
			data: {
				inverseName: 'are settings for',
				from: {
					type: agent.type,
					id: agent.id,
				},
				to: {
					type: settings!.type,
					id: settings!.id,
				},
			},
		},
	);
}

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	agent,
	_request,
) => {
	// Assert that we have all necessary types
	['link', 'working-hours', 'agent-settings'].forEach((type) => {
		assert(
			context.cards[`${type}@1.0.0`],
			new errors.WorkerNoElement(`Type not found ${type}@1.0.0`),
		);
	});

	// Get agent with settings
	const agentWithSettings = await context.query(session, {
		type: 'object',
		required: ['id'],
		properties: {
			id: {
				type: 'string',
				const: agent.id,
			},
		},
		$$links: {
			'has settings': {
				type: 'object',
			},
		},
	});

	// Create working-hours contract if necessary
	if (
		!agentHasSettings(agentWithSettings, {
			type: 'working-hours@1.0.0',
		})
	) {
		await createSettingsForAgent(session, context, agent, 'working-hours');
	}

	// Create agent-settings contract if necessary
	if (
		!agentHasSettings(agentWithSettings, {
			type: 'agent-settings@1.0.0',
		})
	) {
		await createSettingsForAgent(session, context, agent, 'agent-settings');
	}

	return {
		id: agent.id,
		type: agent.type,
		version: agent.version,
		slug: agent.slug,
	};
};

export const actionInitializeAgent: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-initialize-agent',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Initialize an agent',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {},
		},
	},
};

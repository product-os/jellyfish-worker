import { getLogger } from '@balena/jellyfish-logger';
import type {
	ContractDefinition,
	TypeContract,
} from '@balena/jellyfish-types/build/core';
import { strict as assert } from 'assert';
import _ from 'lodash';
import slugify from 'slugify';
import type { ActionDefinition } from '../plugin';
import type { ChannelContract } from '../types';

const logger = getLogger(__filename);

const capitalizeFirst = (str: string): string => {
	return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
};

// TS-TODO: the return type should be Partial<ViewContractDefinition>
const commonView = (
	channelContract: ChannelContract,
): Partial<ContractDefinition> => {
	return {
		version: '1.0.0',
		type: 'view@1.0.0',
		markers: ['org-balena'],
		tags: [],
		active: true,
		data: {
			namespace: channelContract.name,
		},
		requires: [],
		capabilities: [],
	};
};

const createViewAll = (
	channelContract: ChannelContract,
): Partial<ContractDefinition> => {
	const channelName = channelContract.name!.toLowerCase();
	return _.merge({}, commonView(channelContract), {
		slug: `view-all-${slugify(channelName)}`,
		name: `All ${channelName}`,
		data: {
			allOf: [channelContract.data.filter],
		},
	});
};

const createOwnedByMeView = (
	channelContract: ChannelContract,
): Partial<ContractDefinition> => {
	const channelName = channelContract.name!.toLowerCase();
	return _.merge({}, commonView(channelContract), {
		slug: `view-${slugify(channelName)}-owned-by-me`,
		name: `${capitalizeFirst(channelName)} owned by me`,
		data: {
			allOf: [
				channelContract.data.filter,
				{
					name: 'Contracts owned by me',
					schema: {
						type: 'object',
						$$links: {
							'is owned by': {
								type: 'object',
								properties: {
									type: {
										const: 'user@1.0.0',
									},
									id: {
										const: {
											$eval: 'user.id',
										},
									},
								},
							},
						},
					},
				},
			],
		},
	});
};

const createUnownedView = (
	channelContract: ChannelContract,
): Partial<ContractDefinition> => {
	const channelName = channelContract.name!.toLowerCase();
	return _.merge({}, commonView(channelContract), {
		slug: `view-unowned-${slugify(channelName)}`,
		name: `Unowned ${channelName}`,
		data: {
			allOf: [
				channelContract.data.filter,
				{
					name: 'Unowned contracts',
					schema: {
						type: 'object',
						not: {
							$$links: {
								'is owned by': {
									properties: {
										type: {
											const: 'user@1.0.0',
										},
									},
								},
							},
						},
					},
				},
			],
		},
	});
};

// TS-TODO: ActionFile should be generic so we can specify the contract data type
const handler: ActionDefinition['handler'] = async (
	session,
	context,
	contract,
	request,
) => {
	logger.info(request.logContext, `Bootstrapping channel '${contract.slug}'`);

	const viewTypeContract = await context.getCardBySlug(session, 'view@latest');
	assert(!!viewTypeContract, 'View type contract not found');

	const linkTypeContract = await context.getCardBySlug(session, 'link@latest');
	assert(!!linkTypeContract, 'Link type contract not found');

	// Create views based on the channel's base filter
	const views = [
		createViewAll(contract as ChannelContract),
		createOwnedByMeView(contract as ChannelContract),
		createUnownedView(contract as ChannelContract),
	];

	await Promise.all(
		views.map(async (viewContractBase: any) => {
			// Save the view contract
			let viewContract = await context.replaceCard(
				session,
				viewTypeContract as TypeContract,
				{
					timestamp: request.timestamp,
					actor: request.actor,
					originator: request.originator,
					attachEvents: true,
				},
				viewContractBase,
			);

			// If the view contract already exists and no changes were made, replaceCard returns null,
			// so we just fetch the contract by slug.
			if (viewContract === null) {
				viewContract = await context.getCardBySlug(
					session,
					`${viewContractBase.slug}@${viewContractBase.version}`,
				);
			}
			assert(!!viewContract, 'View contract is null');

			// And create a link contract between the view and the channel
			return context.replaceCard(
				session,
				linkTypeContract as TypeContract,
				{
					timestamp: request.timestamp,
					actor: request.actor,
					originator: request.originator,
					attachEvents: false,
				},
				{
					slug: `link-${viewContract.id}-is-attached-to-${contract.id}`,
					type: 'link@1.0.0',
					name: 'is attached to',
					data: {
						inverseName: 'has attached element',
						from: {
							id: viewContract.id,
							type: viewContract.type,
						},
						to: {
							id: contract.id,
							type: contract.type,
						},
					},
				},
			);
		}),
	);

	const result = contract;

	return {
		id: result.id,
		type: result.type,
		version: result.version,
		slug: result.slug,
	};
};

export const actionBootstrapChannel: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-bootstrap-channel',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Bootstrap a channel',
		data: {
			filter: {
				type: 'object',
				properties: {
					type: {
						type: 'string',
						const: 'channel@1.0.0',
					},
				},
				required: ['type'],
			},
			arguments: {},
		},
	},
};

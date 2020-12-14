/*
 * Copyright (C) Balena.io - All Rights Reserved
 * Unauthorized copying of this file, via any medium is strictly prohibited.
 * Proprietary and confidential.
 */

import { v4 as uuid } from 'uuid';
import coreMixins = require('@balena/jellyfish-core/lib/cards/mixins');
import PluginDefault = require('@balena/jellyfish-plugin-default');
import ActionLibrary = require('@balena/jellyfish-action-library');

import { PluginManager } from '@balena/jellyfish-plugin-base';

const context = {
	id: 'jellyfish-integration-test',
};

const pluginManager = new PluginManager(context, {
	plugins: [PluginDefault as any, ActionLibrary as any],
});

export const loadDefaultCards = () => {
	// TS-TODO: correctly type this
	return pluginManager.getCards(context, coreMixins as any);
};

export const loadCards = () => {
	const allCards: any = loadDefaultCards();
	allCards['action-test-originator'] = Object.assign(
		{},
		allCards['action-create-card'],
		{
			slug: 'action-test-originator',
		},
	);
	return allCards;
};

export const loadSyncIntegrations = () => {
	return pluginManager.getSyncIntegrations(context);
};

export const loadActions = () => {
	const allActions = pluginManager.getActions(context);
	Object.assign(allActions, {
		'action-test-originator': {
			handler: async (session: string, ctx: any, card: any, request: any) => {
				request.arguments.properties.data =
					request.arguments.properties.data || {};
				request.arguments.properties.data.originator = request.originator;
				return allActions['action-create-card'].handler(
					session,
					ctx,
					card,
					request,
				);
			},
		},
	});
	return allActions;
};

export const generateRandomID = (): string => {
	return uuid();
};

export const generateRandomSlug = (
	options: { prefix?: string } = {},
): string => {
	const slug = generateRandomID();
	if (options.prefix) {
		return `${options.prefix}-${slug}`;
	}

	return slug;
};

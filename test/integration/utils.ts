import { ActionLibrary } from '@balena/jellyfish-action-library';
import { cardMixins } from '@balena/jellyfish-core';
import { PluginManager } from '@balena/jellyfish-plugin-base';
import { DefaultPlugin } from '@balena/jellyfish-plugin-default';
import { v4 as uuid } from 'uuid';

const logContext = {
	id: 'jellyfish-integration-test',
};

const pluginManager = new PluginManager(logContext, {
	plugins: [DefaultPlugin as any, ActionLibrary as any],
});

export const loadDefaultCards = () => {
	return pluginManager.getCards(logContext, cardMixins);
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
	return pluginManager.getSyncIntegrations(logContext);
};

export const loadActions = () => {
	const allActions = pluginManager.getActions(logContext);
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

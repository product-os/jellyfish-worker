import { getLogger, LogContext } from '@balena/jellyfish-logger';
import _ from 'lodash';
import semver from 'semver';
import type { ContractBuilderMap, Plugin, PluginDefinition } from './plugin';

const logger = getLogger(__filename);

const validateDependencies = (plugins: JellyfishPlugins) => {
	_.forEach(plugins, (plugin) => {
		_.forEach(plugin.requires, ({ slug, version }) => {
			const dependency = plugins[slug];
			if (!semver.validRange(version)) {
				throw new Error(
					`Cannot load plugin '${plugin.slug}' (${plugin.name}) ` +
						`because it specifies an invalid version (${version}) for the dependency on '${slug}'`,
				);
			}
			if (!dependency) {
				throw new Error(
					`Cannot load plugin '${plugin.slug}' (${plugin.name}) ` +
						`because a plugin it depends on (${slug}) is not loaded`,
				);
			} else if (
				!semver.satisfies(dependency.version, version, {
					includePrerelease: true,
				})
			) {
				throw new Error(
					`Cannot load plugin '${plugin.slug}' (${plugin.name}) ` +
						`because a plugin it depends on (${slug}@${version}) is not loaded`,
				);
			}
		});
	});
};

const loadPlugins = (plugins: JellyfishPluginConstructor[]) => {
	const allPlugins = _.reduce<JellyfishPluginConstructor, JellyfishPlugins>(
		plugins,
		(acc, Plugin: JellyfishPluginConstructor) => {
			const loadedPlugin = new Plugin();
			if (loadedPlugin) {
				if (acc[loadedPlugin.slug]) {
					throw new Error(
						`Cannot load plugin '${loadedPlugin.slug}' (${
							loadedPlugin.name
						}) because a plugin with that slug (${
							acc[loadedPlugin.slug].name
						}) has already been loaded`,
					);
				}
				acc[loadedPlugin.slug] = loadedPlugin;
			}
			return acc;
		},
		{},
	);
	validateDependencies(allPlugins);
	return allPlugins;
};

const validatedAddToMap = <T>(
	logContext: LogContext,
	plugin: Plugin,
	pluginItems: Map<T>,
	consolidatedItems: Map<T>,
	itemName: string,
) => {
	_.each(pluginItems, (item: T, slug: string) => {
		if (consolidatedItems[slug]) {
			const errorMessage = `${itemName} '${slug}' already exists and cannot be loaded from plugin '${plugin.name}'`;
			logger.error(logContext, errorMessage);
			throw new Error(errorMessage);
		}

		consolidatedItems[slug] = item;
	});
};

export class PluginManager {
	private plugins: JellyfishPlugins;

	constructor(logContext: LogContext, options: PluginDefinition) {
		try {
			this.plugins = loadPlugins(options.plugins);
		} catch (err: any) {
			logger.error(logContext, err.message);
			throw err;
		}
	}

	getCards(logContext: LogContext, mixins: CoreMixins) {
		return _.reduce<JellyfishPlugins, ContractBuilderMap>(
			this.plugins,
			(carry, plugin) => {
				if (plugin.getCards) {
					const pluginCards = plugin.getCards(logContext, mixins);
					validatedAddToMap(logContext, plugin, pluginCards, carry, 'Card');
				}
				return carry;
			},
			{},
		);
	}

	getSyncIntegrations(logContext: LogContext) {
		return _.reduce<JellyfishPlugins, Integrations>(
			this.plugins,
			(carry, plugin) => {
				if (plugin.getSyncIntegrations) {
					const pluginIntegrations = plugin.getSyncIntegrations(logContext);
					validatedAddToMap(
						logContext,
						plugin,
						pluginIntegrations,
						carry,
						'Integration',
					);
				}
				return carry;
			},
			{},
		);
	}

	getActions(logContext: LogContext) {
		return _.reduce<JellyfishPlugins, ActionMap>(
			this.plugins,
			(carry, plugin) => {
				if (plugin.getActions) {
					const pluginActions = plugin.getActions(logContext);
					validatedAddToMap(logContext, plugin, pluginActions, carry, 'Action');
				}
				return carry;
			},
			{},
		);
	}
}

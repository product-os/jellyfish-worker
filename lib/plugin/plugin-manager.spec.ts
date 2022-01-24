import _ from 'lodash';
import {
	action1,
	action2,
	card1,
	card2,
	integration1,
	integration2,
	testPlugin,
} from './helpers';
import { PluginManager } from '.';

describe('PluginManager', () => {
	describe('validates plugins', () => {
		test('by throwing an exception if you try and load two plugins with the same slug', () => {
			const getPluginManager = () =>
				new PluginManager([testPlugin(), testPlugin()]);
			expect(getPluginManager).toThrow('Duplicate plugin: plugin-test');
		});

		test('by throwing an exception if a plugin requires another plugin that is not provided', () => {
			const getPluginManager = () =>
				new PluginManager([
					testPlugin({
						slug: 'plugin-test-2',
						name: 'Test plugin 2',
						requires: [
							{
								slug: 'plugin-test-1',
								version: '^2.0.0',
							},
						],
					}),
				]);
			expect(getPluginManager).toThrow(
				"Cannot load plugin 'plugin-test-2' (Test plugin 2) because a plugin it depends on (plugin-test-1) is not loaded",
			);
		});

		test('by throwing an exception if a plugin requires a version of another plugin that is not provided', () => {
			const getPluginManager = () =>
				new PluginManager([
					testPlugin({
						slug: 'plugin-test-1',
						name: 'Test plugin 1',
						version: '1.0.0',
					}),
					testPlugin({
						slug: 'plugin-test-2',
						name: 'Test plugin 2',
						requires: [
							{
								slug: 'plugin-test-1',
								version: '^2.0.0',
							},
						],
					}),
				]);
			expect(getPluginManager).toThrow(
				"Cannot load plugin 'plugin-test-2' (Test plugin 2) " +
					'because a plugin it depends on (plugin-test-1@^2.0.0) is not loaded',
			);
		});

		test('but will not throw an exception if a plugin requires a version of another plugin that is provided', () => {
			const getPluginManager = () =>
				new PluginManager([
					testPlugin({
						slug: 'plugin-test-1',
						name: 'Test plugin 1',
						version: '1.1.0',
					}),
					testPlugin({
						slug: 'plugin-test-2',
						name: 'Test plugin 2',
						requires: [
							{
								slug: 'plugin-test-1',
								version: '^1.0.0',
							},
						],
					}),
				]);
			expect(getPluginManager).not.toThrow();
		});

		test('but will not throw an exception if a plugin requires a version of another plugin that is provided as a beta version', () => {
			const getPluginManager = () =>
				new PluginManager([
					testPlugin({
						slug: 'plugin-test-1',
						name: 'Test plugin 1',
						version: '1.0.1-beta-1',
					}),
					testPlugin({
						slug: 'plugin-test-2',
						name: 'Test plugin 2',
						requires: [
							{
								slug: 'plugin-test-1',
								version: '^1.0.0',
							},
						],
					}),
				]);
			expect(getPluginManager).not.toThrow();
		});
	});

	describe('.getCards', () => {
		test('returns an empty object if no cards are supplied to any of the plugins', () => {
			const pluginManager = new PluginManager([
				testPlugin({ slug: 'plugin-test-1' }),
				testPlugin({ slug: 'plugin-test-2' }),
			]);
			const cards = pluginManager.getCards();
			expect(cards).toEqual({});
		});

		test('will throw an exception if different plugins contain duplicate card slugs', () => {
			const pluginManager = new PluginManager([
				testPlugin({
					slug: 'plugin-test-1',
					name: 'Test Plugin 1',
					contracts: [card1],
				}),
				testPlugin({
					slug: 'plugin-test-2',
					name: 'Test Plugin 2',
					contracts: [Object.assign({}, card2, { slug: card1.slug })],
				}),
			]);
			const getCards = () => pluginManager.getCards();

			expect(getCards).toThrow(
				"'card-1' already exists and cannot be loaded from plugin 'plugin-test-2'",
			);
		});

		test('returns a dictionary of cards, keyed by slug', () => {
			const pluginManager = new PluginManager([
				testPlugin({
					contracts: [card1, card2],
				}),
			]);

			const cards = pluginManager.getCards();
			expect(cards).toEqual({
				'card-1': card1,
				'card-2': card2,
			});
		});
	});

	describe('.getSyncIntegrations', () => {
		test('returns an empty object if no integrations are supplied to any of the plugins', () => {
			const pluginManager = new PluginManager([
				testPlugin({ slug: 'plugin-test-1' }),
				testPlugin({ slug: 'plugin-test-2' }),
			]);
			const loadedIntegrations = pluginManager.getSyncIntegrations();
			expect(loadedIntegrations).toEqual({});
		});

		test('returns a dictionary of integrations keyed by slug', () => {
			const pluginManager = new PluginManager([
				testPlugin({
					slug: 'plugin-test-1',
					integrationMap: { integration1 },
				}),
				testPlugin({
					slug: 'plugin-test-2',
					integrationMap: { integration2 },
				}),
			]);

			const loadedIntegrations = pluginManager.getSyncIntegrations();

			expect(loadedIntegrations).toEqual({
				integration1,
				integration2,
			});
		});
	});

	describe('.getActions', () => {
		test('returns an empty object if no actions are supplied to any of the plugins', () => {
			const pluginManager = new PluginManager([
				testPlugin({ slug: 'plugin-test-1' }),
				testPlugin({ slug: 'plugin-test-2' }),
			]);
			const loadedActions = pluginManager.getActions();
			expect(loadedActions).toEqual({});
		});

		test('will throw an exception if duplicate action slugs are found', () => {
			const pluginManager = new PluginManager([
				testPlugin({
					slug: 'plugin-test-1',
					name: 'Test Plugin 1',
					actions: [action1],
				}),
				testPlugin({
					slug: 'plugin-test-2',
					name: 'Test Plugin 2',
					actions: [
						Object.assign({}, action2, {
							contract: {
								slug: action1.contract.slug,
							},
						}),
					],
				}),
			]);

			const getActions = () => pluginManager.getActions();

			expect(getActions).toThrow(
				"'action-1' already exists and cannot be loaded from plugin 'plugin-test-2'",
			);
		});

		test('returns a dictionary of actions keyed by slug', () => {
			const pluginManager = new PluginManager([
				testPlugin({
					slug: 'plugin-test-1',
					actions: [action1],
				}),
				testPlugin({
					slug: 'plugin-test-2',
					actions: [action2],
				}),
			]);

			const loadedActions = pluginManager.getActions();

			expect(loadedActions).toEqual({
				'action-1': _.omit(action1, ['contract']),
				'action-2': _.omit(action2, ['contract']),
			});
		});
	});
});

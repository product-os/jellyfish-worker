import _ from 'lodash';
import { PluginManager } from '../lib/plugin-manager';
import {
	action1,
	action2,
	card1,
	card2,
	integration1,
	integration2,
	TestPlugin,
} from './plugin-fixtures';

describe('PluginManager', () => {
	describe('validates plugins', () => {
		test('by throwing an exception if you try and load two plugins with the same slug', () => {
			const getPluginManager = () =>
				new PluginManager([() => new TestPlugin(), () => new TestPlugin()]);
			expect(getPluginManager).toThrow(
				"Cannot load plugin 'test-plugin-1' (Test plugin 2) " +
					'because a plugin with that slug (Test plugin 1) has already been loaded',
			);
		});

		test('by throwing an exception if a plugin requires another plugin that is not provided', () => {
			const getPluginManager = () =>
				new PluginManager([
					() =>
						new TestPlugin({
							slug: 'test-plugin-2',
							name: 'Test plugin 2',
							requires: [
								{
									slug: 'test-plugin-1',
									version: '^2.0.0',
								},
							],
						}),
				]);
			expect(getPluginManager).toThrow(
				"Cannot load plugin 'test-plugin-2' (Test plugin 2) " +
					'because a plugin it depends on (test-plugin-1) is not loaded',
			);
		});

		test('by throwing an exception if a plugin requires a version of another plugin that is not provided', () => {
			const getPluginManager = () =>
				new PluginManager([
					() =>
						new TestPlugin({
							slug: 'test-plugin-1',
							name: 'Test plugin 1',
							version: '1.0.0',
						}),
					() =>
						new TestPlugin({
							slug: 'test-plugin-2',
							name: 'Test plugin 2',
							requires: [
								{
									slug: 'test-plugin-1',
									version: '^2.0.0',
								},
							],
						}),
				]);
			expect(getPluginManager).toThrow(
				"Cannot load plugin 'test-plugin-2' (Test plugin 2) " +
					'because a plugin it depends on (test-plugin-1@^2.0.0) is not loaded',
			);
		});

		test('but will not throw an exception if a plugin requires a version of another plugin that is provided', () => {
			const getPluginManager = () =>
				new PluginManager([
					() =>
						new TestPlugin({
							slug: 'test-plugin-1',
							name: 'Test plugin 1',
							version: '1.1.0',
						}),
					() =>
						new TestPlugin({
							slug: 'test-plugin-2',
							name: 'Test plugin 2',
							requires: [
								{
									slug: 'test-plugin-1',
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
					() =>
						new TestPlugin({
							slug: 'test-plugin-1',
							name: 'Test plugin 1',
							version: '1.0.1-beta-1',
						}),
					() =>
						new TestPlugin({
							slug: 'test-plugin-2',
							name: 'Test plugin 2',
							requires: [
								{
									slug: 'test-plugin-1',
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
				() => new TestPlugin({ slug: 'test-plugin-1' }),
				() => new TestPlugin({ slug: 'test-plugin-2' }),
			]);
			const cards = pluginManager.getCards();
			expect(cards).toEqual({});
		});

		test('will throw an exception if different plugins contain duplicate card slugs', () => {
			const pluginManager = new PluginManager([
				() =>
					new TestPlugin({
						slug: 'test-plugin-1',
						name: 'Test Plugin 1',
						contracts: [card1],
					}),
				() =>
					new TestPlugin({
						slug: 'test-plugin-2',
						name: 'Test Plugin 2',
						contracts: [Object.assign({}, card2, { slug: card1.slug })],
					}),
			]);
			const getCards = () => pluginManager.getCards();

			expect(getCards).toThrow(
				"Card 'card-1' already exists and cannot be loaded from plugin 'Test Plugin 2'",
			);
		});

		test('returns a dictionary of cards, keyed by slug', () => {
			const pluginManager = new PluginManager([
				() =>
					new TestPlugin({
						contracts: [
							// Cards can be passed in as objects:
							card1,
							// ...or as a function that returns a card
							({ mixin }) => mixin()(card2),
						],
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
				() => new TestPlugin({ slug: 'test-plugin-1' }),
				() => new TestPlugin({ slug: 'test-plugin-2' }),
			]);
			const loadedIntegrations = pluginManager.getSyncIntegrations();
			expect(loadedIntegrations).toEqual({});
		});

		test('returns a dictionary of integrations keyed by slug', () => {
			const pluginManager = new PluginManager([
				() =>
					new TestPlugin({
						slug: 'test-plugin-1',
						integrationMap: { [integration1.slug]: integration1 },
					}),

				() =>
					new TestPlugin({
						slug: 'test-plugin-2',
						integrationMap: { [integration2.slug]: integration2 },
					}),
			]);

			const loadedIntegrations = pluginManager.getSyncIntegrations();

			expect(loadedIntegrations).toEqual({
				'integration-1': integration1,
				'integration-2': integration2,
			});
		});
	});

	describe('.getActions', () => {
		test('returns an empty object if no actions are supplied to any of the plugins', () => {
			const pluginManager = new PluginManager([
				() => new TestPlugin({ slug: 'test-plugin-1' }),
				() => new TestPlugin({ slug: 'test-plugin-2' }),
			]);
			const loadedActions = pluginManager.getActions();
			expect(loadedActions).toEqual({});
		});

		test('will throw an exception if duplicate action slugs are found', () => {
			const pluginManager = new PluginManager([
				() =>
					new TestPlugin({
						slug: 'test-plugin-1',
						name: 'Test Plugin 1',
						actions: [action1],
					}),
				() =>
					new TestPlugin({
						slug: 'test-plugin-2',
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
				"Action 'action-1' already exists and cannot be loaded from plugin 'Test Plugin 2'",
			);
		});

		test('returns a dictionary of actions keyed by slug', () => {
			const pluginManager = new PluginManager([
				() =>
					new TestPlugin({
						slug: 'test-plugin-1',
						actions: [action1],
					}),

				() =>
					new TestPlugin({
						slug: 'test-plugin-2',
						actions: [action2],
					}),
			]);

			const loadedActions = pluginManager.getActions();

			expect(loadedActions).toEqual({
				'action-1': {
					handler: action1.handler,
					pre: action1.pre || _.noop,
				},
				'action-2': {
					handler: action2.handler,
					pre: action2.pre || _.noop,
				},
			});
		});
	});
});

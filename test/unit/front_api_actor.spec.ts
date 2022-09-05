import _ from 'lodash';
import { patchIfNeeded } from '../../lib/sync/instance';

describe('front api user', () => {
	it('should patch an event from a front api user', async () => {
		const info = {
			handle: 'front_api_jwt_23m3',
			email: 'api_jwt_23m3@resin_io',
			name: {
				first: 'API',
				last: '',
			},
		};
		patchIfNeeded(info);
		expect(info.email).toEqual('front.api+jwt_23m3@resin.io');
		expect(info.name.first).toEqual('Front');
		expect(info.name.last).toEqual('API');

		info.email = 'api_jwt_ 23m3@resin_io';
		patchIfNeeded(info);
		expect(info.email).toEqual('front.api+jwt_23m3@resin.io');

		info.email = 'api_jwt_2@#3m3@resin_io';
		patchIfNeeded(info);
		expect(info.email).toEqual('front.api+jwt_2#3m3@resin.io');
	});
});

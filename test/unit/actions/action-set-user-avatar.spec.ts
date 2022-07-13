import md5 from 'blueimp-md5';
import nock from 'nock';
import { v4 as uuidv4 } from 'uuid';
import {
	generateURL,
	gravatarExists,
	GRAVATAR_URL,
} from '../../../lib/actions/action-set-user-avatar';

/**
 * Generate random email address
 * @function
 *
 * @returns random email address
 */
function genEmail(): string {
	return `${uuidv4()}@foo.bar`;
}

describe('generateURL()', () => {
	test('should generate a valid Gravatar URL', () => {
		const email = 'user@example.com';
		expect(generateURL(email)).toEqual(
			`${GRAVATAR_URL + md5(email.trim())}?d=404`,
		);
	});
});

describe('gravatarExists()', () => {
	test('should return true on existing Gravatar URL', async () => {
		const email = genEmail();
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(email.trim())}?d=404`, 'HEAD')
			.reply(200, 'OK');

		expect(await gravatarExists(generateURL(email))).toBeTruthy();
	});

	test('should return false on non-existing Gravatar URL', async () => {
		const email = genEmail();
		nock('https://www.gravatar.com')
			.intercept(`/avatar/${md5(email.trim())}?d=404`, 'HEAD')
			.reply(404, '');

		expect(await gravatarExists(generateURL(email))).toBeFalsy();
	});
});

import * as assert from '@balena/jellyfish-assert';
import { defaultEnvironment } from '@balena/jellyfish-environment';
import type { TypeContract } from 'autumndb';
import { add, sub } from 'date-fns';
import { google } from 'googleapis';
import { has } from 'lodash';
import type { GoogleMeetCredentials } from '../../lib/types';
import * as errors from '../errors';
import type { ActionDefinition } from '../plugin';

const CALENDAR_ID = 'primary';
const GOOGLE_CALENDAR_API_VERSION = 'v3';

const handler: ActionDefinition['handler'] = async (
	session,
	context,
	card,
	request,
) => {
	const credentials: GoogleMeetCredentials = JSON.parse(
		defaultEnvironment.integration['google-meet'].credentials,
	);
	const auth = new google.auth.GoogleAuth({
		projectId: credentials.project_id,
		credentials: {
			client_email: credentials.client_email,
			private_key: credentials.private_key,
		},
		clientOptions: {
			clientId: credentials.client_id,

			// `subject` required to impersonate real account using service account
			// (neccessary for creating events with meet URLs)
			// Currently using same credentials as Hubot
			subject: 'hubot@balena.io',
		},
		scopes: ['https://www.googleapis.com/auth/calendar'],
	});
	const authClient = await auth.getClient();

	const calendarAPI = google.calendar({
		auth: authClient,
		version: GOOGLE_CALENDAR_API_VERSION,
	});

	// The event meeting time is not particularly important as we'll delete it immediately
	const startTime = sub(new Date(), {
		days: 10,
	});
	const endTime = add(startTime, {
		hours: 1,
	});

	const event = await calendarAPI.events.insert({
		calendarId: CALENDAR_ID,
		conferenceDataVersion: 1,
		requestBody: {
			summary: 'Jellyfish Generated Meet',
			end: {
				dateTime: endTime.toISOString(),
			},
			start: {
				dateTime: startTime.toISOString(),
			},
			conferenceData: {
				createRequest: {
					requestId: startTime.valueOf().toString(),
					conferenceSolutionKey: {
						type: 'hangoutsMeet',
					},
				},
			},
		},
	});

	if (!event.data.hangoutLink) {
		throw new Error("Meet/Hangout Link not found in the event's body");
	}

	if (event.data.id) {
		await calendarAPI.events.delete({
			calendarId: CALENDAR_ID,
			eventId: event.data.id,
		});
	}

	const conferenceUrl = event.data.hangoutLink;

	const typeCard = (await context.getCardBySlug(
		session,
		`${card.type}@latest`,
	))! as TypeContract;

	assert.INTERNAL(
		request.logContext,
		typeCard,
		errors.WorkerNoElement,
		`No such type: ${card.type}`,
	);

	const patchResult = await context.patchCard(
		context.privilegedSession,
		typeCard,
		{
			timestamp: request.timestamp,
			actor: request.actor,
			originator: request.originator,
			reason: `Google Meet created: [join here](${conferenceUrl})`,
			attachEvents: true,
		},
		card,
		[
			{
				op: has(card, ['data', 'conferenceUrl']) ? 'replace' : 'add',
				path: '/data/conferenceUrl',
				value: conferenceUrl,
			},
		],
	);

	if (!patchResult) {
		return null;
	}

	return {
		id: patchResult.id,
		type: patchResult.type,
		slug: patchResult.slug,
		version: patchResult.version,
		conferenceUrl,
	};
};

export const actionGoogleMeet: ActionDefinition = {
	handler,
	contract: {
		slug: 'action-google-meet',
		version: '1.0.0',
		type: 'action@1.0.0',
		name: 'Create a Google Meet link',
		data: {
			filter: {
				type: 'object',
			},
			arguments: {},
		},
	},
};

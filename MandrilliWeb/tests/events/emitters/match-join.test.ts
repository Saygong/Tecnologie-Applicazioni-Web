import { Socket } from 'ngx-socket-io';

import {
    injectSocketIoClient,
    joinMatch,
    leaveChat,
    leaveMatch,
} from '../../fixtures/socket-io-client';
import { MatchJoinedEmitter } from '../../../src/app/core/events/emitters/match-joined';
import { MatchLeftEmitter } from '../../../src/app/core/events/emitters/match-left';

let client: Socket;

// It should work with any string, since the matchId required is really
// just an identifier for the socket.io server room.
const matchIdToJoin: string = 'any-match-id';

beforeEach(() => {
    client = injectSocketIoClient();
});

describe('Join Match', () => {
    test('Should Not Throw', () => {
        joinMatch(matchIdToJoin, client);
    });

    test('Event Name Should Be "match-joined"', () => {
        const matchJoinedEmitter: MatchJoinedEmitter = new MatchJoinedEmitter(client);

        expect(matchJoinedEmitter.eventName).toBe('match-joined');
    });
});

describe('Join And Leave Chat', () => {
    test('Should Not Throw', () => {
        joinMatch(matchIdToJoin, client);

        leaveMatch(matchIdToJoin, client);
    });

    test('Event Name Should Be "match-left"', () => {
        const matchLeftEmitter: MatchLeftEmitter = new MatchLeftEmitter(client);

        expect(matchLeftEmitter.eventName).toBe('match-left');
    });
});
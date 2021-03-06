import * as http from 'http';
import { createHttpTerminator, HttpTerminator } from 'http-terminator';

import * as io from 'socket.io';
import * as ioClient from 'socket.io-client';
import { Types } from 'mongoose';
import chalk from 'chalk';

import { MatchmakingEngine } from '../../src/matchmaking/matchmaking-engine';
import { EngineAlreadyStoppedError } from '../../src/matchmaking/engine-errors';
import { UserDocument } from '../../src/model/database/user/user';
import { deleteMultipleUsers, insertMultipleUsers } from '../fixtures/users';
import { ServerJoinedListener } from '../../src/events/client-listeners/server-joined';
import { MatchData } from '../../src/model/events/match-data';
import {
    insertMatchmakingEntry,
    removeMultipleMatchmakingEntries,
} from '../../src/model/database/matchmaking/queue-entry';

// Run test server locally on a different port than that of the actual server
const serverPort: number = parseInt(process.env.PORT, 10) + 1;
const serverHost: string = 'localhost';
const ioClientConnectionString: string = `http://${serverHost}:${serverPort}`;

let httpServer: http.Server;
let serverTerminator: HttpTerminator;
let ioServer: io.Server;
let engine: MatchmakingEngine;
const enginePollingTimeMs: number = 1000;
const verboseLog: boolean = true;

/**
 * Create http and socket.io servers.
 * Also create matchmaking engine and setup jest to user real timers
 */
const baseSetup = async () => {
    httpServer = http.createServer();
    serverTerminator = createHttpTerminator({
        server: httpServer,
    });

    ioServer = new io.Server(httpServer);

    httpServer.listen(serverPort, serverHost, () => {
        console.log(chalk.bgBlue(`Started test http server at ${ioClientConnectionString}`));
    });

    engine = new MatchmakingEngine(ioServer, enginePollingTimeMs, verboseLog);

    jest.useRealTimers();
};

/**
 * Teardown http and socket.io servers.
 * Also stop matchmaking engine and tell jest clear all timers
 */
const baseTeardown = async (): Promise<void> => {
    await serverTerminator.terminate();
    ioServer.close();

    try {
        engine.stop();
    } catch (err) {
        if (err instanceof EngineAlreadyStoppedError) {
            console.log('Engine already stopped');
        }
    }

    jest.clearAllTimers();
};

describe('Engine Start and Stop', () => {
    beforeEach(async () => {
        await baseSetup();
    });

    afterEach(async () => {
        await baseTeardown();
    });

    test('Should Not Throw', (done) => {
        expect(() => {
            engine.start();

            setTimeout(() => {
                engine.stop();

                // Make sure that no errors are thrown after stop
                setTimeout(() => {
                    done();
                }, 10000);
            }, enginePollingTimeMs * 5);
        }).not.toThrow();
    });
});

describe('Match arrangements', () => {
    const oddNumberOfUsers: number = 7;
    let oddUsers: UserDocument[];
    let clients: ioClient.Socket[] = [];

    /**
     * Create all the users, each with its respective socket.io client,
     * and join the server
     */
    beforeEach(async () => {
        await baseSetup();

        // Need to register the client on the server so that events
        // can be sent to the specific user
        let serverJoinedEvName: string = null;
        ioServer.on('connection', (client: io.Socket) => {
            console.log(chalk.bgGreen(`Client ${client.id} connected`));

            const serverJoined: ServerJoinedListener = new ServerJoinedListener(client, ioServer);
            serverJoined.listen();

            // Get the event name straight from the listener instead of hard coding the string
            // This should be less error prone
            serverJoinedEvName =
                serverJoinedEvName === null ? serverJoined.eventName : serverJoinedEvName;
        });

        // Insert an odd number of users so that one is left without an opponent
        oddUsers = await insertMultipleUsers(oddNumberOfUsers);
        oddUsers.forEach((u: UserDocument) => {
            console.log(chalk.bgMagenta('Connecting socket...'));

            const c: ioClient.Socket = ioClient.io(ioClientConnectionString);
            clients.push(c);

            c.on('connect', () => {
                // Join the server after connecting
                c.emit(serverJoinedEvName, {
                    userId: u._id.toString(),
                });
            });
        });
    });

    afterEach(async () => {
        await baseTeardown();

        clients.forEach((c: ioClient.Socket) => {
            c.close();
        });

        const userIds: Types.ObjectId[] = oddUsers.map((u: UserDocument) => u._id);
        await deleteMultipleUsers(userIds);

        // Delete all the entries that were created, if still there
        await removeMultipleMatchmakingEntries(userIds, true);
    });

    test('All Clients Except One Should Be Paired', (done) => {
        // Listen for match-found events
        // Since the number of users is odd, #users - 1 events should be fired,
        // because one player should not be paired
        let nEventsFired: number = 0;
        const nEventsThatShouldFire: number = oddNumberOfUsers - 1;
        clients.forEach((c: ioClient.Socket) => {
            c.on('match-found', (matchData: MatchData) => {
                nEventsFired++;
                console.log(chalk.bgYellow(`Match found`));

                if (nEventsFired === nEventsThatShouldFire) {
                    done();
                }
            });
        });

        // Start the engine and insert users in the matchmaking queue
        engine.start();

        oddUsers.forEach((u: UserDocument) => {
            insertMatchmakingEntry(u._id);
        });
    });
});

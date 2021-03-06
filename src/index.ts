import * as dotenv from 'dotenv';
import * as path from 'path';
import * as http from 'http';

import express, { Express } from 'express';
import cors from 'cors';
import * as io from 'socket.io';
import mongoose = require('mongoose');
import filter = require('content-filter');
import winston = require('winston');
import expressWinston = require('express-winston');
import chalk from 'chalk';

import { registerRoutes } from './routes/utils/register-routes';
import { MatchmakingEngine } from './matchmaking/matchmaking-engine';
import { ChatJoinedListener } from './events/client-listeners/chat-joined';
import { MatchJoinedListener } from './events/client-listeners/match-joined';
import { ServerJoinedListener } from './events/client-listeners/server-joined';
import { MatchRequestAcceptedListener } from './events/client-listeners/match-request-accepted';
import { FriendRequestAcceptedListener } from './events/client-listeners/friend-request-accepted';
import { ChatLeftListener } from './events/client-listeners/chat-left';
import { MatchLeftListener } from './events/client-listeners/match-left';
import { PlayerWonListener } from './events/client-listeners/player-won';
import { createUser, UserRoles, UserDocument } from './model/database/user/user';

// Remember that the runtime working dir is <root>/dist/src
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const app: Express = express();

/* Endpoints base url */
export const API_BASE_URL: string = '/api';

/* True if testing, false otherwise. Allows other modules to know if we're in testing mode */
export const IS_TESTING_MODE: boolean = process.env.TEST === 'true';

// If testing, set test db uri, else use the other
const dbUri: string = IS_TESTING_MODE ? process.env.TEST_DB_URI : process.env.DB_URI;
const serverPort: number = parseInt(process.env.PORT, 10);
const serverHost: string = process.env.HOST;

/* Database Connection */
console.log('Demanding the sauce...');
mongoose
    .connect(dbUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log('Sauce received!');
    })
    .catch((err) => {
        console.log('Error Occurred during Mongoose Connection');
        console.log(err);
    });

const httpServer: http.Server = http.createServer(app);
httpServer.listen(serverPort, serverHost, () => {
    console.log(`HTTP Server started on ${serverHost}:${serverPort}`);
});

/* Allows server to respond to a particular request that asks which request options it accepts */
app.use(cors());

/* Alternative to bodyparser which is deprecated */
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // To parse the incoming requests with JSON payloads

// Allow cross-origin
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    res.header('Access-Control-Allow-Methods', '*');
    next();
});

/* Sanitize input to avoid NoSQL injections */
app.use(filter({ methodList: ['GET', 'POST', 'PATCH', 'DELETE'] }));

/* Express Requests and Responses logger */
const verboseLogging: boolean = process.env.VERBOSE === 'true';
if (verboseLogging) {
    expressWinston.requestWhitelist.push('body');
    expressWinston.responseWhitelist.push('body');

    app.use(
        expressWinston.logger({
            transports: [new winston.transports.Console()],
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.json(),
                winston.format.prettyPrint({
                    colorize: true,
                })
            ),
            meta: true, // Enable logging of metadata
            msg: 'HTTP {{req.method}} {{req.url}} | {{res.statusCode}} {{res.responseTime}}ms',
        })
    );
}

/* Register express routes */
registerRoutes(app);

/* socket.io server setup */
export const ioServer: io.Server = new io.Server(httpServer, {
    cors: {
        methods: ['GET', 'POST'],
        credentials: false,
    },
});

ioServer.on('connection', async function (client: io.Socket) {
    console.log(chalk.bgGreen(`socket.io client ${client.id} connected`));

    client.on('disconnect', function () {
        console.log(chalk.bgRed(`socket.io client ${client.id} disconnected`));
    });

    /* Join listeners are being setup for each client.
     * They are important to make clients join specific rooms
     * so that the server can send events specifically to them.
     * This improves efficiency on both server and client side.
     */

    // A client joins its private room, so that the server has a way//
    // to send request specifically to him
    const serverJoined: ServerJoinedListener = new ServerJoinedListener(client, ioServer);
    serverJoined.listen();

    // A client joins/leaves a specific chat room
    const chatJoined: ChatJoinedListener = new ChatJoinedListener(client);
    chatJoined.listen();

    const chatLeft: ChatLeftListener = new ChatLeftListener(client);
    chatLeft.listen();

    // A client joins/leaves a specific match room
    const matchJoined: MatchJoinedListener = new MatchJoinedListener(client);
    matchJoined.listen();

    const matchLeft: MatchLeftListener = new MatchLeftListener(client, ioServer);
    matchLeft.listen();

    /* Other listeners for client events */

    // A client accepts a match request
    const matchReqAccepted: MatchRequestAcceptedListener = new MatchRequestAcceptedListener(
        client,
        ioServer
    );
    matchReqAccepted.listen();

    // A client accepts a friend request
    const friendReqAccepted: FriendRequestAcceptedListener = new FriendRequestAcceptedListener(
        client,
        ioServer
    );
    friendReqAccepted.listen();

    // A client wins a match
    const playerWon: PlayerWonListener = new PlayerWonListener(client, ioServer);
    playerWon.listen();
});

/* Start the matchmaking engine and tell him to try to look
 * for match arrangements every 1.5 seconds
 */
const queuePollingTimeMs: number = 1500;
const matchmakingEngine = new MatchmakingEngine(ioServer, queuePollingTimeMs);
matchmakingEngine.start();

/* Create Admin user */
createUser({
    username: process.env.ADMIN_USERNAME,
    roles: [UserRoles.Admin, UserRoles.Base, UserRoles.Moderator],
})
    .then((admin: UserDocument) => {
        admin.setPassword(process.env.ADMIN_PASSWORD).then(() => {
            return;
        });
    })
    .catch((err: Error) => console.log(chalk.yellow('Admin already existent')));

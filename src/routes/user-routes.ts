import { Types } from 'mongoose';
import { Router, Response } from 'express';

import * as usr from '../models/user/user';
import { UserStats } from '../models/user/user-stats';
import { authenticateToken } from './auth-routes';
import { retrieveUserId, retrieveId } from './utils/param-checking';
import { AuthenticatedRequest } from '../models/auth/authenticated-request';

interface UserEndpointLocals {
    userId: Types.ObjectId;
}

/**
 * Interface that models the response of a user endpoint
 */
interface UserEndpointResponse extends Response {
    locals: UserEndpointLocals;
}

interface UpdateStatsBody {
    elo: number;
    topElo: number;
    wins: number;
    losses: number;
    shipsDestroyed: number;
    totalHits: number;
    totalShots: number;
}

interface UpdateStatsRequest extends AuthenticatedRequest {
    body: UpdateStatsBody;
}

export const router = Router();
const userErr: string = 'No user with that identifier';
const usersErr: string = 'None of the given ids are present in the db';

router.get(
    '/users/:userId',
    authenticateToken,
    retrieveUserId,
    async (req: AuthenticatedRequest, res: UserEndpointResponse) => {
        let user: usr.UserDocument;
        const userId: Types.ObjectId = res.locals.userId;
        try {
            user = await usr.getUserById(userId);
            return res.status(201).json({
                userId: user._id,
                username: user.username,
                roles: user.roles,
                online: user.online,
            });
        } catch (err) {
            const statusCode: number = err.message === userErr ? 404 : 500;
            return res.status(statusCode).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: err.message,
                requestPath: req.path,
            });
        }
    }
);

interface UpdateUsernameBody {
    username: string;
}

interface UpdateUsernameRequest extends AuthenticatedRequest {
    body: UpdateUsernameBody;
}

router.put(
    '/users/:userId/username',
    authenticateToken,
    retrieveUserId,
    async (req: UpdateUsernameRequest, res: UserEndpointResponse) => {
        const { username } = req.body;

        const userId: Types.ObjectId = res.locals.userId;

        if (username) {
            try {
                await usr.updateUserName(userId, username);
                return res.status(200).json({ username });
            } catch (err) {
                const statusCode: number = err.message === userErr ? 404 : 500;
                return res.status(statusCode).json({
                    timestamp: Math.floor(new Date().getTime() / 1000),
                    errorMessage: err.message,
                    requestPath: req.path,
                });
            }
        } else {
            return res.status(400).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: 'Wrong parameters',
                requestPath: req.path,
            });
        }
    }
);

interface UpdatePasswordBody {
    password: string;
}

interface UpdatePasswordRequest extends AuthenticatedRequest {
    body: UpdatePasswordBody;
}

router.put(
    '/users/:userId/password',
    authenticateToken,
    retrieveUserId,
    async (req: UpdatePasswordRequest, res: UserEndpointResponse) => {
        const { password } = req.body;
        const userId: Types.ObjectId = res.locals.userId;
        if (password) {
            try {
                await usr.updatePassword(userId, password);
                return res.sendStatus(204);
            } catch (err) {
                const statusCode: number = err.message === userErr ? 404 : 500;
                return res.status(statusCode).json({
                    timestamp: Math.floor(new Date().getTime() / 1000),
                    errorMessage: err.message,
                    requestPath: req.path,
                });
            }
        } else {
            return res.status(400).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: 'Wrong parameters',
                requestPath: req.path,
            });
        }
    }
);

router.delete(
    '/users/:userId',
    authenticateToken,
    retrieveUserId,
    async (req: AuthenticatedRequest, res: UserEndpointResponse) => {
        const userId: Types.ObjectId = res.locals.userId;

        try {
            await usr.deleteUser(userId);
            return res.status(204).json();
        } catch (err) {
            const statusCode: number = err.message === userErr ? 404 : 500;
            return res.status(statusCode).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: err.message,
                requestPath: req.path,
            });
        }
    }
);

router.get(
    '/users/:userId/stats',
    authenticateToken,
    retrieveUserId,
    async (req: AuthenticatedRequest, res: UserEndpointResponse) => {
        const userId: Types.ObjectId = res.locals.userId;
        let stats: UserStats;
        try {
            stats = await usr.getUserStats(userId);
            return res.status(200).json({
                elo: stats.elo,
                topElo: stats.topElo,
                wins: stats.wins,
                losses: stats.losses,
                shipsDestroyed: stats.shipsDestroyed,
                totalShots: stats.totalShots,
                totalHits: stats.totalHits,
            });
        } catch (err) {
            const statusCode: number = err.message === userErr ? 404 : 500;
            return res.status(statusCode).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: err.message,
                requestPath: req.path,
            });
        }
    }
);

router.put(
    '/users/:userId/stats',
    authenticateToken,
    retrieveUserId,
    async (req: UpdateStatsRequest, res: UserEndpointResponse) => {
        const userId: Types.ObjectId = res.locals.userId;
        const { elo, topElo, wins, losses, shipsDestroyed, totalShots, totalHits } = req.body;

        try {
            await usr.updateUserStats(
                userId,
                elo,
                topElo,
                wins,
                losses,
                shipsDestroyed,
                totalShots,
                totalHits
            );
            return res
                .status(200)
                .json({ elo, topElo, wins, losses, shipsDestroyed, totalShots, totalHits });
        } catch (err) {
            const statusCode: number = err.message === userErr ? 404 : 500;

            return res.status(statusCode).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: err.message,
                requestPath: req.path,
            });
        }
    }
);

interface GetMultipleUsersBody {
    userIds: Types.ObjectId[];
}

interface GetMultipleUsersRequest extends AuthenticatedRequest {
    body: GetMultipleUsersBody;
}

router.get(
    '/users',
    authenticateToken,
    async (req: GetMultipleUsersRequest, res: UserEndpointResponse) => {
        let users: usr.UserDocument[];

        try {
            const userIdsQParam: string[] = (req.query.ids as string).split(',');
            const userObjIds: Types.ObjectId[] = userIdsQParam.map((uId) => {
                return retrieveId(uId);
            });

            users = await usr.getUsers(userObjIds);
            const results = users.map((x: usr.UserDocument) => {
                return {
                    userId: x._id,
                    username: x.username,
                    roles: x.roles,
                    online: x.online,
                };
            });

            return res.status(200).json({ users: results });
        } catch (err) {
            let statusCode: number = 404;
            if (err instanceof Error && err.message === usersErr) {
                statusCode = 500;
            } else {
                return res.status(statusCode).json({
                    timestamp: Math.floor(new Date().getTime() / 1000),
                    errorMessage: err.message,
                    requestPath: req.path,
                });
            }

            return res.status(statusCode).json({
                timestamp: Math.floor(new Date().getTime() / 1000),
                errorMessage: err.message,
                requestPath: req.path,
            });
        }
    }
);

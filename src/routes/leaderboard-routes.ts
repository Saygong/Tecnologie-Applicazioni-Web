import { Router, Response } from 'express';

import { getLeaderboard, UserDocument } from '../model/database/user/user';
import { authenticateToken } from './auth-routes';
import { AuthenticatedRequest } from './utils/authenticated-request';
import { skipLimitChecker } from './utils/param-checking';
import { toUnixSeconds } from './utils/date-utils';

export const router: Router = Router();

interface LeaderboardEndpointLocals {
    skip: number;
    limit: number;
}

/**
 * Interface that models the response of a user endpoint
 */
interface LeaderboardEndpointResponse extends Response {
    locals: LeaderboardEndpointLocals;
}

router.get(
    '/leaderboard',
    authenticateToken,
    skipLimitChecker,
    async (req: AuthenticatedRequest, res: LeaderboardEndpointResponse) => {
        try {
            // Skip and limit are set to -1 if not specified
            let skip: number = res.locals.skip;
            let limit: number = res.locals.limit;

            // Default values for skip and limit are 0 and 50
            if (skip === -1) {
                skip = 0;
            }

            if (limit === -1) {
                limit = 50;
            }

            const leaderBoard: UserDocument[] = await getLeaderboard(skip, limit);
            const nextPage = `${req.path}?skip=${skip + limit}&limit=${limit}`;

            const parsedLead = leaderBoard.map((x: UserDocument) => {
                return { userId: x._id, username: x.username, elo: x.stats.elo };
            });

            return res.status(200).json({ leaderboard: parsedLead, nextPage: nextPage });
        } catch (err) {
            const status: number = err.message === 'Invalid query parameters' ? 400 : 500;
            return res.status(status).json({
                timestamp: toUnixSeconds(new Date()),
                errorMessage: err.message,
                requestPath: req.path,
            });
        }
    }
);

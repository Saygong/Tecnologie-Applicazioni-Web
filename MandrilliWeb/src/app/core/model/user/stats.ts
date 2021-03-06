import { ApiUserStats } from '../api/user/stats';

export class UserStats implements ApiUserStats {
    elo: number;
    topElo: number;
    wins: number;
    losses: number;
    shipsDestroyed: number;
    totalShots: number;
    totalHits: number;
    rank: string;

    constructor(
        elo: number = 0,
        topElo: number = 0,
        wins: number = 0,
        losses: number = 0,
        shipsDestroyed: number = 0,
        totalShots: number = 0,
        totalHits: number = 0
    ) {
        this.elo = elo;
        this.topElo = topElo;
        this.wins = wins;
        this.losses = losses;
        this.shipsDestroyed = shipsDestroyed;
        this.totalShots = totalShots;
        this.totalHits = totalHits;
        this.rank = '';
    }
}

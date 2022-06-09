import { UserStats } from './../../../core/model/user/user-stats';
import { User } from './../../../core/model/user/user';
import { Component, OnInit, Input } from '@angular/core';
import { getRank } from 'src/app/core/model/user/elo-rankings';

@Component({
    selector: 'rank-overview',
    templateUrl: './rank-overview.component.html',
    styleUrls: ['./rank-overview.component.css'],
})
export class RankOverviewComponent implements OnInit {
    @Input() user: User = new User();
    public rank: string = '';
    public rankImageSrc: string = '';
    @Input() stats: UserStats = new UserStats();

    constructor() {}

    ngOnInit(): void {
        this.applyRank();
    }

    private applyRank() {
        this.rank = getRank(this.stats.elo);
        this.rankImageSrc = 'assets/images/' + this.rank + '.png';
    }
}

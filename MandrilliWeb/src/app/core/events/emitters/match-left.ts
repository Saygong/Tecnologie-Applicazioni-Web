import { Socket } from 'ngx-socket-io';
import { Injectable } from '@angular/core';

import { Emitter } from './base/emitter';
import { MatchData } from '../../model/events/match-data';
/**
 * Class that wraps socket.io functionality to generate a "match-left" event.
 * This allows the client to notify the server that it should stop sending data
 * about events of a specific match.
 */
@Injectable({
    providedIn: 'root',
})
export class MatchLeftEmitter extends Emitter<MatchData> {
    public constructor(client: Socket) {
        super(client, `match-left`);
    }
}

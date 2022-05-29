import { Socket } from 'socket.io';
import { ClientListener } from './base/client-listener';

interface ChatJoinData {
    chatId: string;
}

/**
 * Class that wraps Socket.io functionality to listen
 * to a 'chat-joined' client event.
 * Such event allows the client to join a Socket.io room for some
 * specific chat, so that he can listen only to messages of such chat.
 */
export class ChatJoinedListener extends ClientListener<ChatJoinData> {
    constructor(client: Socket) {
        super(client, 'chat-joined');
    }

    public listen() {
        super.listen((joinData: ChatJoinData): Promise<void> => {
            this.client.join(joinData.chatId);

            return Promise.resolve();
        });
    }
}

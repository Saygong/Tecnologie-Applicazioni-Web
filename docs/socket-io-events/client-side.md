# Socket.io Client-Side Events Documentation

## Table of Contents

- [Socket.io Client-Side Events Documentation](#socketio-client-side-events-documentation)
  - [Table of Contents](#table-of-contents)
  - [Resources](#resources)
    - [ServerJoinData](#serverjoindata)
    - [ChatJoinData](#chatjoindata)
    - [MatchJoinData](#matchjoindata)
    - [MatchLeftData](#matchleftdata)
    - [RequestAcceptedData](#requestaccepteddata)
    - [PlayerWonData](#playerwondata)
  - [Events](#events)
    - [Join Server](#join-server)
    - [Join Chat](#join-chat)
    - [Leave Chat](#leave-chat)
    - [Join Match](#join-match)
    - [Leave Match](#leave-match)
    - [Friend Request Accepted](#friend-request-accepted)
    - [Match Request Accepted](#match-request-accepted)
    - [Player Won](#player-won)

<style>
table th:first-of-type {
    width: 20%;
}
table th:nth-of-type(2) {
    width: 40%;
}
table th:nth-of-type(3) {
    width: 40%;
}
</style>

## Resources

### ServerJoinData

| Attribute | Data Type | Description |
| :-------- | :-------- | :---------- |
| userId | string | Id of the user that joined the server |

### ChatJoinData

| Attribute | Data Type | Description |
| :-------- | :-------- | :---------- |
| chatId | string | Id of the chat to join |

### MatchJoinData

| Attribute | Data Type | Description |
| :-------- | :-------- | :---------- |
| matchId | string | Id of the match to join |
| userId | string | Id of the user that is joining the match |
| joinReason | string | Reason why the user is joining the match (e.g. spectator, player) |

### MatchLeftData

| Attribute | Data Type | Description |
| :-------- | :-------- | :---------- |
| matchId | string | Id of the match to leave |
| userId | string | Id of the user that is leaving the match |

### RequestAcceptedData

| Attribute | Data Type | Description |
| :-------- | :-------- | :---------- |
| senderId | string | Id of player that sent the request |
| receiverId | string | Id of player that received the request |

### PlayerWonData

| Attribute | Data Type | Description |
| :-------- | :-------- | :---------- |
| winnerId | string | Id of the player that won the game |
| matchId | string | Id of the match that the player won |

## Events

### Join Server

| Event name | Description | Event Data |
| :--------- | :---------- | :--------- |
| server-joined | When a user logs in, he should raise this event to register itself to the socket.io server. This is necessary to allow the socket.io server to create a room for each user, so that data can be sent to any specific user online in the system. Also, this event allows the server to handle the *teardown* of each user when he disconnects. For example, a user that disconnects might need to leave a match or the matchmaking queue, as well as to update the status and set it "Offline". | With this event, a [ServerJoinData](#serverjoindata) resource is sent, which contains the id of the user that has just joined the server. |

### Join Chat

| Event names | Description | Event Data |
| :---------- | :---------- | :--------- |
| chat-joined | When a user joins a chat, he should raise this event to notify the socket.io server. This is necessary to allow socket.io server to create a room for each chat that contains the user currently active on said chat, so that messages (and possibly other data) can be sent just those users. | With this event, a [ChatJoinData](#chatjoindata) resource is sent, which contains the id of the chat that the user has joined. |

### Leave Chat

| Event names | Description | Event Data |
| :---------- | :---------- | :--------- |
| chat-left | When a user leaves a chat, he should raise this event to notify the socket.io server, so that no more data from that chat is sent to the user. More specifically, the client associated with the user leaves the chat room previously created by the server. | With this event, a [ChatJoinData](#chatjoindata) resource is sent, which contains the id of the chat that the user has left. |

### Join Match

| Event name | Description | Event Data |
| :--------- | :---------- | :--------- |
| match-joined | When a user joins a match, either as player or spectator, he should raise this event to notify the socket.io server. This is necessary to allow socket.io server to create a room for each match, so that data can be sent to any user that is currently playing or spectating said match. | With this event, a [MatchJoinData](#matchjoindata) resource is sent, which contains the id of the match that the user has joined. |

### Leave Match

| Event names | Description | Event Data |
| :---------- | :---------- | :--------- |
| match-left | When a user leaves a match, he should raise this event to notify the socket.io server, so that no more data from that match is sent to the user. More specifically, the client associated with the user leaves the match room previously created by the server. |  With this event, a [MatchLeftData](#matchleftdata) resource is sent, which contains the id of the match that the user has left. |

### Friend Request Accepted

| Event names | Description | Event Data |
| :---------- | :---------- | :--------- |
| friend-request-accepted | This event is raised by a user who has accepted a friend request. The user notifies the server that he has accepted the request, so that the server can save the new relationship between the two users and notify the sender of the request that he has a new friend.  The friend request notification is then automatically removed by the server. | With this event, a [RequestAcceptedData](#requestaccepteddata) resource is sent, which contains the id of the user who accepted the request, as well as the id of the sender. |

### Match Request Accepted

| Event names | Description | Event Data |
| :---------- | :---------- | :--------- |
| match-request-accepted | This event is raised by a user who has accepted a match request. The user notifies the server that he has accepted the request, so that the server can create the match and notify the two players about the game that has started, only if both players are available (i.e. both users are Online and currently not playing or spectating). The match request notification is then automatically removed by the server. | With this event, a [RequestAcceptedData](#requestaccepteddata) resource is sent, which contains the id of the two players involved in the match. |

### Player Won

| Event names | Description | Event Data |
| :---------- | :---------- | :--------- |
| player-won | This event is raised by a player when the match ends because some player has won. The server is notified of this occurrence and executes the necessary game-ending operations, such as updating the statistics of the match and notifying the other player/spectators that the match has ended. | With this event, a [PlayerWonData](#playerwondata) resource is sent, which contains the id of the player who won the match. |

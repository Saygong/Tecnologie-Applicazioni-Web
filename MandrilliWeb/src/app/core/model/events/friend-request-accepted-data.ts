export interface FriendRequestAcceptedData {
    /**
     * Id of the user that has to be notified of the new friend.
     * This is the user that sent the request.
     */
    userToNotifyId: string;

    /**
     * Id of the new friend.
     * This is the user that accepted the request.
     */
    friendId: string;
}

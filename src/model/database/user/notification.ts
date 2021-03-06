import { Schema, SchemaTypes, Types } from 'mongoose';

/**
 * Enumeration that defines all the possible notification model receivable by a user
 */
export enum RequestTypes {
    FriendRequest = 'FriendRequest',
    MatchRequest = 'MatchRequest',
}

/**
 * Interface that represents a User notification
 */
export interface RequestNotification {
    /**
     * Type of the notification
     */
    type: RequestTypes;

    /**
     * Id of the user that sent the notification
     */
    sender: Types.ObjectId;

    /**
     * Date that the notification was created at.
     * It is automatically inserted by the database
     */
    createdAt?: Date;

    /**
     * Date that the notification was last updated at.
     * It is automatically inserted and updated by the database
     */
    updatedAt?: Date;
}

/**
 * Interface that represents a notification sub-document
 */
export interface RequestNotificationSubDocument
    extends RequestNotification,
        Types.EmbeddedDocument {}

/**
 * A notification is identified by the pair (type, requester)
 */
export const NotificationSchema = new Schema<RequestNotificationSubDocument>(
    {
        type: {
            type: SchemaTypes.String,
            required: true,
            enum: [RequestTypes.FriendRequest.valueOf(), RequestTypes.MatchRequest.valueOf()],
        },
        sender: {
            type: Types.ObjectId,
            required: true,
        },
    },
    { timestamps: true }
);

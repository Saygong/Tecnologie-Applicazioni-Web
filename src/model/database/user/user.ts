import * as mongoose from 'mongoose';
import { AnyKeys, Document, FilterQuery, Model, Schema, SchemaTypes, Types } from 'mongoose';
import { Server } from 'socket.io';
import bcrypt from 'bcrypt';

import {
    RequestNotification,
    RequestNotificationSubDocument,
    RequestTypes,
    NotificationSchema,
} from './notification';
import { UserStats, UserStatsSubDocument } from './user-stats';
import { Relationship, RelationshipSubDocument, RelationshipSchema } from './relationship';
import { StatsSchema } from './user-stats';
import { ChatDocument, ChatModel, createChat } from '../chat/chat';
import { FriendStatusChangedEmitter } from '../../../events/emitters/friend-status-changed';

/**
 * Enumeration that defines all the possible roles that can be
 * assigned to some user.
 */
export enum UserRoles {
    Base = 'Base',
    Moderator = 'Moderator',
    Admin = 'Admin',
}

export enum UserStatus {
    Offline = 'Offline',
    Online = 'Online',
    PrepPhase = 'Preparation Phase',
    InGame = 'In Game',
    Spectating = 'Spectating',
    InQueue = 'In Queue',

    /**
     * This status is assigned to a moderator that has just been added
     * to the system. Its purpose is to signal that its credentials
     * have to be changed at the first login
     */
    TemporaryCredentials = 'TemporaryCredentials',
}

/**
 * Interface that represents a User of the system.
 */
export interface User {
    username: string;
    roles: string[];
    pwd_hash: string;
    salt: string;
    status: UserStatus;
    stats: UserStats;
    relationships: Relationship[];
    notifications: RequestNotification[];
}

/**
 * Interface that represents a User document, which is the
 * internal representation of a Chat object in the database.
 * It exposes some useful methods to interact with the database object.
 */
export interface UserDocument extends User, Document {
    /**
     * Stats sub-document
     */
    stats: UserStatsSubDocument;

    /**
     * Array of relationship sub-documents
     */
    relationships: Types.DocumentArray<RelationshipSubDocument>;

    /**
     * Array of notification sub-documents
     */
    notifications: Types.DocumentArray<RequestNotificationSubDocument>;

    /**
     * Adds the provided role to this instance.
     * If the user already has the role, it is not added a second time.
     *
     * @param role role to be set
     */
    setRole(role: UserRoles): Promise<UserDocument>;

    /**
     * Removes the provided role from this instance.
     * If the user doesn't have the role, nothing happens.
     *
     * @param role role to be removed
     */
    removeRole(role: UserRoles): Promise<UserDocument>;

    /**
     * Returns true if the user has the provided role, false otherwise.
     *
     * @param role role to check
     */
    hasRole(role: UserRoles): boolean;

    /**
     * Returns true if the user is friend with key owner, false otherwise.
     *
     * @param key friend's key to look for
     */
    isFriend(key: Types.ObjectId): boolean;

    /**
     * Set a new password using bcrypt hashing and salt generation functions
     * @param pwd new password to set
     */
    setPassword(pwd: string): Promise<UserDocument>;

    /**
     * Check the validity of the password with the one stored on the database
     * @param pwd the password to check
     */
    validatePassword(pwd: string): Promise<boolean>;

    /**
     * Add a notification identified by type and requester
     * Return an error if an identical notification already exists
     * @param type type of the incoming notification
     * @param requester sender of the incoming notification
     */
    addNotification(type: RequestTypes, requester: Types.ObjectId): Promise<UserDocument>;

    /**
     * Remove a notification identified by its id
     * Returns an error if the notification doesn't exist
     * @param type type of the notification to remove
     * @param sender id of the user that generated the request
     */
    removeNotification(type: RequestTypes, sender: Types.ObjectId): Promise<UserDocument>;

    /**
     * Add a relationship and automatically create a new chat object.
     * The relationship is added symmetrically to both users involved.
     * @param friendId new friend's id
     */
    addRelationshipSymmetrically(friendId: Types.ObjectId): Promise<UserDocument>;

    /**
     * Remove a relationship from both users
     * @param friendId friend's id to delete
     * @param removeSymmetric trigger the symmetric deletion of the relationship
     */
    removeRelationship(friendId: Types.ObjectId, removeSymmetric?: boolean): Promise<UserDocument>;
}

export const UserSchema = new Schema<UserDocument>({
    username: {
        type: SchemaTypes.String,
        required: true,
        unique: true,
        index: true,
    },

    relationships: {
        type: [RelationshipSchema],
        default: [],
    },

    stats: {
        type: StatsSchema,
        default: () => ({}),
    },

    roles: {
        type: [SchemaTypes.String],
        required: true,
        enum: UserRoles,
        default: [UserRoles.Base],
    },

    salt: {
        type: SchemaTypes.String,
        required: false,
    },

    pwd_hash: {
        type: SchemaTypes.String,
        required: false,
    },

    notifications: {
        type: [NotificationSchema],
    },

    status: {
        type: SchemaTypes.String,
        enum: UserStatus,
        default: UserStatus.Offline,
    },
});

/* METHODS FOR NOTIFICATION MANIPULATION */

UserSchema.methods.addNotification = async function (
    reqType: RequestTypes,
    sender: Types.ObjectId
): Promise<UserDocument> {
    for (let idx in this.notifications) {
        if (
            this.notifications[idx].type.valueOf() === reqType.valueOf() &&
            this.notifications[idx].sender.equals(sender)
        ) {
            return Promise.reject(new Error('Notification already sent'));
        }
    }

    const toInsert: RequestNotification = { type: reqType, sender: sender };
    this.notifications.push(toInsert);

    return this.save();
};

UserSchema.methods.removeNotification = async function (
    type: string,
    sender: Types.ObjectId
): Promise<UserDocument> {
    for (let idx in this.notifications) {
        if (
            this.notifications[idx].type.valueOf() === type.valueOf() &&
            this.notifications[idx].sender.equals(sender)
        ) {
            this.notifications.splice(parseInt(idx), 1);

            return this.save();
        }
    }

    return Promise.reject(new Error('Notification not found'));
};

/* METHODS FOR PASSWORD MANIPULATION AND VALIDATION */

UserSchema.methods.setPassword = async function (pwd: string): Promise<UserDocument> {
    const salt: string = await bcrypt
        .genSalt(10)
        .catch((error) =>
            Promise.reject(new Error('Error with salt generation: ' + error.message))
        );

    const pwdHash = await bcrypt
        .hash(pwd, salt)
        .catch((error) =>
            Promise.reject(new Error('Error with password encryption: ' + error.message))
        );

    this.salt = salt;
    this.pwd_hash = pwdHash;
    return this.save();
};

UserSchema.methods.validatePassword = async function (pwd: string): Promise<boolean> {
    const hashedPw = await bcrypt
        .hash(pwd, this.salt)
        .catch((error) =>
            Promise.reject(new Error('Error with password encryption: ' + error.message))
        );

    return this.pwd_hash === hashedPw;
};

/* METHODS FOR ROLES MANIPULATION  */

UserSchema.methods.removeRole = async function (role: UserRoles): Promise<UserDocument> {
    for (const idx in this.roles) {
        if (this.roles[idx] === role.valueOf()) this.roles.splice(parseInt(idx), 1);
    }

    return this.save();
};

UserSchema.methods.hasRole = function (role: UserRoles): boolean {
    for (let idx in this.roles) {
        if (this.roles[idx] == role.valueOf()) {
            return true;
        }
    }

    return false;
};

UserSchema.methods.setRole = async function (role: UserRoles): Promise<UserDocument> {
    if (!this.hasRole(role)) {
        this.roles.push(role.valueOf());
        return this.save();
    }
    return Promise.reject(new Error('Role already set'));
};

/* METHODS AND FUNCTIONS FOR RELATIONSHIP MANIPULATIONS */

UserSchema.methods.addRelationshipSymmetrically = async function (
    friendId: Types.ObjectId
): Promise<UserDocument> {
    const doesUserContainRelationship = (user: UserDocument) => {
        for (let idx in this.relationships) {
            if (user.relationships[idx].friendId.equals(friendId)) {
                return true;
            }
        }

        return false;
    };

    if (doesUserContainRelationship(this)) {
        return Promise.reject(new Error('Relationship already existent'));
    }

    try {
        // Create a new chat between the two friends
        const friendChat: ChatDocument = await createChat([this._id, friendId]);

        // Relationship from the point of view of the current user
        const newRelationship: Relationship = {
            friendId: friendId,
            chatId: friendChat._id,
        };

        // Relationship from the point of view of the other user
        const newSymmetricRelationship: Relationship = {
            friendId: this._id,
            chatId: friendChat._id,
        };

        // Add the relationship to both users and save
        const friend: UserDocument = await getUserById(friendId);
        friend.relationships.push(newSymmetricRelationship);
        await friend.save();

        this.relationships.push(newRelationship);
        return this.save();
    } catch (err) {
        return Promise.reject(new Error(err.message));
    }
};

UserSchema.methods.removeRelationship = async function (
    friendId: Types.ObjectId,
    removeSymmetric?: boolean
): Promise<UserDocument> {
    let found: boolean = false;
    for (let idx in this.relationships) {
        if (this.relationships[idx].friendId.equals(friendId)) {
            const chatIdToRemove: Types.ObjectId = this.relationships[idx].chatId;
            this.relationships.splice(parseInt(idx), 1);

            found = true;

            if (!removeSymmetric) {
                try {
                    await ChatModel.deleteOne({ _id: chatIdToRemove });

                    await symmetricRemoveRelationship(friendId, this._id);
                } catch (err) {
                    return Promise.reject(new Error(err.message));
                }
            }
        }
    }
    if (found) {
        return this.save();
    } else return Promise.reject(new Error('Relationship not found'));
};

/* Symmetrical deletion of a friend relation */
const symmetricRemoveRelationship = async function (
    userId: Types.ObjectId,
    friendId: Types.ObjectId
): Promise<UserDocument> {
    let user: UserDocument;
    try {
        user = await getUserById(userId);
        return user.removeRelationship(friendId, true);
    } catch (err) {
        return Promise.reject(new Error(err.message));
    }
};

// Create "Users" collection
export const UserModel: Model<UserDocument> = mongoose.model('User', UserSchema, 'Users');

export async function getUserById(userId: Types.ObjectId): Promise<UserDocument> {
    const userDoc = await UserModel.findOne({ _id: userId }).catch((err: Error) =>
        Promise.reject(err)
    );

    return !userDoc
        ? Promise.reject(new Error('No user with that identifier'))
        : Promise.resolve(userDoc);
}

export async function getUserByUsername(username: string): Promise<UserDocument> {
    const userdata: UserDocument = await UserModel.findOne({ username }).catch((err: Error) => {
        return Promise.reject(new Error('Internal server error'));
    });

    return !userdata
        ? Promise.reject(new Error('No user with that identifier'))
        : Promise.resolve(userdata);
}

export async function createUser(data: AnyKeys<UserDocument>): Promise<UserDocument> {
    const u: UserDocument = new UserModel(data);
    await u.save().catch((err) => {
        return Promise.reject(new Error('User already exists'));
    });
    return u;
}

export async function getUsers(ids: Types.ObjectId[]): Promise<UserDocument[]> {
    let users: UserDocument[];
    try {
        users = await UserModel.find({ _id: { $in: ids } });
    } catch (err) {
        return Promise.reject(new Error('Sum internal error just occurred'));
    }
    if (!users) return Promise.reject(new Error('None of the given ids are present in the db'));
    return users.length === ids.length ? Promise.resolve(users) : Promise.reject(users);
}

export async function getLeaderboard(skip: number, limit: number): Promise<UserDocument[]> {
    // We don't want to return the admin, since it is just a maintenance user
    const adminUsername: string = process.env.ADMIN_USERNAME;

    return UserModel.find({ username: { $ne: adminUsername } })
        .sort({ 'stats.elo': -1 })
        .skip(skip)
        .limit(limit)
        .catch((err: Error) => Promise.reject(err));
}

export async function deleteUser(filter: FilterQuery<UserDocument>): Promise<void> {
    const obj: { deletedCount?: number } = await UserModel.deleteOne(filter).catch((err) =>
        Promise.reject(err)
    );
    return !obj.deletedCount
        ? Promise.reject(new Error('No user with that identifier'))
        : Promise.resolve();
}

export async function updateUserName(_id: Types.ObjectId, username: string): Promise<void> {
    await UserModel.updateOne({ _id }, { username }).catch((err) => {
        return Promise.reject(new Error(err.message));
    });

    return Promise.resolve();
}

export async function updatePassword(_id: Types.ObjectId, password: string): Promise<void> {
    let user: UserDocument;
    try {
        user = await getUserById(_id);
        await user.setPassword(password);
    } catch (err) {
        return Promise.reject(new Error(err.message));
    }
    return Promise.resolve();
}

export async function getUserStats(_id: Types.ObjectId): Promise<UserStats> {
    let stat: UserDocument = await UserModel.findOne({ _id }, { stats: 1 }).catch((err) =>
        Promise.reject(new Error('Sum internal error just occurred'))
    );
    return !stat
        ? Promise.reject(new Error('No user with that identifier'))
        : Promise.resolve(stat.stats);
}

/**
 * Returns the most recent notifications of the user, ordered by most recent.
 * @param userId id of the user to retrieve the notifications of
 */
export async function getMostRecentNotifications(
    userId: Types.ObjectId
): Promise<RequestNotificationSubDocument[]> {
    const not: UserDocument = await UserModel.findOne({ _id: userId }, { notifications: 1 }).sort({
        createdAt: -1,
    });
    return not.notifications;
}

/**
 * @param userId id of the user to update
 * @param updatedStats object containing the updated stats of the user
 */
export async function updateUserStats(
    userId: Types.ObjectId,
    updatedStats: UserStats
): Promise<UserDocument> {
    try {
        const user: UserDocument = await getUserById(userId);

        user.stats.topElo = updatedStats.topElo;
        user.stats.elo = updatedStats.elo;
        user.stats.wins = updatedStats.wins;
        user.stats.losses = updatedStats.losses;
        user.stats.shipsDestroyed = updatedStats.shipsDestroyed;
        user.stats.totalShots = updatedStats.totalShots;
        user.stats.totalHits = updatedStats.totalHits;

        return user.save();
    } catch (err) {
        return Promise.reject(new Error(err.message));
    }
}

/**
 * Adds the stats of the match to the stats of the user
 * @param userId
 * @param newShipsDestroyed
 * @param newShots
 * @param newHits
 * @param didUserWin
 */
export const addMatchStats = async (
    userId: Types.ObjectId,
    newShipsDestroyed: number,
    newShots: number,
    newHits: number,
    didUserWin: boolean
): Promise<UserDocument> => {
    try {
        const user: UserDocument = await getUserById(userId);

        // Since newElo can be negative in case of a loss, check that the total
        // elo doesn't go below 0
        const newElo: number = didUserWin ? 30 : -20;
        let newUserElo: number = (user.stats.elo += newElo);
        newUserElo = newUserElo < 0 ? 0 : newUserElo;

        user.stats.elo = newUserElo;
        user.stats.topElo = newUserElo > user.stats.topElo ? newUserElo : user.stats.topElo;
        user.stats.wins += didUserWin ? 1 : 0;
        user.stats.losses += !didUserWin ? 1 : 0;
        user.stats.shipsDestroyed += newShipsDestroyed;
        user.stats.totalShots += newShots;
        user.stats.totalHits += newHits;

        return user.save();
    } catch (err) {
        return Promise.reject(new Error(err.message));
    }
};

/**
 * Sets the status of the provided user to the provided value
 * and notifies his friends of the change.
 * @param ioServer: socket.io server used to send notifications to
 *      the friends of the user whose status is being changed
 * @param userId id of the user whose status has to be changed
 * @param newStatus new status of the user
 * @return updated user
 * @private
 */
export const setUserStatus = async (
    ioServer: Server,
    userId: Types.ObjectId,
    newStatus: UserStatus
): Promise<UserDocument> => {
    let user: UserDocument = await getUserById(userId);
    user.status = newStatus;

    user = await user.save();

    const friendIds: Types.ObjectId[] = user.relationships.map((rel: RelationshipSubDocument) => {
        return rel.friendId;
    });
    await notifyFriendsUserStatusChanged(ioServer, user._id, friendIds, newStatus);

    return user;
};

/**
 * Notify the friends of the user that his status is now offline
 * @param ioServer: socket.io server used to send notifications to
 *      the friends of the user whose status is being changed
 * @param userId id of the user whose friends have to be notified
 * @param friendIds ids of the friends of the user
 * @param newStatus new status of the user
 * @private
 */
const notifyFriendsUserStatusChanged = async (
    ioServer: Server,
    userId: Types.ObjectId,
    friendIds: Types.ObjectId[],
    newStatus: UserStatus
): Promise<void> => {
    // Notify each friend that the user is now offline
    friendIds.forEach((fId: Types.ObjectId) => {
        const notifier: FriendStatusChangedEmitter = new FriendStatusChangedEmitter(ioServer, fId);
        notifier.emit({
            status: newStatus,
            friendId: userId.toString(),
        });
    });
};

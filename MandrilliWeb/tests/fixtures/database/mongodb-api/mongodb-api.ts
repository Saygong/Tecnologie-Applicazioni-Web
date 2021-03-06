import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { Collection, Document, FilterQuery, Types } from 'mongoose';

import * as dbUser from '../../../../../src/model/database/user/user';
import * as dbRelation from '../../../../../src/model/database/user/relationship';
import * as dbMatch from '../../../../../src/model/database/match/match';
import * as dbChat from '../../../../../src/model/database/chat/chat';
import * as dbMatchmaking from '../../../../../src/model/database/matchmaking/queue-entry';
import { environment } from '../../../../src/environments/environment';
import { MongoDbApiMatch, toMongoDbApiMatch } from './api-match';
import { MongoDbApiChat, toMongoDbApiChat } from './api-chat';

const dbCollectionNames = {
    userCollection: 'Users',
    matchCollection: 'Matches',
    chatCollection: 'Chats',
    matchmakingCollection: 'MatchmakingQueue',
    notificationCollection: 'Notifications',
};

export interface MongoDpApiCredentials {
    apiBaseUrl: string;
    clusterName: string;
    apiKey: string;
    dbName: string;
}

let apiCredentials: MongoDpApiCredentials | null = null;
export const getApiCredentials = async (): Promise<MongoDpApiCredentials> => {
    // Send the request only if necessary
    // Credentials are static, so there's no need to flood the server with requests
    if (apiCredentials !== null) {
        return apiCredentials;
    } else {
        const reqUrl: string = `${environment.serverBaseUrl}/api/testing/mongoDbApi/credentials`;

        const res: AxiosResponse<MongoDpApiCredentials> = await axios.get<MongoDpApiCredentials>(
            reqUrl
        );

        apiCredentials = res.data;

        return apiCredentials;
    }
};

export type DocId = string | Types.ObjectId;

interface MongoDbReqParams {
    requestPath: string;
    body: MongoDbReqBody;
}

interface MongoDbReqBody {
    /**
     * Cluster name
     */
    dataSource: string;

    /**
     * Database name
     */
    database: string;

    /**
     * Collection name
     */
    collection: string;
}

interface MongoDbInsertReq<D> extends MongoDbReqBody {
    /**
     * Document to send
     */
    document: D;
}

export interface MongoDbSingleInsertResponse {
    insertedId: DocId;
}

export interface MongoDbFilterReq extends MongoDbReqBody {
    /**
     * Filters for a query
     */
    filter: FilterQuery<Document>;

    // There could be other fields, but these are sufficient for my purposes
}

/**
 * Wrapper for actual ObjectIds that needs to be sent in order to tell
 * the MongoDb Data Api that the value is indeed an ObjectId
 */
export class ApiObjectId {
    $oid: DocId;

    constructor(objId: DocId) {
        this.$oid = objId;
    }
}

export class MongoDbApi {
    private readonly credentials: MongoDpApiCredentials;
    private readonly verbose: boolean;

    public constructor(credentials: MongoDpApiCredentials, verbose: boolean = false) {
        this.credentials = credentials;
        this.verbose = verbose;
    }

    /*
     * Get user document by _id
     */
    public async getUserDocument(userId: DocId): Promise<dbUser.UserDocument> {
        return await this.getDocumentById<dbUser.UserDocument>(
            dbCollectionNames.userCollection,
            userId
        );
    }

    /*
     * Get match document by _id
     */
    public async getMatchDocument(matchId: DocId): Promise<dbMatch.MatchDocument> {
        return await this.getDocumentById<dbMatch.MatchDocument>(
            dbCollectionNames.matchCollection,
            matchId
        );
    }

    /*
     * Get chat document by _id
     */
    public async getChatDocument(chatId: DocId): Promise<dbChat.ChatDocument> {
        return await this.getDocumentById<dbChat.ChatDocument>(
            dbCollectionNames.userCollection,
            chatId
        );
    }

    /*
     * Get a document by _id from the specified collection
     */
    public async getDocumentById<T extends Document>(
        collectionName: string,
        docId: DocId
    ): Promise<T> {
        const filter: FilterQuery<Document> = {
            _id: new ApiObjectId(docId),
        };

        return await this.getDocument<T>(filter, collectionName);
    }

    /**
     * Get matchmaking queue entry by user id
     * @param userId id of the user that the entry represents
     */
    public async getQueueEntry(userId: DocId): Promise<dbMatchmaking.QueueEntryDocument> {
        const filter = {
            userId: userId,
        };

        return await this.getDocument<dbMatchmaking.QueueEntryDocument>(
            filter,
            dbCollectionNames.matchmakingCollection
        );
    }

    public async getDocument<D extends Document>(
        filter: FilterQuery<Document>,
        collection: string
    ): Promise<D> {
        const reqBody: MongoDbFilterReq = {
            dataSource: this.credentials.clusterName,
            database: this.credentials.dbName,
            collection: collection,
            filter: filter,
        };

        return await this.sendMongoDbRequest<D>({
            requestPath: '/action/findOne',
            body: reqBody,
        });
    }

    public async insertUser(userData: dbUser.User): Promise<MongoDbSingleInsertResponse> {
        return await this.insertDocument<dbUser.User>(userData, dbCollectionNames.userCollection);
    }

    public async insertChat(chatData: dbChat.Chat): Promise<MongoDbSingleInsertResponse> {
        return await this.insertDocument<MongoDbApiChat>(
            toMongoDbApiChat(chatData),
            dbCollectionNames.chatCollection
        );
    }

    public async insertMatch(matchData: dbMatch.Match): Promise<MongoDbSingleInsertResponse> {
        return await this.insertDocument<MongoDbApiMatch>(
            toMongoDbApiMatch(matchData),
            dbCollectionNames.matchCollection
        );
    }

    public async insertMatchmakingEntry(
        entryData: dbMatchmaking.QueueEntry
    ): Promise<MongoDbSingleInsertResponse> {
        return await this.insertDocument<dbMatchmaking.QueueEntry>(
            entryData,
            dbCollectionNames.matchmakingCollection
        );
    }

    public async insertDocument<I>(
        insertData: I,
        collection: string
    ): Promise<MongoDbSingleInsertResponse> {
        const reqBody: MongoDbInsertReq<I> = {
            dataSource: this.credentials.clusterName,
            database: this.credentials.dbName,
            collection: collection,
            document: insertData,
        };

        return await this.sendMongoDbRequest<MongoDbSingleInsertResponse>({
            requestPath: '/action/insertOne',
            body: reqBody,
        });
    }

    /**
     * Deletes the user with the provided id from the database
     * @param userId
     */
    public async deleteUser(userId: DocId): Promise<void> {
        return this.deleteMultipleUsers([userId]);
    }

    /**
     * Deletes the chat with the provided id from the database
     * @param chatId
     */
    public async deleteChat(chatId: DocId): Promise<void> {
        return this.deleteMultipleChats([chatId]);
    }

    /**
     * Deletes the match with the provided id from the database
     * @param matchId
     */
    public async deleteMatch(matchId: DocId): Promise<void> {
        return this.deleteMultipleMatches([matchId]);
    }

    /**
     * Deletes the matchmaking queue entry of the user
     * with the provided id from the database
     * @param userId id of the user whose entry should be deleted
     */
    public async deleteMatchmakingEntry(userId: string): Promise<void> {
        return await this.deleteMultipleMatchmakingEntries([userId]);
    }

    /**
     * Deletes from the database the users with the provided ids
     * @param userIds ids of the users that should be deleted
     */
    public async deleteMultipleUsers(userIds: DocId[]): Promise<void> {
        await this.deleteMultipleDocumentsById(dbCollectionNames.userCollection, userIds);
    }

    /**
     * Deletes from the database the chats with the provided ids
     * @param chatIds ids of the chats that should be deleted
     */
    public async deleteMultipleChats(chatIds: DocId[]): Promise<void> {
        await this.deleteMultipleDocumentsById(dbCollectionNames.chatCollection, chatIds);
    }

    /**
     * Deletes from the database the matches with the provided ids
     * @param matchIds ids of the matches that should be deleted
     */
    public async deleteMultipleMatches(matchIds: DocId[]): Promise<void> {
        await this.deleteMultipleDocumentsById(dbCollectionNames.matchCollection, matchIds);
    }

    /**
     * Deletes from the database the matchmaking entries of the users with the provided ids
     * @param userIds ids of the users whose entries should be deleted
     */
    public async deleteMultipleMatchmakingEntries(userIds: DocId[]): Promise<void> {
        await this.deleteMultipleDocumentsById(dbCollectionNames.matchmakingCollection, userIds);
    }

    private async deleteMultipleDocumentsById(collection: string, docIds: DocId[]): Promise<void> {
        const queryDocIds: ApiObjectId[] = docIds.map(
            (dId: string | Types.ObjectId): ApiObjectId => {
                return new ApiObjectId(dId);
            }
        );

        const multipleIdsFilter: FilterQuery<Document> = {
            _id: { $in: queryDocIds },
        };
        return this.deleteMultipleDocuments(collection, multipleIdsFilter);
    }

    private async deleteMultipleDocuments(
        collection: string,
        filter: FilterQuery<Document> = {}
    ): Promise<void> {
        const reqBody: MongoDbFilterReq = {
            dataSource: this.credentials.clusterName,
            database: this.credentials.dbName,
            collection: collection,
            filter: filter,
        };

        // Response should contain something like "deletedCount: x"
        await this.sendMongoDbRequest<Object>({
            requestPath: '/action/deleteMany',
            body: reqBody,
        });
    }

    /*
     * Send a request to the MongoDb REST API with the specified parameters
     */
    private async sendMongoDbRequest<R>(reqParams: MongoDbReqParams): Promise<R> {
        try {
            const url: string = `${this.credentials.apiBaseUrl}${reqParams.requestPath}`;
            const reqData: Object = reqParams.body;

            const reqHeaders = {
                'Content-Type': 'application/json',
                'Access-Control-Request-Headers': '*',
                'api-key': this.credentials.apiKey,
            };
            const axiosReqConfig: AxiosRequestConfig = {
                headers: reqHeaders,
            };

            this.logRequest(reqParams);

            const res = await axios.post<R>(url, reqData, axiosReqConfig);
            return res.data;
        } catch (err) {
            if (err instanceof Error) {
                console.log('Error has occurred in MongoDbApi');
                console.log(err.message);
            }

            throw err;
        }
    }

    private logRequest(reqParams: MongoDbReqParams) {
        // Do not log if not verbose
        if (!this.verbose) {
            return;
        }

        console.log('[MongoDbApi] Request sent:');
        console.log(reqParams);
    }
}

import { HttpClient } from '@angular/common/http';

import { ChatApi } from '../../src/app/core/api/handlers/chat-api';
import { AuthApi } from '../../src/app/core/api/handlers/auth-api';
import { JwtProvider } from '../../src/app/core/api/jwt-auth/jwt-provider';
import { authenticate } from './fixtures/authentication';
import { injectHttpClient } from './fixtures/http-client';
import {
    ChatApiTestingSetupData,
    setupDbChatApiTesting,
    teardownDbChatApiTesting,
} from './fixtures/database';
import { Chat } from '../../src/app/core/model/chat/chat';
import { Message } from '../../src/app/core/model/chat/message';

let httpClient: HttpClient;
let setupData: ChatApiTestingSetupData;
let jwtProvider: JwtProvider;
const wrongChatId: string = 'wrong-chat-id';

beforeEach(async () => {
    httpClient = injectHttpClient();
    setupData = await setupDbChatApiTesting();

    const authApi: AuthApi = new AuthApi(httpClient);
    jwtProvider = await authenticate(authApi, setupData.apiAuthCredentials);
});

afterEach(async () => {
    await teardownDbChatApiTesting(setupData);
});

describe('Get Chat', () => {
    test('Get Chat Should Return Non-Empty Response With Correct Fields', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.getChat(setupData.insertedData.chatId).subscribe({
            next: (chat: Chat) => {
                // Expect non-empty response
                expect(chat).toBeTruthy();

                // Expect an object with the correct fields
                expect(chat).toEqual(
                    expect.objectContaining<Chat>({
                        chatId: expect.any(String),
                        messages: expect.any(Array),
                        users: expect.any(Array),
                    })
                );
            },
            complete: () => {
                done();
            },
        });
    });

    test('Get Chat Should Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.getChat(wrongChatId).subscribe({
            error: (err: Error) => {
                expect(err).toBeTruthy();

                done();
            },
            complete: () => {
                throw Error('Observable should not complete without throwing');
            },
        });
    });
});

describe('Delete Chat', () => {
    test('Delete Chat Should Not Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        // Test should run without exceptions
        chatApi.deleteChat(setupData.insertedData.chatId).subscribe({
            complete: () => {
                done();
            },
        });
    });

    test('Delete Chat Should Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.deleteChat(wrongChatId).subscribe({
            error: (err: Error) => {
                expect(err).toBeTruthy();

                done();
            },
            complete: () => {
                throw Error('Observable should not complete without throwing');
            },
        });
    });
});

describe('Get Messages', () => {
    test('Get Messages Should Return Non-Empty Response With Correct Fields', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.getMessages(setupData.insertedData.chatId).subscribe({
            next: (messages: Message[]) => {
                // Expect non-empty response
                expect(messages).toBeTruthy();

                // Expect an object with the correct fields
                messages.forEach((m: Message) => {
                    expect(m).toEqual(
                        expect.objectContaining<Message>({
                            author: expect.any(String),
                            timestamp: expect.any(Number),
                            content: expect.any(String),
                        })
                    );
                });
            },
            complete: () => {
                done();
            },
        });
    });

    test('Get Messages Should Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.getMessages(wrongChatId).subscribe({
            error: (err: Error) => {
                expect(err).toBeTruthy();

                done();
            },
            complete: () => {
                throw Error('Observable should not complete without throwing');
            },
        });
    });
});

describe('Add Message', () => {
    let messageStub: Message;

    beforeEach(() => {
        messageStub = {
            author: setupData.insertedData.userId,
            timestamp: new Date(),
            content: 'some message',
        };
    });

    test('Add Message Should Return Non-Empty Response With Correct Fields', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.addMessage(setupData.insertedData.chatId, messageStub).subscribe({
            next: (newMessage: Message) => {
                // Expect non-empty response
                expect(newMessage).toBeTruthy();

                // Expect an object with the correct fields
                expect(newMessage).toEqual(
                    expect.objectContaining<Message>({
                        author: expect.any(String),
                        timestamp: expect.any(Number),
                        content: expect.any(String),
                    })
                );
            },
            complete: () => {
                done();
            },
        });
    });

    test('Add Messages Should Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);

        chatApi.addMessage(wrongChatId, messageStub).subscribe({
            error: (err: Error) => {
                expect(err).toBeTruthy();

                done();
            },
            complete: () => {
                throw Error('Observable should not complete without throwing');
            },
        });
    });
});

describe('Add User', () => {
    test('Add User Should Return Non-Empty Response With Correct Fields', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);
        const { chatId, userId } = setupData.insertedData;

        chatApi.addUser(chatId, userId).subscribe({
            next: (resUserId: string) => {
                // Expect non-empty response
                expect(resUserId).toBeTruthy();

                // Expect the same userId that was added
                expect(resUserId).toEqual(userId);
            },
            complete: () => {
                done();
            },
        });
    });

    test('Add User Should Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);
        const { chatId, userId } = setupData.insertedData;

        chatApi.addUser(wrongChatId, userId).subscribe({
            error: (err: Error) => {
                expect(err).toBeTruthy();

                done();
            },
            complete: () => {
                throw Error('Observable should not complete without throwing');
            },
        });
    });
});

describe('Remove User', () => {
    test('Remove User Should Not Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);
        const { chatId, userId } = setupData.insertedData;

        chatApi.removeUser(chatId, userId).subscribe({
            complete: () => {
                done();
            },
        });
    });

    test('Remove User Should Throw', (done) => {
        const chatApi: ChatApi = new ChatApi(httpClient, jwtProvider);
        const { chatId, userId } = setupData.insertedData;

        chatApi.removeUser(wrongChatId, userId).subscribe({
            error: (err: Error) => {
                expect(err).toBeTruthy();

                done();
            },
            complete: () => {
                throw Error('Observable should not complete without throwing');
            },
        });
    });
});

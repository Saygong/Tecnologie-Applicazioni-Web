import { HttpClient } from '@angular/common/http';

import { injectHttpClient } from './fixtures/http-client';
import { AuthApi, AuthResult, LoginInfo } from '../../src/app/core/api/handlers/auth-api';
import { JwtProvider } from '../../src/app/core/api/jwt-auth/jwt-provider';
import { JwtStorage } from '../../src/app/core/api/jwt-auth/jwt-storage';
import { UserIdStorage } from '../../src/app/core/api/userId-auth/userId-storage';
import {
    apiAuthPassword,
    authenticate,
    JwtStubProvider,
    UserIdStubProvider,
} from './fixtures/authentication';
import { deleteUser, InsertedUser, insertUser } from './fixtures/database/users';
import { SetupData } from './fixtures/utils';
import { User } from '../../src/app/core/model/user/user';

interface AuthTestingSetupData extends SetupData {
    insertedData: {
        user: InsertedUser;
    };
}

const setupAuthApiTesting = async (): Promise<AuthTestingSetupData> => {
    const insertedUser: InsertedUser = await insertUser();

    return {
        apiAuthCredentials: {
            username: insertedUser.userData.username,
            password: apiAuthPassword,
        },
        insertedData: {
            user: insertedUser,
        },
    };
};

const teardownAuthApiTesting = async (setupData: AuthTestingSetupData): Promise<void> => {
    await deleteUser(setupData.insertedData.user.userId);
};

const getAuthApi = (): AuthApi => {
    const jwtStubProvider: JwtStubProvider = new JwtStubProvider();
    const jwtStorage: JwtStorage = jwtStubProvider.getJwtStorageStub();

    const userIdStubProvider: UserIdStubProvider = new UserIdStubProvider();
    const userIdStorage: UserIdStorage = userIdStubProvider.getUserIdStorageStub();

    return new AuthApi(httpClient, jwtStorage, userIdStorage);
};

let httpClient: HttpClient;
let setupData: AuthTestingSetupData;
let jwtProvider: JwtProvider;

beforeEach(async () => {
    httpClient = injectHttpClient();
    setupData = await setupAuthApiTesting();

    jwtProvider = await authenticate(setupData.apiAuthCredentials);
});

afterEach(async () => {
    await teardownAuthApiTesting(setupData);
});

describe('Login', () => {
    test('Login Should Return Non-Empty Response With Correct Fields', (done) => {
        const authApi: AuthApi = getAuthApi();
        const credentials: LoginInfo = setupData.apiAuthCredentials;

        authApi.login(credentials).subscribe({
            next: (authRes: AuthResult) => {
                // Expect non-empty response
                expect(authRes).toBeTruthy();

                // Expect an object with the correct fields
                expect(authRes).toEqual(
                    expect.objectContaining<AuthResult>({
                        userId: expect.any(String),
                        token: expect.any(String),
                    })
                );
            },
            complete: () => {
                done();
            },
        });
    });

    test('Login Should Throw', (done) => {
        const authApi: AuthApi = getAuthApi();
        const wrongCredentials: LoginInfo = {
            username: 'wrong-username',
            password: 'wrong-password',
        };

        authApi.login(wrongCredentials).subscribe({
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

describe('Signup', () => {
    test('Signup Should Return Non-Empty Response With Correct Fields', (done) => {
        const authApi: AuthApi = getAuthApi();
        const newCredentials: LoginInfo = {
            username: 'any-username',
            password: 'any-password',
        };
        let newUser: User;

        authApi.register(newCredentials).subscribe({
            next: (user: User) => {
                // Save for teardown
                newUser = user;

                // Expect non-empty response
                expect(user).toBeTruthy();

                // Expect an object with the correct fields
                expect(user).toEqual(
                    expect.objectContaining<User>({
                        userId: expect.any(String),
                        username: expect.any(String),
                        roles: expect.any(Array),
                        status: expect.any(String),
                        elo: expect.any(Number),
                    })
                );
            },
            complete: async () => {
                // Teardown the registered user
                await deleteUser(newUser.userId);

                done();
            },
        });
    });

    test('Signup Should Throw', (done) => {
        const authApi: AuthApi = getAuthApi();

        const insertedUser: InsertedUser = setupData.insertedData.user;
        const duplicateCredentials: LoginInfo = {
            username: insertedUser.userData.username,
            password: 'any-password',
        };

        authApi.login(duplicateCredentials).subscribe({
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

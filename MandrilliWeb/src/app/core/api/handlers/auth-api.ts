import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, tap } from 'rxjs';

import { BaseApi } from './base/base-api';
import { User } from '../../model/user/user';
import { JwtStorage } from '../jwt-auth/jwt-storage';
import { UserIdStorage } from '../userId-auth/userId-storage';
import { BaseAuthenticatedApi } from './base/base-authenticated-api';
import { JwtProvider } from '../jwt-auth/jwt-provider';

export interface LoginInfo {
    /**
     * Username credential
     */
    username: string;

    /**
     * Password credential
     */
    password: string;
}

export interface AuthResult {
    /**
     * Id of the user that authenticated
     */
    userId: string;

    /**
     * Value of the Json Web Token, used to authenticate future requests
     */
    token: string;
}

/**
 * Class that handles communication with authentication-related endpoints
 */
@Injectable({
    providedIn: 'root',
})
export class AuthApi extends BaseApi {
    public constructor(
        httpClient: HttpClient,
        private readonly jwtStorage: JwtStorage,
        private readonly userIdStorage: UserIdStorage
    ) {
        super(httpClient);

        this.jwtStorage = jwtStorage;
    }

    public login(credentials: LoginInfo): Observable<AuthResult> {
        const reqPath: string = `${this.baseUrl}/api/auth/signin`;

        return this.httpClient
            .post<AuthResult>(reqPath, credentials, this.createRequestOptions())
            .pipe(
                catchError(this.handleError),
                tap((authRes: AuthResult): AuthResult => {
                    this.jwtStorage.store(authRes.token);
                    this.userIdStorage.store(authRes.userId);

                    return authRes;
                })
            );
    }

    public register(credentials: LoginInfo): Observable<User> {
        const reqPath: string = `${this.baseUrl}/api/auth/signup`;

        return this.httpClient
            .post<User>(reqPath, credentials, this.createRequestOptions())
            .pipe(catchError(this.handleError));
    }
}

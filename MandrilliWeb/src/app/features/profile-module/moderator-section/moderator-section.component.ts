import { User } from './../../../core/model/user/user';
import { HtmlErrorMessage } from './../../../core/model/utils/htmlErrorMessage';
import { UserIdProvider } from 'src/app/core/api/userId-auth/userId-provider';
import { LoginInfo } from './../../../core/api/handlers/auth-api';
import { ModeratorApi } from './../../../core/api/handlers/moderator-api';
import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'moderator-section',
    templateUrl: './moderator-section.component.html',
    styleUrls: ['./moderator-section.component.css'],
})
export class ModeratorSectionComponent implements OnInit {
    public userInSessionId: string = '';
    public userMessage: HtmlErrorMessage = new HtmlErrorMessage();

    constructor(
        private moderatorClient: ModeratorApi,
        private userIdProvider: UserIdProvider
    ) {}

    ngOnInit(): void {
        this.userInSessionId = this.userIdProvider.getUserId();
    }

    public ban(username: string): void {
        try {
            this.moderatorClient.banUser(username).subscribe(()=>{
                
                this.userMessage.error = true;
                this.userMessage.errorMessage = "Banned: " + username;
            });
        } catch (err) {
            console.log('An error occurred while banning a user: ' + err);
        }
    }

    public newModerator(usrnm: string, pwd: string): void {
        try {
            let loginInfo: LoginInfo = { username: usrnm, password: pwd };
            this.moderatorClient.addModerator(loginInfo).subscribe({
                next: (data: User) => {
                    this.userMessage.error = true;
                    this.userMessage.errorMessage = "Created: " + usrnm;
                },
                error: (err) =>{
                    this.userMessage.error = true;
                    this.userMessage.errorMessage = JSON.stringify(err.error.errorMessage)
                }
            });
        } catch (err) {
            console.log('An error occurred while creating a new moderator: ' + err);
        }
    }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaApiService } from '../services/media-api.service';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatButtonModule,
    MatSnackBarModule,
    DatePipe
  ],
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss']
})
export class UsersPage implements OnInit {
  private api = inject(MediaApiService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  users: any[] = [];
  displayedColumns: string[] = ['email', 'role', 'status', 'created_at', 'last_login_at', 'actions'];
  currentUser: any = null;

  ngOnInit() {
    this.auth.user$.subscribe(u => this.currentUser = u);
    this.loadUsers();
  }

  loadUsers() {
    this.api.getUsers().subscribe(users => {
      this.users = users;
    });
  }

  toggleUserStatus(user: any) {
    if (user.id === this.currentUser?.id) {
      this.snackBar.open('You cannot change your own status.', 'Close', { duration: 3000 });
      return;
    }

    const newStatus = !user.is_active;
    this.api.updateUserStatus(user.id, newStatus).subscribe({
      next: () => {
        user.is_active = newStatus;
        this.snackBar.open(`User access ${newStatus ? 'granted' : 'revoked'} successfully.`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.error?.message || 'Failed to update user status.', 'Close', { duration: 3000 });
      }
    });
  }
}

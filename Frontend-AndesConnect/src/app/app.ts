import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('AndesConnect');
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    if (!sessionStorage.getItem('rt_initialized')) {
      sessionStorage.setItem('rt_initialized', 'true');
      await this.auth.logout();
      this.router.navigate(['/home']);
    }
  }
}

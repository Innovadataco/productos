import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <main class="main">
      <h1 class="sr-only">{{ title() }}</h1>
      <router-outlet />
    </main>
  `,
  // Module-based app: RouterOutlet comes from RouterModule (via AppRoutingModule)
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class App {
  protected readonly title = signal('frontend-dev');
}

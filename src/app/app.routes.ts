import { Routes } from '@angular/router';
import { AddNotificationComponent } from './components/add-notification/add-notification.component';
import { HomePage } from './home/home.page';
export const routes: Routes = [
  {
    path: 'home',
    component: HomePage,
  },
  {
    path: 'add-notification',
    component: AddNotificationComponent,
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  }
];

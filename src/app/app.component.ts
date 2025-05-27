import { Component } from '@angular/core';
import { LucideAngularModule, BellIcon, PlusIcon } from 'lucide-angular';
import { IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { Platform } from '@ionic/angular';
import { Channel, LocalNotifications } from '@capacitor/local-notifications';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [LucideAngularModule, IonTabBar, IonTabButton, IonTabs, RouterModule],
  standalone: true,
})
export class AppComponent {
  constructor(public router: Router) { }
  bellIcon = BellIcon;
  plusIcon = PlusIcon;
  channel: Channel = {
    id: 'default',
    name: 'Notificación',
    importance: 5,
    vibration: true,
    lights: true
  };


  navigateToHome() {
    this.router.navigate(['/home']);
  }

  navigateToAddNotification() {
    this.router.navigate(['/add-notification']);
  }


}

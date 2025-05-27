import { Component } from '@angular/core';
import {  RouterModule } from '@angular/router';
import { LucideAngularModule, BellIcon, PlusIcon } from 'lucide-angular';
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [LucideAngularModule, RouterModule],
})
export class HomePage {
  bellIcon = BellIcon;
  plusIcon = PlusIcon;
  constructor() { }
}
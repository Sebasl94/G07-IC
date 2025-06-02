// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { DatabaseService } from './services/database.service';
import {  IonTabBar, IonTabButton, IonTabs } from '@ionic/angular/standalone';
import {  BellIcon, LucideAngularModule,  PlusIcon } from 'lucide-angular';
import { Router, RouterModule } from '@angular/router';
@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports:[IonTabs, IonTabBar, IonTabButton,  LucideAngularModule, RouterModule]
})
export class AppComponent implements OnInit {
  
  bellIcon = BellIcon;
  plusIcon = PlusIcon;
  constructor(
    readonly platform: Platform,
    readonly databaseService: DatabaseService,
    readonly router: Router
  ) {}

  ngOnInit() {
    this.initializeApp();
  }

  private async initializeApp() {
    try {
      await this.platform.ready();
      console.log('Platform ready');
      
      // Inicializar base de datos con timeout
      const initTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database init timeout')), 15000)
      );

      const initPromise = this.databaseService.initializeDatabase();

      try {
        await Promise.race([initPromise, initTimeout]);
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Database initialization failed:', error);
        // La app continúa funcionando gracias al fallback del servicio
      }

      // Log del estado final
      const dbStatus = this.databaseService.isDatabaseReady();
      console.log('Final database status:', JSON.stringify(dbStatus));

    } catch (error) {
      console.error('App initialization error:', error);
      // La app debe continuar funcionando incluso si hay errores
    }
  }
}
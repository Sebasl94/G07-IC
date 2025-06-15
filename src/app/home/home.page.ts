import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { LucideAngularModule, PlusIcon, TrashIcon, EditIcon } from "lucide-angular";
import { measures } from "../const/measures";
import {
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonToolbar,
  IonCardHeader,
  IonButton,
  IonTitle,
} from "@ionic/angular/standalone";
import { dictOfTimes } from "../const/dictOfTimes";
import { dictOfDays } from "../const/dictOfDays";
import { DatabaseService } from "../services/database.service";
import { Reminder } from "../interfaces/reminder";
import { NotificationService } from "../services/notification/notification.service";
import { Capacitor } from '@capacitor/core';

@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
  standalone: true,
  imports: [
    LucideAngularModule,
    RouterModule,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButton,
  ],
})
export class HomePage implements OnInit {
  PlusIcon = PlusIcon;
  TrashIcon = TrashIcon;
  EditIcon = EditIcon;
  measures = measures;
  dictOfTimes = dictOfTimes;
  dictOfDays = dictOfDays;
  myReminders: any[] = [];
  isLoading = true;
  isWebPlatform = false;

  constructor(
    readonly databaseService: DatabaseService,
    private notificationService: NotificationService
  ) {
    this.isWebPlatform = Capacitor.getPlatform() === 'web';
  }

  async ngOnInit(): Promise<void> {
    setTimeout(() => {
      this.waitForDatabaseAndLoad();
    }, 500);
  }

  ionViewWillEnter() {
    this.loadReminders();
  }

  private async waitForDatabaseAndLoad(): Promise<void> {
    try {
      // Esperar a que la base de datos esté lista
      await this.databaseService.waitForDatabase();
      await this.loadReminders();
    } catch (error) {
      console.error('Error waiting for database:', error);
      this.myReminders = [];
    }
  }

  setTime(reminder: any) {
    if (reminder.reminderBy === "day") {
      let date = new Date();
      return `a las ${new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        reminder.reminderConfig.hour,
        reminder.reminderConfig.minute
      ).toLocaleTimeString("es-Co", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })} cada ${dictOfTimes[reminder.reminderBy]}`;
    } else if (reminder.reminderBy === "hour") {
      let date = new Date();
      return `cada ${reminder.reminderConfig.hour} ${
        reminder.reminderConfig.hour >= 2 ? "horas" : "hora"
      } y ${reminder.reminderConfig.minute} ${
        reminder.reminderConfig.minute >= 2 ? "minutos" : "minuto"
      }`;
    } else if (reminder.reminderBy === "week") {
      let date = new Date();
      return `cada ${
        dictOfDays[reminder.reminderConfig.dayOfWeek]
      } a las ${new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        reminder.reminderConfig.hour,
        reminder.reminderConfig.minute
      ).toLocaleTimeString("es-Co", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    } else if (reminder.reminderBy === "month") {
      let date = new Date();
      return `el ${reminder.reminderConfig.day} de cada mes a las ${new Date(
        date.getFullYear(),
        date.getMonth(),
        reminder.reminderConfig.day,
        reminder.reminderConfig.hour,
        reminder.reminderConfig.minute
      ).toLocaleTimeString("es-Co", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    return "";
  }

  async loadReminders() {
    this.isLoading = true;
    try {
      if (!this.databaseService.isDatabaseReady()) {
        console.log('Database not ready, waiting...');
        await this.databaseService.waitForDatabase();
      }

      console.log("Loading reminders...");
      const reminders = await this.databaseService.getReminders();
      console.log("reminders de loadReminders in home page", JSON.stringify(reminders));
      
      if (reminders) {
        reminders.values.forEach((reminder: Reminder) => {
          if (reminder.reminderConfig) {
            console.log("reminder.reminderConfig de loadReminders in home page", reminder.reminderConfig);
            if(typeof reminder.reminderConfig === 'string') {
              reminder.reminderConfig = JSON.parse(reminder.reminderConfig as any);
            }
          }
          if (reminder.measure) {
            console.log("reminder.measure de loadReminders in home page", reminder.measure);
            if(typeof reminder.measure === 'string') {
              reminder.measure = JSON.parse(reminder.measure as any);
            }
          }
        });
        this.myReminders = reminders.values;
      } else {
        this.myReminders = [];
      }
      
      console.log("Reminders loaded:", this.myReminders.length);
    } catch (error) {
      console.error("Error loading reminders:", error);
      this.myReminders = [];
    } finally {
      this.isLoading = false;
    }
  }

  async deleteReminder(reminder: Reminder) {
    if (reminder.id) {
      await this.databaseService.deleteReminder(reminder.id);
      await this.notificationService.removeAllNotifications();
      await this.loadReminders();
    }
  }

  async checkDatabaseStatus() {
    const status = this.databaseService.isDatabaseReady();
    console.log("Database Status:", status);

    try {
      const reminders = await this.databaseService.getReminders();
      console.log("Current reminders:", reminders);
    } catch (error) {
      console.error("Error getting reminders:", error);
    }
  }

  async testAddReminder() {
    try {
      if (!this.databaseService.isDatabaseReady()) {
        console.log('Database not ready for test, waiting...');
        await this.databaseService.waitForDatabase();
      }

      const testReminder = {
        name: "Test Reminder",
        description: "This is a test reminder",  
        date: new Date().toISOString().split("T")[0],
        time: "10:00",
        measure: JSON.stringify("pills"),
        reminderConfig: JSON.stringify("daily"),
        quantity: 1,
        reminderBy: "day",
        isActive: 1
      };

      const result = await this.databaseService.addReminder(testReminder as unknown as Reminder);
      console.log("Test reminder added:", result);

      await this.loadReminders();
    } catch (error) {
      console.error("Error adding test reminder:", error);
    }
  }

  async testNotification() {
    const now = new Date();
    // Schedule a notification in 5 seconds
    const scheduledAt = new Date(now.getTime() + 5000);
    await this.notificationService.scheduleNotification(
      'Hola!',
      'Esta es una notificación de prueba',
      scheduledAt
    );
    
    // También mostrar las notificaciones pendientes
    await this.notificationService.getPendingNotifications();
  }

  async checkExpiredNotifications() {
    console.log('🔍 Checking for expired notifications...');
    await this.notificationService.checkAndRescheduleExpiredNotifications();
  }

  async testRecurringNotification() {
    // Crear una notificación de prueba que se dispare en 1 minuto
    const testConfig = {
      id: 99999, // ID especial para pruebas
      title: 'Prueba Recurrente',
      body: 'Esta notificación debería reprogramarse automáticamente',
      scheduleConfig: {
        hour: new Date().getHours(),
        minute: new Date().getMinutes() + 1, // 1 minuto en el futuro
        day: new Date().getDate(),
        dayOfWeek: new Date().getDay(),
        numberFrecuency: 1
      },
      reminderBy: 'day'
    };

    await this.notificationService.scheduleRecurringNotification(testConfig);
    console.log('🧪 Test recurring notification scheduled');
  }

  async checkNotificationStatus() {
    console.log('🔍 Checking notification status...');
    const status = await this.notificationService.checkNotificationStatus();
    console.log('📋 Notification status:', status);
    
    if (status) {
      alert(`Estado de Notificaciones:
- Permisos: ${status.permissions ? '✅ Concedidos' : '❌ Denegados'}
- Notificaciones pendientes: ${status.pendingCount}
- Canales creados: ${status.channelsExist ? '✅ Sí' : '❌ No'}`);
    } else {
      alert('❌ Error al verificar el estado de notificaciones');
    }
  }

  async requestNotificationPermissions() {
    console.log('🔐 Requesting notification permissions...');
    const granted = await this.notificationService.requestPermissions();
    alert(granted ? '✅ Permisos concedidos' : '❌ Permisos denegados');
  }

  async testSimpleNotification() {
    console.log('🧪 Testing simple notification...');
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 5000); // 5 segundos
    
    const success = await this.notificationService.scheduleSimpleNotification(
      '🧪 Prueba Simple',
      'Esta es una notificación de prueba simplificada',
      scheduledAt
    );
    
    alert(success ? '✅ Notificación simple programada' : '❌ Error programando notificación simple');
  }

  async forceRescheduleNotifications() {
    console.log('🔧 Forcing reschedule of all notifications...');
    const count = await this.notificationService.forceRescheduleAll();
    alert(`🔧 Reprogramación forzada completada: ${count} notificaciones reprogramadas`);
  }

  async testWebCheck() {
    console.log('🌐 Testing web-specific notification check...');
    
    if (!this.isWebPlatform) {
      alert('❌ Este botón solo funciona en plataforma web');
      return;
    }
    
    try {
      await this.notificationService.checkExpiredNotificationsForWeb();
      alert('✅ Verificación web completada - revisa los logs');
    } catch (error) {
      console.error('❌ Error in web check:', error);
      alert('❌ Error en verificación web');
    }
  }

  async runDiagnosis() {
    console.log('🔍 Running complete notification diagnosis...');
    
    try {
      const result = await this.notificationService.diagnosisNotificationIssues();
      
      if (result) {
        const summary = `🔍 DIAGNÓSTICO COMPLETO:
📱 Plataforma: ${result.platform}
🔐 Permisos: ${result.permissions ? 'Concedidos' : 'Denegados'}  
📢 Canales: ${result.channels}
⏳ Pendientes: ${result.pending}
💾 Configuradas: ${result.savedConfigs}

Revisa la consola para más detalles.`;
        
        alert(summary);
      } else {
        alert('❌ Error en diagnóstico - revisa la consola');
      }
    } catch (error) {
      console.error('❌ Error running diagnosis:', error);
      alert('❌ Error ejecutando diagnóstico');
    }
  }

  async testCompleteNotification() {
    console.log('🧪 Starting complete notification test...');
    
    try {
      const success = await this.notificationService.testNotificationComplete();
      
      if (success) {
        alert('🧪 Prueba completa iniciada!\n\n⏰ La notificación debería aparecer en 30 segundos.\n\n📋 Revisa la consola para logs detallados.');
      } else {
        alert('❌ Error en la prueba completa - revisa la consola');
      }
    } catch (error) {
      console.error('❌ Error in complete test:', error);
      alert('❌ Error ejecutando prueba completa');
    }
  }

  async testDateFormats() {
    console.log('📅 Testing different date formats...');
    
    try {
      const success = await this.notificationService.testScheduledDateFormats();
      
      if (success) {
        alert('📅 Pruebas de formato iniciadas!\n\n⏰ Las notificaciones deberían aparecer en 1, 2 y 3 minutos.\n\n📋 Revisa la consola para ver qué formato funciona.');
      } else {
        alert('❌ Error en las pruebas de formato');
      }
    } catch (error) {
      console.error('❌ Error testing date formats:', error);
      alert('❌ Error probando formatos de fecha');
    }
  }

  async compareCalculations() {
    console.log('🔍 Comparing calculation methods...');
    
    try {
      const success = await this.notificationService.compareCalculationMethods();
      
      if (success) {
        alert('🔍 Comparación de métodos iniciada!\n\n⏰ Se programaron 3 notificaciones con diferentes métodos de cálculo.\n\nObserva cuáles llegan:\n- Método Actual (calculateNextNotificationDate)\n- Método Simple (suma directa)\n- Método Híbrido\n\n📋 Revisa la consola para logs detallados.');
      } else {
        alert('❌ Error en la comparación de métodos');
      }
    } catch (error) {
      console.error('❌ Error comparing calculations:', error);
      alert('❌ Error comparando métodos de cálculo');
    }
  }

  async diagnoseMobile() {
    console.log('📱 Running mobile-specific diagnosis...');
    
    try {
      const success = await this.notificationService.diagnoseMobileNotificationIssues();
      
      if (success) {
        alert('📱 Diagnóstico móvil iniciado!\n\n🔍 Se ejecutaron pruebas específicas para móvil:\n- Notificación inmediata\n- Notificación programada (30 seg)\n- Verificación de canales\n- Verificación de permisos\n\n📋 Revisa la consola para logs detallados y observa si llegan las notificaciones de prueba.');
      } else {
        alert('❌ Error en diagnóstico móvil o no estás en móvil');
      }
    } catch (error) {
      console.error('❌ Error in mobile diagnosis:', error);
      alert('❌ Error ejecutando diagnóstico móvil');
    }
  }

  async requestAndroidPermissions() {
    console.log('📱 Requesting Android-specific permissions...');
    
    try {
      const granted = await this.notificationService.requestAndroidPermissions();
      
      if (granted) {
        alert('✅ Permisos de Android concedidos!\n\n💡 Consejos adicionales:\n- Desactiva la optimización de batería para esta app\n- Permite actividad en segundo plano\n- Habilita "Mostrar en pantalla de bloqueo"');
      } else {
        alert('❌ Permisos de Android denegados\n\n💡 Ve a Configuración > Apps > [Esta App] > Notificaciones y habilítalas manualmente');
      }
    } catch (error) {
      console.error('❌ Error requesting Android permissions:', error);
      alert('❌ Error solicitando permisos de Android');
    }
  }

  async testVisibleNotification() {
    console.log('👁️ Testing visible notification...');
    
    try {
      const success = await this.notificationService.testVisibleNotification();
      
      if (success) {
        alert('👁️ Prueba de notificación visible iniciada!\n\n⏰ La notificación debería aparecer en 10 segundos.\n\n🔍 Esta prueba verifica si las notificaciones se muestran correctamente en tu dispositivo.\n\n📋 Observa si aparece la notificación y revisa los logs.');
      } else {
        alert('❌ Error en la prueba de notificación visible');
      }
    } catch (error) {
      console.error('❌ Error testing visible notification:', error);
      alert('❌ Error probando notificación visible');
    }
  }
}
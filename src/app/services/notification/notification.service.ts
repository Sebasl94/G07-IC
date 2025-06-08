import { Injectable } from '@angular/core';
import { LocalNotifications, Schedule, LocalNotificationSchema } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor() { 
    this.setupNotificationListeners();
  }

  private setupNotificationListeners() {
    // Listener para cuando se dispara una notificación
    LocalNotifications.addListener('localNotificationActionPerformed', async (notification) => {
      console.log('🔔 Notification action performed:', notification);
      await this.handleNotificationPerformed(notification);
    });

    // Listener para cuando se recibe una notificación (app en primer plano)
    LocalNotifications.addListener('localNotificationReceived', async (notification) => {
      console.log('🔔 Notification received:', notification);
      await this.handleNotificationReceived(notification);
    });

    console.log('✅ Notification listeners setup completed');
  }

  private async handleNotificationPerformed(notification: any) {
    console.log('🔄 Handling notification performed:', notification.notification.id);
    // Reprogramar la notificación si no es una notificación de prueba
    
      await this.rescheduleNotificationFromStorage(notification.notification.id);
    
  }

  private async handleNotificationReceived(notification: any) {
    console.log('🔄 Handling notification received:', notification.id);
    // También reprogramar cuando se recibe (para apps en primer plano)
    
      await this.rescheduleNotificationFromStorage(notification.id);
    
  }

  private async rescheduleNotificationFromStorage(notificationId: number) {
    console.log('♻️ Attempting to reschedule notification:', notificationId);
    
    try {
      // Obtener la configuración guardada
      const configString = localStorage.getItem(`notification_${notificationId}`);
      if (!configString) {
        console.error('❌ No configuration found for notification:', notificationId);
        return;
      }

      const config = JSON.parse(configString);
      console.log('📋 Found saved config:', config);

      // Calcular la próxima fecha
      const nextDate = this.calculateNextNotificationDate(config.scheduleConfig, config.reminderBy);
      console.log('📅 Next scheduled date:', nextDate);

      // Crear la nueva notificación
      const newNotification: LocalNotificationSchema = {
        id: notificationId,
        title: config.title,
        body: config.body,
        schedule: { at: nextDate },
        sound: undefined,
        attachments: undefined,
        actionTypeId: '',
        extra: JSON.stringify(config),
        largeIcon: 'res://ic_launcher',
        smallIcon: 'ic_launcher',
        summaryText: 'Recordatorio',
      };

      await LocalNotifications.schedule({
        notifications: [newNotification]
      });
      
      console.log('♻️ Notification rescheduled successfully for:', nextDate);
      
      // Verificar que se programó correctamente
      setTimeout(async () => {
        const pending = await this.getPendingNotifications();
        console.log('📋 Pending after reschedule:', pending.notifications?.length || 0);
      }, 500);
      
    } catch (error) {
      console.error('❌ Error rescheduling notification:', error);
    }
  }

  // Método manual para reprogramar (por si los listeners fallan)
  async manualRescheduleNotification(notificationId: number) {
    console.log('🔧 Manual reschedule requested for:', notificationId);
    await this.rescheduleNotificationFromStorage(notificationId);
  }

  // Método para verificar y reprogramar todas las notificaciones vencidas
  async checkAndRescheduleExpiredNotifications() {
    console.log('🔍 Checking for expired notifications...');
    
    // Obtener todas las notificaciones guardadas en localStorage
    const keys = Object.keys(localStorage).filter(key => key.startsWith('notification_'));
    
    for (const key of keys) {
      const notificationId = parseInt(key.replace('notification_', ''));
      
      // Verificar si la notificación aún está pendiente
      const pending = await LocalNotifications.getPending();
      const isPending = pending.notifications?.some(n => n.id === notificationId);
      
      if (!isPending) {
        console.log('🔄 Found expired notification, rescheduling:', notificationId);
        await this.rescheduleNotificationFromStorage(notificationId);
      }
    }
  }

  // Local Notifications

  async requestPermissions(): Promise<boolean> {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  }

  async scheduleNotification(title: string, body: string, scheduledAt: Date) {
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      console.error('Notification permissions not granted');
      return;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          title: title,
          body: body,
          id: Math.round(Math.random() * 1000000), // Unique ID for the notification
          schedule: { at: scheduledAt },
          
          sound: undefined,
          attachments: undefined,
          extra: null,
        }
      ]
    });
  }

  async scheduleRecurringNotification(options: {
    id: number;
    title: string;
    body: string;
    scheduleConfig: any;
    reminderBy: string;
  }) {
    const hasPermissions = await this.requestPermissions();
    if (!hasPermissions) {
      console.error('Notification permissions not granted');
      return;
    }

    console.log('🔔 Starting notification scheduling with options:', options);

    // Guardar la configuración para poder reprogramar después
    const notificationConfig = {
      id: options.id,
      title: options.title,
      body: options.body,
      scheduleConfig: options.scheduleConfig,
      reminderBy: options.reminderBy
    };

    // Guardar en localStorage para poder acceder después
    localStorage.setItem(`notification_${options.id}`, JSON.stringify(notificationConfig));

    // Calcular la próxima fecha de notificación
    const nextDate = this.calculateNextNotificationDate(options.scheduleConfig, options.reminderBy);
    
    console.log('📅 Next notification date calculated:', nextDate);

    const notification: LocalNotificationSchema = {
      id: options.id,
      title: options.title,
      body: options.body,
      schedule: { at: nextDate },
      sound: undefined,
      attachments: undefined,
      extra: JSON.stringify(notificationConfig),
    };

    console.log('🔔 Final notification object:', notification);

    try {
      await LocalNotifications.schedule({
        notifications: [notification]
      });
      console.log(`✅ Notification scheduled with ID: ${options.id} for ${nextDate}`);
      
      // Verificar inmediatamente qué notificaciones están pendientes
      setTimeout(async () => {
        const pending = await this.getPendingNotifications();
        console.log('📋 Pending notifications after scheduling:', pending);
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
    }
  }

  private calculateNextNotificationDate(scheduleConfig: any, reminderBy: string): Date {
    const now = new Date();
    const hour = parseInt(scheduleConfig.hour);
    const minute = parseInt(scheduleConfig.minute);

    let nextDate = new Date();

    switch (reminderBy) {
      case 'day':
        nextDate.setHours(hour, minute, 0, 0);
        // Si la hora ya pasó hoy, programar para mañana
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;
      case 'hour':
        // Para simplicidad, tratar como diario
        nextDate.setHours(hour, minute, 0, 0);
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;
      case 'week':
        const dayOfWeek = parseInt(scheduleConfig.dayOfWeek) || 1;
        nextDate.setHours(hour, minute, 0, 0);
        
        // Calcular días hasta el próximo día de la semana
        const currentDay = nextDate.getDay();
        const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7;
        
        if (daysUntilTarget === 0 && nextDate <= now) {
          // Si es hoy pero ya pasó la hora, programar para la próxima semana
          nextDate.setDate(nextDate.getDate() + 7);
        } else {
          nextDate.setDate(nextDate.getDate() + daysUntilTarget);
        }
        break;
      case 'month':
        const day = parseInt(scheduleConfig.day) || 1;
        nextDate.setDate(day);
        nextDate.setHours(hour, minute, 0, 0);
        
        // Si la fecha ya pasó este mes, programar para el próximo mes
        if (nextDate <= now) {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }
        break;
      default:
        // Por defecto, programar para mañana
        nextDate.setDate(nextDate.getDate() + 1);
        nextDate.setHours(hour, minute, 0, 0);
        break;
    }

    return nextDate;
  }

  async getPendingNotifications() {
    const pending = await LocalNotifications.getPending();
    console.log('📋 Pending notifications:', JSON.stringify(pending));
    return pending;
  }

  async cancelNotification(id: number) {
    await LocalNotifications.cancel({
      notifications: [{ id: id }]
    });
    console.log(`🗑️ Notification with ID ${id} cancelled`);
    
    // También limpiar la configuración guardada
    localStorage.removeItem(`notification_${id}`);
  }

  async removeAllNotifications() {
    await LocalNotifications.cancel({
      notifications: []
    });
    await LocalNotifications.removeAllDeliveredNotifications();
    await LocalNotifications.deleteChannel({
      id: 'default'
    });
    console.log('🗑️ All notifications removed');
  }

  // Push Notifications (código existente)
  // ... resto del código de push notifications ...
}

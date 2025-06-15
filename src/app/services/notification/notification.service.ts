import { Injectable } from '@angular/core';
import { LocalNotifications, Schedule, LocalNotificationSchema } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private isWebPlatform = false;

  constructor(private platform: Platform) { 
    this.isWebPlatform = Capacitor.getPlatform() === 'web';
    console.log('🌐 Platform detected:', Capacitor.getPlatform());
    
    this.setupNotificationListeners();
    this.initializeNotifications();
  }

  private async initializeNotifications() {
    await this.platform.ready();
    await this.createNotificationChannel();
    // Iniciar verificación periódica
    this.startPeriodicCheck();
  }

  private setupNotificationListeners() {
    console.log(`🔧 Setting up notification listeners for platform: ${Capacitor.getPlatform()}`);
    
    // Listener para cuando el usuario interactúa con una notificación
    LocalNotifications.addListener('localNotificationActionPerformed', async (notification) => {
      console.log(`🔔 [${Capacitor.getPlatform()}] Notification action performed:`, JSON.stringify(notification));
      const notificationId = (notification as any).notification?.id || (notification as any).id;
      console.log('🔍 Extracted notification ID:', notificationId);
      await this.handleNotificationPerformed(notificationId);
    });

    // Listener para cuando se recibe una notificación (app en primer plano)
    LocalNotifications.addListener('localNotificationReceived', async (notification) => {
      console.log(`🔔 [${Capacitor.getPlatform()}] Notification received:`, JSON.stringify(notification));
      const notificationId = (notification as any).id;
      console.log('🔍 Extracted notification ID:', notificationId);
      
      // IMPORTANTE: No reprogramar inmediatamente cuando se recibe
      // Esto puede interferir con la visualización de la notificación
      console.log('📱 Notification received - will reschedule after delay to allow display');
      
      // Esperar un poco antes de reprogramar para permitir que se muestre
      setTimeout(async () => {
        await this.handleNotificationReceived(notificationId);
      }, 10 * 60 * 1000); // 10 minuto de delay
    });

    // En web, agregar listener adicional para cuando las notificaciones se muestran
    if (this.isWebPlatform) {
      console.log('🌐 Adding web-specific notification listeners');
      
      // Intentar escuchar eventos de notificación del navegador directamente
      if ('Notification' in window) {
        console.log('🌐 Browser notification API available');
      }
    }

    console.log('✅ Notification listeners setup completed');
  }

  private async handleNotificationPerformed(notificationId: number) {
    console.log('🔄 Handling notification performed for ID:', notificationId);
    
    if (!notificationId) {
      console.error('❌ No notification ID provided for performed action');
      return;
    }
    
    // Reprogramar la notificación (excepto si es una de prueba)
  
      await this.rescheduleNotificationFromStorage(notificationId);

  }

  private async handleNotificationReceived(notificationId: number) {
    console.log('🔄 Handling notification received for ID:', notificationId);
    
    if (!notificationId) {
      console.error('❌ No notification ID provided for received notification');
      return;
    }
    
 
      await this.rescheduleNotificationFromStorage(notificationId);
    
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

      // Validar que la configuración tenga los datos necesarios
      if (!config.scheduleConfig || !config.reminderBy) {
        console.error('❌ Invalid configuration for notification:', notificationId);
        localStorage.removeItem(`notification_${notificationId}`);
        return;
      }

      // Calcular la próxima fecha usando el método simple que funciona
      const nextDate = this.calculateSimpleNotificationDate(config.scheduleConfig, config.reminderBy);
      console.log('📅 Next scheduled date:', nextDate);

      // Validar que la fecha calculada sea válida y en el futuro
      if (!nextDate || nextDate <= new Date()) {
        console.error('❌ Invalid next date calculated:', nextDate);
        return;
      }

      // Crear la nueva notificación
      const newNotification: LocalNotificationSchema = {
        id: notificationId,
        title: config.title,
        body: config.body,
        schedule: { at: nextDate },
        sound: 'default',
        attachments: undefined,
        actionTypeId: '',
        extra: JSON.stringify(config),
        channelId: 'medicationreminder',
        summaryText: 'Recordatorio de medicamento',
        // Configuraciones importantes para que aparezcan
        iconColor: '#488AFF',
        ongoing: false,
        autoCancel: true,
      };

      console.log('📋 About to schedule notification:', JSON.stringify(newNotification));
      
      await LocalNotifications.schedule({
        notifications: [newNotification]
      });
      
      // Guardar timestamp de la programación (especialmente útil para web)
      const timestampKey = `last_scheduled_${notificationId}`;
      localStorage.setItem(timestampKey, nextDate.toISOString());
      
      console.log('♻️ Notification rescheduled successfully for:', nextDate);
      
      // Verificar inmediatamente que se programó
      setTimeout(async () => {
        const pending = await LocalNotifications.getPending();
        const isNowPending = pending.notifications?.some(n => n.id === notificationId);
        console.log(`✅ Verification: Notification ${notificationId} is now pending: ${isNowPending}`);
        
        if (!isNowPending) {
          console.error(`❌ PROBLEM: Notification ${notificationId} was not scheduled correctly!`);
        }
      }, 500);
      
    } catch (error) {
      console.error('❌ Error rescheduling notification:', error);
      // Si hay un error, remover la configuración corrupta
      localStorage.removeItem(`notification_${notificationId}`);
      throw error;
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
    
    // En web, usar método específico basado en timestamps
    if (this.isWebPlatform) {
      await this.checkExpiredNotificationsForWeb();
      return;
    }
    
    try {
      // Obtener todas las notificaciones guardadas en localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notification_'));
      console.log(`📋 Found ${keys.length} notification configs in localStorage`);
      
      if (keys.length === 0) {
        console.log('✅ No notification configs found');
        return;
      }
      
      // Obtener todas las notificaciones pendientes una sola vez
      const pending = await LocalNotifications.getPending();
      console.log(`📋 Found ${pending.notifications?.length || 0} pending notifications`);
      console.log('📋 Pending notification IDs:', pending.notifications?.map(n => n.id) || []);
      
      let rescheduledCount = 0;
      
      for (const key of keys) {
        const notificationId = parseInt(key.replace('notification_', ''));
        console.log(`🔍 Checking notification ${notificationId}...`);
        
        // Verificar si la notificación aún está pendiente
        const isPending = pending.notifications?.some(n => n.id === notificationId);
        console.log(`📋 Notification ${notificationId} is pending: ${isPending}`);
        
        if (!isPending) {
          console.log('🔄 Found expired notification, rescheduling:', notificationId);
          try {
            await this.rescheduleNotificationFromStorage(notificationId);
            rescheduledCount++;
            
            // Verificar que se reprogramó correctamente
            const newPending = await LocalNotifications.getPending();
            const nowPending = newPending.notifications?.some(n => n.id === notificationId);
            console.log(`✅ Notification ${notificationId} now pending: ${nowPending}`);
            
          } catch (error) {
            console.error(`❌ Error rescheduling notification ${notificationId}:`, error);
            // Si hay un error, remover la configuración corrupta
            localStorage.removeItem(key);
          }
        } else {
          console.log(`✅ Notification ${notificationId} is already pending`);
        }
      }
      
      console.log(`✅ Notification check completed: ${rescheduledCount} notifications rescheduled`);
      
    } catch (error) {
      console.error('❌ Error in checkAndRescheduleExpiredNotifications:', error);
    }
  }

  // Local Notifications

  async requestPermissions(): Promise<boolean> {
    try {
      console.log('🔐 Requesting notification permissions...');
      
      // Verificar si ya tenemos permisos
      const currentPermissions = await LocalNotifications.checkPermissions();
      console.log('📋 Current permissions:', currentPermissions);

      if (currentPermissions.display === 'granted') {
        console.log('✅ Permissions already granted');
        return true;
      }

      // Solicitar permisos
      const result = await LocalNotifications.requestPermissions();
      console.log('📋 Permission request result:', result);
      
      if (result.display === 'granted') {
        console.log('✅ Notification permissions granted');
        return true;
      } else {
        console.error('❌ Notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return false;
    }
  }

  // Método específico para solicitar permisos de Android con más detalle
  async requestAndroidPermissions(): Promise<boolean> {
    try {
      console.log('📱 Requesting Android-specific notification permissions...');
      
      const platform = Capacitor.getPlatform();
      if (platform !== 'android') {
        console.log('⚠️ This method is specific for Android');
        return await this.requestPermissions();
      }
      
      // Verificar permisos actuales
      const currentPermissions = await LocalNotifications.checkPermissions();
      console.log('📱 Android current permissions:', JSON.stringify(currentPermissions, null, 2));

      if (currentPermissions.display === 'granted') {
        console.log('✅ Android permissions already granted');
        
        // Verificar si necesitamos permisos adicionales para alarmas exactas (Android 12+)
        try {
          // Esto es específico para Android - verificar si podemos programar alarmas exactas
          console.log('📱 Checking exact alarm permissions...');
          
          // En Android 12+, necesitamos permisos especiales para alarmas exactas
          // Por ahora, solo logueamos que deberíamos verificar esto
          console.log('💡 Note: For Android 12+, exact alarm permissions might be needed');
          
        } catch (alarmError) {
          console.warn('⚠️ Could not check exact alarm permissions:', alarmError);
        }
        
        return true;
      }

      // Solicitar permisos con más contexto
      console.log('📱 Requesting Android notification permissions...');
      const result = await LocalNotifications.requestPermissions();
      console.log('📱 Android permission request result:', JSON.stringify(result, null, 2));
      
      if (result.display === 'granted') {
        console.log('✅ Android notification permissions granted');
        
        // Mostrar mensaje al usuario sobre configuraciones adicionales
        console.log('💡 Android permissions granted. User may need to:');
        console.log('   - Disable battery optimization for this app');
        console.log('   - Allow background activity');
        console.log('   - Enable "Show on lock screen" in notification settings');
        
        return true;
      } else {
        console.error('❌ Android notification permissions denied');
        console.log('💡 User needs to manually enable notifications in Android settings');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting Android permissions:', error);
      return false;
    }
  }

  async scheduleNotification(title: string, body: string, scheduledAt: Date) {
    try {
      console.log('🔔 Scheduling notification:', { title, body, scheduledAt });
      
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('❌ Notification permissions not granted');
        return false;
      }

      const notification: LocalNotificationSchema = {
        title: title,
        body: body,
        id: Math.round(Math.random() * 1000000),
        schedule: { at: scheduledAt },
        sound: 'default',
        attachments: undefined,
        extra: null,
        channelId: 'medicationreminder',
        // Configuraciones importantes para que aparezcan
        iconColor: '#488AFF',
        ongoing: false,
        autoCancel: true,
      };

      await LocalNotifications.schedule({
        notifications: [notification]
      });
      
      console.log('✅ Notification scheduled successfully');
      return true;
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
      return false;
    }
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

    // Calcular la próxima fecha de notificación usando el método simple que funciona
    const nextDate = this.calculateSimpleNotificationDate(options.scheduleConfig, options.reminderBy);
    
    console.log('📅 Next notification date calculated:', nextDate);

    const notification: LocalNotificationSchema = {
      id: options.id,
      title: options.title,
      body: options.body,
      schedule: { at: nextDate },
      sound: 'default',
      attachments: undefined,
      extra: JSON.stringify(notificationConfig),
      channelId: 'medicationreminder',
      // Configuraciones importantes para que aparezcan
      iconColor: '#488AFF',
      ongoing: false,
      autoCancel: true,
    };

    console.log('🔔 Final notification object:', notification);

    try {
      await LocalNotifications.schedule({
        notifications: [notification]
      });
      
      // Guardar timestamp de la programación inicial (especialmente útil para web)
      const timestampKey = `last_scheduled_${options.id}`;
      localStorage.setItem(timestampKey, nextDate.toISOString());
      
      console.log(`✅ Notification scheduled with ID: ${options.id} for ${nextDate}`);
      
      // Verificar inmediatamente qué notificaciones están pendientes
      setTimeout(async () => {
        const pending = await this.getPendingNotifications();
        console.log('📋 Pending notifications after scheduling:', JSON.stringify(pending));
      }, 1000);
      
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
    }
  }

  // Método mejorado que usa el cálculo simple que funciona
  async scheduleSimpleRecurringNotification(options: {
    id: number;
    title: string;
    body: string;
    scheduleConfig: any;
    reminderBy: string;
  }) {
    // Usar método específico de Android si estamos en Android
    const hasPermissions = Capacitor.getPlatform() === 'android' 
      ? await this.requestAndroidPermissions()
      : await this.requestPermissions();
      
    if (!hasPermissions) {
      console.error('❌ Notification permissions not granted');
      return false;
    }

    console.log('✨ Starting SIMPLE notification scheduling with options:', options);

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

    // Calcular la próxima fecha usando el método simple que SÍ funciona
    const nextDate = this.calculateSimpleNotificationDate(options.scheduleConfig, options.reminderBy);
    
    console.log('✨ Next notification date calculated (SIMPLE):', nextDate);

    // Asegurar que el canal existe antes de programar
    await this.createNotificationChannel();
    
    // Usar el método optimizado para Android
    const notification = this.createAndroidOptimizedNotification({
      id: options.id,
      title: options.title,
      body: options.body,
      scheduledAt: nextDate,
      extra: notificationConfig
    });

    console.log('✨ Final SIMPLE notification object:', JSON.stringify(notification));

    try {
      await LocalNotifications.schedule({
        notifications: [notification]
      });
      
      // Guardar timestamp de la programación inicial
      const timestampKey = `last_scheduled_${options.id}`;
      localStorage.setItem(timestampKey, nextDate.toISOString());
      
      console.log(`✅ SIMPLE notification scheduled with ID: ${options.id} for ${nextDate}`);
      
      // Verificar inmediatamente que se programó
      setTimeout(async () => {
        const pending = await this.getPendingNotifications();
        const isScheduled = pending.notifications?.some(n => n.id === options.id);
        console.log(`✅ SIMPLE notification ${options.id} is pending: ${isScheduled}`);
        
        if (isScheduled) {
          console.log('🎉 SUCCESS: Simple notification was scheduled correctly!');
        } else {
          console.error('❌ PROBLEM: Simple notification was not scheduled correctly!');
        }
      }, 1000);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error scheduling SIMPLE notification:', error);
      return false;
    }
  }

  private calculateNextNotificationDate(scheduleConfig: any, reminderBy: string): Date {
    const now = new Date();
    const hour = parseInt(scheduleConfig.hour) || 9; // Default 9 AM
    const minute = parseInt(scheduleConfig.minute) || 0; // Default 0 minutes

    console.log('🕐 Calculating notification date with:', { 
      scheduleConfig, 
      reminderBy, 
      hour, 
      minute, 
      now: now.toISOString(),
      nowLocal: now.toString()
    });

    let nextDate = new Date();

    switch (reminderBy) {
      case 'day':
        nextDate.setHours(hour, minute, 0, 0);
        console.log('📅 Set to today at specified time:', nextDate.toISOString());
        
        // Si la hora ya pasó hoy, programar para mañana
        if (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
          console.log('📅 Time already passed, moved to tomorrow:', nextDate.toISOString());
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
        
        console.log('📅 Week calculation:', { currentDay, dayOfWeek, daysUntilTarget });
        
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
        // Por defecto, programar para el próximo minuto (para pruebas)
        console.log('📅 Using default case - 1 minute from now');
        nextDate = new Date(now.getTime() + 60000); // 1 minuto después
        break;
    }

    console.log('📅 Calculated next date:', nextDate.toISOString());
    console.log('📅 Calculated next date (local):', nextDate.toString());
    console.log('📅 Minutes from now:', Math.round((nextDate.getTime() - now.getTime()) / 60000));
    
    // Validar que la fecha esté en el futuro
    if (nextDate <= now) {
      console.warn('⚠️ Calculated date is in the past! Adjusting to 2 minutes from now...');
      nextDate = new Date(now.getTime() + 2 * 60000); // 2 minutos después
    }
    
    // Validar que la fecha no sea muy lejana (más de 1 año)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
    
    if (nextDate > oneYearFromNow) {
      console.warn('⚠️ Calculated date is too far in the future, adjusting...');
      nextDate = new Date(now.getTime() + 60000); // 1 minuto después
    }

    console.log('📅 Final validated date:', nextDate.toISOString());
    return nextDate;
  }

  // Nuevo método simple que SÍ funciona (basado en el método exitoso)
  private calculateSimpleNotificationDate(scheduleConfig: any, reminderBy: string): Date {
    const now = new Date();
    const hour = parseInt(scheduleConfig.hour) || 9;
    const minute = parseInt(scheduleConfig.minute) || 0;

    console.log('✨ Calculating SIMPLE notification date with:', { 
      scheduleConfig, 
      reminderBy, 
      hour, 
      minute, 
      now: now.toISOString()
    });

    let targetTime: Date;

    switch (reminderBy) {
      case 'day':
        // Crear fecha objetivo para hoy
        targetTime = new Date();
        targetTime.setHours(hour, minute, 0, 0);
        
        // Si ya pasó la hora de hoy, programar para mañana
        if (targetTime <= now) {
          targetTime = new Date(targetTime.getTime() + 24 * 60 * 60 * 1000); // +1 día
        }
        break;
        
      case 'hour':
        // Para recordatorios por hora, tratar como diario por simplicidad
        targetTime = new Date();
        targetTime.setHours(hour, minute, 0, 0);
        
        if (targetTime <= now) {
          targetTime = new Date(targetTime.getTime() + 24 * 60 * 60 * 1000); // +1 día
        }
        break;
        
      case 'week':
        const dayOfWeek = parseInt(scheduleConfig.dayOfWeek) || 1;
        
        // Crear fecha objetivo para hoy
        targetTime = new Date();
        targetTime.setHours(hour, minute, 0, 0);
        
        // Calcular días hasta el día objetivo de la semana
        const currentDay = targetTime.getDay();
        let daysToAdd = (dayOfWeek - currentDay + 7) % 7;
        
        // Si es hoy pero ya pasó la hora, programar para la próxima semana
        if (daysToAdd === 0 && targetTime <= now) {
          daysToAdd = 7;
        }
        
        targetTime = new Date(targetTime.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        break;
        
      case 'month':
        const day = parseInt(scheduleConfig.day) || 1;
        
        // Crear fecha objetivo para este mes
        targetTime = new Date();
        targetTime.setDate(day);
        targetTime.setHours(hour, minute, 0, 0);
        
        // Si ya pasó este mes, programar para el próximo mes
        if (targetTime <= now) {
          targetTime = new Date(targetTime.getTime());
          targetTime.setMonth(targetTime.getMonth() + 1);
        }
        break;
        
      default:
        // Por defecto, 2 minutos en el futuro para pruebas
        console.log('✨ Using default case - 2 minutes from now');
        targetTime = new Date(now.getTime() + 2 * 60000);
        break;
    }

    // Validación final: asegurar que esté en el futuro
    if (targetTime <= now) {
      console.warn('⚠️ Simple calculated date is in the past! Adding 2 minutes...');
      targetTime = new Date(now.getTime() + 2 * 60000);
    }

    console.log('✨ Simple calculated date:', targetTime.toISOString());
    console.log('✨ Simple calculated date (local):', targetTime.toString());
    console.log('✨ Minutes from now:', Math.round((targetTime.getTime() - now.getTime()) / 60000));

    return targetTime;
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
    try {
      // Obtener todas las notificaciones pendientes
      const pending = await LocalNotifications.getPending();
      if (pending.notifications && pending.notifications.length > 0) {
        // Cancelar todas las notificaciones pendientes
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
      }
      
      // Remover todas las notificaciones entregadas
      await LocalNotifications.removeAllDeliveredNotifications();
      
      // Limpiar todas las configuraciones del localStorage
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notification_'));
      keys.forEach(key => localStorage.removeItem(key));
      
      console.log(`🗑️ All notifications removed (${pending.notifications?.length || 0} cancelled, ${keys.length} configs cleared)`);
    } catch (error) {
      console.error('❌ Error removing notifications:', error);
    }
  }

  // Push Notifications (código existente)
  // ... resto del código de push notifications ...

  private async createNotificationChannel() {
    try {
      console.log('📢 Creating notification channel for platform:', Capacitor.getPlatform());
      
      // Verificar si el canal ya existe
      const channels = await LocalNotifications.listChannels();
      console.log('📢 Existing channels:', JSON.stringify(channels));
      
      const channelExists = channels.channels?.some(ch => ch.id === 'medicationreminder');
      
      if (!channelExists) {
        console.log('📢 Creating new notification channel...');
        
        await LocalNotifications.createChannel({
          id: 'medicationreminder',
          name: 'Recordatorios de Medicamentos',
          description: 'Notificaciones críticas para recordar tomar medicamentos',
          importance: 5, // MAX importance - crítico para que aparezcan
          visibility: 1, // VISIBILITY_PUBLIC - mostrar en pantalla de bloqueo
          sound: 'default',
          vibration: true,
          lights: true,
          lightColor: '#488AFF'
        });
        
        console.log('✅ Notification channel created successfully');
        
        // Verificar que se creó correctamente
        const newChannels = await LocalNotifications.listChannels();
        console.log('📢 Channels after creation:', JSON.stringify(newChannels));
        
      } else {
        console.log('✅ Notification channel already exists');
      }
    } catch (error) {
      console.error('❌ Error creating notification channel:', error);
      
      // Intentar crear un canal básico como fallback
      try {
        console.log('🔄 Attempting to create basic fallback channel...');
        await LocalNotifications.createChannel({
          id: 'medicationreminder',
          name: 'Recordatorios',
          importance: 4
        });
        console.log('✅ Basic fallback channel created');
      } catch (fallbackError) {
        console.error('❌ Even fallback channel creation failed:', fallbackError);
      }
    }
  }

  // Método para verificar el estado del sistema de notificaciones
  async checkNotificationStatus() {
    try {
      console.log('🔍 Checking notification system status...');
      
      // Verificar permisos
      const permissions = await LocalNotifications.checkPermissions();
      console.log('📋 Permissions status:', permissions);
      
      // Verificar notificaciones pendientes
      const pending = await LocalNotifications.getPending();
      console.log('📋 Pending notifications:', pending.notifications?.length || 0);
      
      // Verificar si el canal existe
      const channels = await LocalNotifications.listChannels();
      console.log('📋 Available channels:', channels);
      
      return {
        permissions: permissions.display === 'granted',
        pendingCount: pending.notifications?.length || 0,
        channelsExist: channels.channels?.length > 0
      };
    } catch (error) {
      console.error('❌ Error checking notification status:', error);
      return null;
    }
  }

  // Método para solicitar desactivar optimización de batería (Android)
  async requestBatteryOptimizationDisable() {
    try {
      console.log('🔋 Requesting to disable battery optimization...');
      // Este método se puede expandir con un plugin específico si es necesario
      console.log('💡 Please disable battery optimization for this app in device settings');
      return true;
    } catch (error) {
      console.error('❌ Error requesting battery optimization disable:', error);
      return false;
    }
  }

  // Método simplificado para pruebas (sin canal personalizado)
  async scheduleSimpleNotification(title: string, body: string, scheduledAt: Date) {
    try {
      console.log('🔔 Scheduling simple notification:', { title, body, scheduledAt });
      
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('❌ Notification permissions not granted');
        return false;
      }

      const notification: LocalNotificationSchema = {
        title: title,
        body: body,
        id: Math.round(Math.random() * 1000000),
        schedule: { at: scheduledAt },
        // Configuración mínima
        sound: 'default'
      };

      await LocalNotifications.schedule({
        notifications: [notification]
      });
      
      console.log('✅ Simple notification scheduled successfully');
      return true;
    } catch (error) {
      console.error('❌ Error scheduling simple notification:', error);
      return false;
    }
  }

  // Sistema de verificación periódica
  private startPeriodicCheck() {
    // En web, verificar más frecuentemente ya que los listeners no funcionan bien
    const checkInterval = this.isWebPlatform ? 2 * 60 * 1000 : 5 * 60 * 1000; // 2 min en web, 5 min en móvil
    const initialDelay = this.isWebPlatform ? 5000 : 10000; // 5 seg en web, 10 seg en móvil
    
    console.log(`⏰ Starting periodic check: interval=${checkInterval/1000}s, platform=${Capacitor.getPlatform()}`);
    
    setInterval(async () => {
      console.log('⏰ Periodic notification check started');
      await this.checkAndRescheduleExpiredNotifications();
    }, checkInterval);

    // También verificar al iniciar
    setTimeout(async () => {
      console.log('🔄 Initial notification check on startup');
      await this.checkAndRescheduleExpiredNotifications();
    }, initialDelay);
  }

  // Método para forzar la reprogramación de todas las notificaciones
  async forceRescheduleAll() {
    console.log('🔧 Forcing reschedule of all notifications...');
    
    try {
      // Obtener todas las configuraciones guardadas
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notification_'));
      console.log(`📋 Found ${keys.length} notification configs to reschedule`);
      
      let rescheduledCount = 0;
      
      for (const key of keys) {
        const notificationId = parseInt(key.replace('notification_', ''));
        console.log(`🔄 Force rescheduling notification ${notificationId}`);
        
        try {
          await this.rescheduleNotificationFromStorage(notificationId);
          rescheduledCount++;
        } catch (error) {
          console.error(`❌ Error force rescheduling ${notificationId}:`, error);
        }
      }
      
      console.log(`✅ Force reschedule completed: ${rescheduledCount}/${keys.length} notifications rescheduled`);
      return rescheduledCount;
      
    } catch (error) {
      console.error('❌ Error in forceRescheduleAll:', error);
      return 0;
    }
  }

  // Sistema específico para web: detectar notificaciones vencidas por timestamp
  async checkExpiredNotificationsForWeb() {
    if (!this.isWebPlatform) return;
    
    console.log('🌐 Checking expired notifications specifically for web...');
    
    try {
      // Obtener todas las configuraciones guardadas
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notification_'));
      console.log(`🌐 Found ${keys.length} notification configs to check`);
      
      const now = new Date();
      let rescheduledCount = 0;
      
      for (const key of keys) {
        const notificationId = parseInt(key.replace('notification_', ''));
        
        try {
          const configString = localStorage.getItem(key);
          if (!configString) continue;
          
          const config = JSON.parse(configString);
          
          // Verificar si tenemos un timestamp de la última programación
          const lastScheduledKey = `last_scheduled_${notificationId}`;
          const lastScheduledString = localStorage.getItem(lastScheduledKey);
          
          if (lastScheduledString) {
            const lastScheduled = new Date(lastScheduledString);
            const timeSinceScheduled = now.getTime() - lastScheduled.getTime();
            
            console.log(`🌐 Notification ${notificationId}: last scheduled ${timeSinceScheduled/1000}s ago`);
            
            // Si han pasado más de 2 minutos desde la última programación, reprogramar (más agresivo en web)
            if (timeSinceScheduled > 15 * 60 * 1000) {
              console.log(`🌐 Notification ${notificationId} appears to be expired, rescheduling...`);
              await this.rescheduleNotificationFromStorage(notificationId);
              rescheduledCount++;
            }
          } else {
            // Si no hay timestamp, asumir que necesita reprogramación
            console.log(`🌐 Notification ${notificationId} has no timestamp, rescheduling...`);
            await this.rescheduleNotificationFromStorage(notificationId);
            rescheduledCount++;
          }
          
        } catch (error) {
          console.error(`🌐 Error checking notification ${notificationId}:`, error);
        }
      }
      
      console.log(`🌐 Web-specific check completed: ${rescheduledCount} notifications rescheduled`);
      
    } catch (error) {
      console.error('🌐 Error in web-specific notification check:', error);
    }
  }

  // Método de diagnóstico detallado para notificaciones
  async diagnosisNotificationIssues() {
    console.log('🔍 === DIAGNÓSTICO COMPLETO DE NOTIFICACIONES ===');
    
    try {
      // 1. Verificar plataforma
      console.log('1️⃣ Platform:', Capacitor.getPlatform());
      
      // 2. Verificar permisos
      const permissions = await LocalNotifications.checkPermissions();
      console.log('2️⃣ Permissions:', JSON.stringify(permissions));
      
      // 3. Verificar canales
      const channels = await LocalNotifications.listChannels();
      console.log('3️⃣ Channels:', JSON.stringify(channels));
      
      // 4. Verificar notificaciones pendientes
      const pending = await LocalNotifications.getPending();
      console.log('4️⃣ Pending notifications:', JSON.stringify(pending));
      
      // 5. Verificar configuraciones guardadas
      const keys = Object.keys(localStorage).filter(key => key.startsWith('notification_'));
      console.log('5️⃣ Saved configs:', keys.length);
      
      keys.forEach(key => {
        const config = localStorage.getItem(key);
        console.log(`   ${key}:`, config);
        
        const timestampKey = key.replace('notification_', 'last_scheduled_');
        const timestamp = localStorage.getItem(timestampKey);
        console.log(`   ${timestampKey}:`, timestamp);
      });
      
      // 6. Verificar fechas calculadas
      for (const key of keys) {
        const notificationId = parseInt(key.replace('notification_', ''));
        const configString = localStorage.getItem(key);
        
        if (configString) {
          const config = JSON.parse(configString);
          const nextDate = this.calculateNextNotificationDate(config.scheduleConfig, config.reminderBy);
          console.log(`6️⃣ Next date for ID ${notificationId}:`, nextDate.toISOString(), '(in', Math.round((nextDate.getTime() - Date.now()) / 1000 / 60), 'minutes)');
        }
      }
      
      // 7. Verificar si hay problemas con el navegador (en web)
      if (this.isWebPlatform) {
        console.log('7️⃣ Web platform checks:');
        console.log('   - Notification API available:', 'Notification' in window);
        console.log('   - Service Worker available:', 'serviceWorker' in navigator);
        console.log('   - Permission state:', Notification.permission);
      }
      
      return {
        platform: Capacitor.getPlatform(),
        permissions,
        channels: channels.channels?.length || 0,
        pending: pending.notifications?.length || 0,
        savedConfigs: keys.length
      };
      
    } catch (error) {
      console.error('❌ Error in diagnosis:', error);
      return null;
    }
  }

  // Método de prueba completa con verificación paso a paso
  async testNotificationComplete() {
    console.log('🧪 === PRUEBA COMPLETA DE NOTIFICACIÓN ===');
    
    try {
      // 1. Verificar permisos
      console.log('1️⃣ Checking permissions...');
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('❌ No permissions granted');
        return false;
      }
      console.log('✅ Permissions OK');
      
      // 2. Verificar canal
      console.log('2️⃣ Checking channel...');
      const channels = await LocalNotifications.listChannels();
      const hasChannel = channels.channels?.some(ch => ch.id === 'medicationreminder');
      if (!hasChannel) {
        console.log('🔄 Creating channel...');
        await this.createNotificationChannel();
      }
      console.log('✅ Channel OK');
      
      // 3. Programar notificación de prueba para 30 segundos
      console.log('3️⃣ Scheduling test notification...');
      const testId = 888888;
      const now = new Date();
      const scheduledAt = new Date(now.getTime() + 30000); // 30 segundos
      
      const testNotification: LocalNotificationSchema = {
        id: testId,
        title: '🧪 PRUEBA COMPLETA',
        body: `Notificación de prueba programada para ${scheduledAt.toLocaleTimeString()}`,
        schedule: { at: scheduledAt },
        sound: 'default',
        attachments: undefined,
        extra: JSON.stringify({ test: true }),
        channelId: 'medicationreminder',
        iconColor: '#488AFF',
        ongoing: false,
        autoCancel: true,
        summaryText: 'Prueba de notificación',
      };
      
      console.log('📋 Test notification config:', JSON.stringify(testNotification));
      
      await LocalNotifications.schedule({
        notifications: [testNotification]
      });
      
      console.log('✅ Test notification scheduled');
      
      // 4. Verificar que se programó
      setTimeout(async () => {
        console.log('4️⃣ Verifying scheduled notification...');
        const pending = await LocalNotifications.getPending();
        const isScheduled = pending.notifications?.some(n => n.id === testId);
        
        if (isScheduled) {
          console.log('✅ Test notification is pending correctly');
          console.log(`⏰ It should appear in ${Math.round((scheduledAt.getTime() - Date.now()) / 1000)} seconds`);
        } else {
          console.error('❌ Test notification was NOT scheduled correctly');
          console.log('📋 Current pending notifications:', JSON.stringify(pending));
        }
      }, 1000);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error in complete test:', error);
      return false;
    }
  }

  // Método para probar diferentes formatos de fecha programada
  async testScheduledDateFormats() {
    console.log('📅 === PROBANDO FORMATOS DE FECHA PROGRAMADA ===');
    
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('❌ No permissions');
        return false;
      }
      
      const now = new Date();
      console.log('🕐 Current time:', now.toISOString());
      console.log('🕐 Current local time:', now.toString());
      
      // Probar diferentes formatos de fecha
      const testDates = [
        // 1 minuto en el futuro - diferentes formatos
        {
          name: 'ISO String',
          date: new Date(now.getTime() + 60000),
          format: 'toISOString'
        },
        {
          name: 'Date Object', 
          date: new Date(now.getTime() + 120000),
          format: 'direct'
        },
        {
          name: 'Timestamp',
          date: now.getTime() + 180000,
          format: 'timestamp'
        }
      ];
      
      for (let i = 0; i < testDates.length; i++) {
        const test = testDates[i];
        const testId = 777000 + i;
        
        console.log(`\n📅 Test ${i + 1}: ${test.name}`);
        console.log('   Original date:', test.date);
        
                          let scheduleDate: Date;
         if (test.format === 'toISOString') {
           scheduleDate = test.date as Date;
         } else if (test.format === 'direct') {
           scheduleDate = test.date as Date;
         } else {
           scheduleDate = new Date(test.date as number);
         }
         
         console.log('   Schedule date:', scheduleDate);
         console.log('   Type:', typeof scheduleDate);
         console.log('   ISO String:', scheduleDate.toISOString());
         
         const testNotification: LocalNotificationSchema = {
           id: testId,
           title: `📅 Test ${test.name}`,
           body: `Programada con formato: ${test.format}`,
           schedule: { at: scheduleDate },
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        };
        
        console.log('   Final schedule config:', JSON.stringify(testNotification.schedule));
        
        await LocalNotifications.schedule({
          notifications: [testNotification]
        });
        
        console.log(`✅ Test ${i + 1} scheduled`);
        
        // Verificar inmediatamente
        setTimeout(async () => {
          const pending = await LocalNotifications.getPending();
          const isScheduled = pending.notifications?.some(n => n.id === testId);
          console.log(`   ✅ Test ${i + 1} is pending: ${isScheduled}`);
          
          if (isScheduled) {
            const notification = pending.notifications?.find(n => n.id === testId);
            console.log(`   📋 Scheduled for: ${notification?.schedule?.at}`);
          }
        }, 1000);
      }
      
      console.log('\n⏰ Las notificaciones deberían aparecer en 1, 2 y 3 minutos respectivamente');
      console.log('📋 Observa cuál formato funciona');
      
      return true;
      
    } catch (error) {
      console.error('❌ Error testing date formats:', error);
      return false;
    }
  }

  // Método alternativo: usar setTimeout en lugar de schedule para evitar problemas
  async scheduleNotificationWithTimeout(title: string, body: string, delayMs: number) {
    console.log('⏰ Scheduling notification with setTimeout:', { title, body, delayMs });
    
    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('❌ No permissions for timeout notification');
        return false;
      }
      
      // Programar notificación simple después del delay
      setTimeout(async () => {
        console.log('⏰ Timeout reached, showing notification:', title);
        
        const notification: LocalNotificationSchema = {
          id: Math.round(Math.random() * 1000000),
          title: title,
          body: body,
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        };
        
        await LocalNotifications.schedule({
          notifications: [notification]
        });
        
        console.log('✅ Timeout notification shown');
      }, delayMs);
      
      console.log(`✅ Timeout notification set for ${delayMs/1000} seconds from now`);
      return true;
      
    } catch (error) {
      console.error('❌ Error scheduling timeout notification:', error);
      return false;
    }
  }

  // Método para comparar cálculos de fecha - diagnóstico
  async compareCalculationMethods() {
    console.log('🔍 === COMPARANDO MÉTODOS DE CÁLCULO DE FECHA ===');
    
    try {
      const now = new Date();
      console.log('🕐 Current time:', now.toISOString());
      
      // Simular configuración típica del formulario
      const scheduleConfig = {
        hour: 14,  // 2 PM
        minute: 30,
        day: 15,
        dayOfWeek: 1,
        numberFrecuency: 1
      };
      
      // Método 1: Usando calculateNextNotificationDate (el que falla)
      console.log('\n1️⃣ Método calculateNextNotificationDate (actual):');
      const calculatedDate = this.calculateNextNotificationDate(scheduleConfig, 'day');
      console.log('   Resultado:', calculatedDate.toISOString());
      console.log('   Minutos desde ahora:', Math.round((calculatedDate.getTime() - now.getTime()) / 60000));
      
      // Método 2: Método simple que funciona (como en testScheduledDateFormats)
      console.log('\n2️⃣ Método simple (como en las pruebas exitosas):');
      const simpleDate = new Date(now.getTime() + 2 * 60000); // 2 minutos en el futuro
      console.log('   Resultado:', simpleDate.toISOString());
      console.log('   Minutos desde ahora:', Math.round((simpleDate.getTime() - now.getTime()) / 60000));
      
      // Método 3: Método híbrido - calcular la diferencia en minutos y usar suma simple
      console.log('\n3️⃣ Método híbrido (calcular diferencia y usar suma):');
      const targetHour = scheduleConfig.hour;
      const targetMinute = scheduleConfig.minute;
      
      // Crear fecha objetivo para hoy
      const todayTarget = new Date();
      todayTarget.setHours(targetHour, targetMinute, 0, 0);
      
      let hybridDate;
      if (todayTarget > now) {
        // Si es hoy y aún no ha pasado la hora
        hybridDate = new Date(todayTarget.getTime());
      } else {
        // Si ya pasó, programar para mañana
        const tomorrowTarget = new Date(todayTarget.getTime() + 24 * 60 * 60 * 1000);
        hybridDate = new Date(tomorrowTarget.getTime());
      }
      
      console.log('   Resultado:', hybridDate.toISOString());
      console.log('   Minutos desde ahora:', Math.round((hybridDate.getTime() - now.getTime()) / 60000));
      
      // Probar los 3 métodos programando notificaciones
      console.log('\n📋 Programando notificaciones de prueba con los 3 métodos...');
      
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        console.error('❌ No permissions');
        return false;
      }
      
      // Notificación con método actual (calculateNextNotificationDate)
      const testId1 = 990001;
      await LocalNotifications.schedule({
        notifications: [{
          id: testId1,
          title: '🔍 Método Actual',
          body: `Calculado con calculateNextNotificationDate: ${calculatedDate.toLocaleTimeString()}`,
          schedule: { at: calculatedDate },
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        }]
      });
      
      // Notificación con método simple
      const testId2 = 990002;
      await LocalNotifications.schedule({
        notifications: [{
          id: testId2,
          title: '🔍 Método Simple',
          body: `Calculado con suma simple: ${simpleDate.toLocaleTimeString()}`,
          schedule: { at: simpleDate },
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        }]
      });
      
      // Notificación con método híbrido
      const testId3 = 990003;
      await LocalNotifications.schedule({
        notifications: [{
          id: testId3,
          title: '🔍 Método Híbrido',
          body: `Calculado con método híbrido: ${hybridDate.toLocaleTimeString()}`,
          schedule: { at: hybridDate },
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        }]
      });
      
      console.log('✅ Tres notificaciones de comparación programadas');
      console.log('📋 Observa cuáles llegan para identificar el problema');
      
      // Verificar que se programaron
      setTimeout(async () => {
        const pending = await LocalNotifications.getPending();
        console.log('📋 Notificaciones pendientes después de la comparación:');
        pending.notifications?.forEach(n => {
          console.log(`   ID ${n.id}: ${n.title} - ${n.schedule?.at}`);
        });
      }, 1000);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error in comparison test:', error);
      return false;
    }
  }

  // Método específico para diagnosticar problemas en móvil
  async diagnoseMobileNotificationIssues() {
    console.log('📱 === DIAGNÓSTICO ESPECÍFICO PARA MÓVIL ===');
    
    try {
      const platform = Capacitor.getPlatform();
      console.log('📱 Platform:', platform);
      
      if (platform === 'web') {
        console.log('⚠️ Este diagnóstico es específico para móvil');
        return false;
      }
      
      // 1. Verificar permisos detalladamente
      console.log('1️⃣ Checking detailed permissions...');
      const permissions = await LocalNotifications.checkPermissions();
      console.log('📱 Detailed permissions:', JSON.stringify(permissions, null, 2));
      
      // 2. Verificar canales (Android)
      console.log('2️⃣ Checking notification channels...');
      const channels = await LocalNotifications.listChannels();
      console.log('📱 Available channels:', JSON.stringify(channels, null, 2));
      
      // 3. Probar notificación inmediata en móvil
      console.log('3️⃣ Testing immediate notification on mobile...');
      const immediateId = 888001;
      
      await LocalNotifications.schedule({
        notifications: [{
          id: immediateId,
          title: '📱 Prueba Móvil Inmediata',
          body: 'Si ves esto, las notificaciones inmediatas funcionan en móvil',
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        }]
      });
      
      console.log('📱 Immediate mobile notification scheduled');
      
      // 4. Probar notificación programada simple en móvil
      console.log('4️⃣ Testing scheduled notification on mobile...');
      const scheduledId = 888002;
      const scheduledTime = new Date(Date.now() + 30000); // 30 segundos
      
      await LocalNotifications.schedule({
        notifications: [{
          id: scheduledId,
          title: '📱 Prueba Móvil Programada',
          body: `Programada para ${scheduledTime.toLocaleTimeString()}`,
          schedule: { at: scheduledTime },
          sound: 'default',
          channelId: 'medicationreminder',
          iconColor: '#488AFF',
          ongoing: false,
          autoCancel: true,
        }]
      });
      
      console.log('📱 Scheduled mobile notification set for:', scheduledTime);
      
      // 5. Verificar notificaciones pendientes
      setTimeout(async () => {
        console.log('5️⃣ Checking pending notifications...');
        const pending = await LocalNotifications.getPending();
        console.log('📱 Pending notifications:', JSON.stringify(pending, null, 2));
        
        const isScheduledPending = pending.notifications?.some(n => n.id === scheduledId);
        console.log('📱 Scheduled notification is pending:', isScheduledPending);
        
        if (!isScheduledPending) {
          console.error('❌ PROBLEM: Scheduled notification is not pending on mobile!');
        }
      }, 1000);
      
      // 6. Información del sistema
      console.log('6️⃣ System information...');
      console.log('📱 User agent:', navigator.userAgent);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error in mobile diagnosis:', error);
      return false;
    }
  }

  // Método específico para crear notificaciones que se muestren en Android
  private createAndroidOptimizedNotification(options: {
    id: number;
    title: string;
    body: string;
    scheduledAt: Date;
    extra?: any;
  }): LocalNotificationSchema {
    
    const baseNotification: LocalNotificationSchema = {
      id: options.id,
      title: options.title,
      body: options.body,
      schedule: { at: options.scheduledAt },
      sound: 'default',
      channelId: 'medicationreminder',
      iconColor: '#488AFF',
      ongoing: false,
      autoCancel: true,
      summaryText: 'Recordatorio de medicamento',
      extra: options.extra ? JSON.stringify(options.extra) : undefined,
    };

    // Configuraciones específicas para Android
    if (Capacitor.getPlatform() === 'android') {
      return {
        ...baseNotification,
        // Configuraciones adicionales para Android que están soportadas
        group: 'medication-reminders',
        groupSummary: false,
      };
    }

    return baseNotification;
  }

  // Método para probar notificaciones que se muestren visualmente
  async testVisibleNotification() {
    console.log('👁️ === PROBANDO NOTIFICACIÓN VISIBLE ===');
    
    try {
      const hasPermissions = Capacitor.getPlatform() === 'android' 
        ? await this.requestAndroidPermissions()
        : await this.requestPermissions();
        
      if (!hasPermissions) {
        console.error('❌ No permissions for visible notification test');
        return false;
      }
      
      // Asegurar que el canal existe
      await this.createNotificationChannel();
      
      const testId = 999001;
      const now = new Date();
      const scheduledTime = new Date(now.getTime() + 10000); // 10 segundos
      
      console.log('👁️ Creating visible notification for:', scheduledTime);
      
      // Usar configuración optimizada
      const notification = this.createAndroidOptimizedNotification({
        id: testId,
        title: '👁️ PRUEBA VISIBLE',
        body: `Esta notificación DEBE mostrarse a las ${scheduledTime.toLocaleTimeString()}`,
        scheduledAt: scheduledTime,
        extra: { test: true, visible: true }
      });
      
      console.log('👁️ Visible notification config:', JSON.stringify(notification));
      
      await LocalNotifications.schedule({
        notifications: [notification]
      });
      
      console.log('👁️ Visible notification scheduled successfully');
      
      // Verificar que se programó
      setTimeout(async () => {
        const pending = await LocalNotifications.getPending();
        const isScheduled = pending.notifications?.some(n => n.id === testId);
        console.log('👁️ Visible notification is pending:', isScheduled);
        
        if (isScheduled) {
          console.log('✅ Visible notification test: SCHEDULED correctly');
          console.log('⏰ Should appear in 10 seconds - watch for it!');
        } else {
          console.error('❌ Visible notification test: NOT scheduled');
        }
      }, 1000);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error in visible notification test:', error);
      return false;
    }
  }
}

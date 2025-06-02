// database.service.ts
import { Injectable } from '@angular/core';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Measure } from '../interfaces/measure.interface';
import { ReminderConfig } from '../interfaces/reminderConfig.interface';
import { Reminder } from '../interfaces/reminder';

@Injectable({
  providedIn: 'root'
})
export class DatabaseService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private isDbReady: boolean = false;
  private readonly DB_NAME = 'reminders';
  private platform: string = '';
  private fallbackMode: boolean = false;
  private fallbackData: any[] = []; // Para almacenar datos en modo fallback

  constructor() {
    // La inicialización se hace desde main.ts
  }

  async initializeDatabase(): Promise<void> {
    try {
      // Obtener información de la plataforma
      const info = await Device.getInfo();
      this.platform = info.platform;

      console.log('🔍 Plataforma detectada:', this.platform);
      console.log('🔍 Capacitor platform:', Capacitor.getPlatform());

      if (this.platform === 'android' || this.platform === 'ios') {
        // Para plataformas móviles nativas
        console.log('📱 Inicializando SQLite para móvil...');
        await this.initializeMobileDatabase();
      } else {
        // Para web y otras plataformas
        console.log('🌐 Inicializando SQLite para web...');
        await this.initializeWebDatabase();  
      }
    } catch (error) {
      console.error('❌ Error inicializando la base de datos:', error);
      // En caso de error, activar modo fallback
      await this.activateFallbackMode();
    }
  }

  private async initializeMobileDatabase(): Promise<void> {
    try {
      // Verificar si el plugin está disponible
      if (!CapacitorSQLite) {
        throw new Error('Plugin CapacitorSQLite no disponible');
      }

      await this.openDatabase();
      console.log('✅ Base de datos móvil inicializada correctamente');
    } catch (error) {
      console.error('❌ Error en base de datos móvil:', error);
      throw error;
    }
  }

  private async initializeWebDatabase(): Promise<void> {
    try {
      if (Capacitor.getPlatform() === 'web') {
        console.log('🔧 Configurando SQLite para web...');
        
        // Buscar el elemento jeep-sqlite
        const jeepEl = await this.waitForJeepSQLiteElement();
        
        if (!jeepEl) {
          throw new Error('Elemento jeep-sqlite no encontrado');
        }

        // Verificar e inicializar webStore
        await this.initializeWebStore(jeepEl);
      }

      await this.openDatabase();
      console.log('✅ Base de datos web inicializada correctamente');
    } catch (error) {
      console.error('❌ Error en base de datos web:', error);
      throw error;
    }
  }

  private async waitForJeepSQLiteElement(maxAttempts: number = 5): Promise<any> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const jeepEl = document.querySelector('jeep-sqlite') as any;
      
      if (jeepEl && typeof jeepEl.initWebStore === 'function') {
        console.log('✅ Elemento jeep-sqlite encontrado y listo');
        return jeepEl;
      }
      
      console.log(`🔄 Esperando elemento jeep-sqlite... (${attempts + 1}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error(`Elemento jeep-sqlite no encontrado después de ${maxAttempts * 100}ms`);
  }

  private async initializeWebStore(jeepEl: any): Promise<void> {
    try {
      console.log('🔧 Inicializando WebStore...');
      
      if (typeof jeepEl.initWebStore !== 'function') {
        throw new Error('El método initWebStore no está disponible');
      }
      
      await jeepEl.initWebStore();
      console.log('✅ WebStore inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando WebStore:', error);
      
      // Intentar una segunda vez después de una pausa
      console.log('🔄 Reintentando inicialización de WebStore...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      try {
        await jeepEl.initWebStore();
        console.log('✅ WebStore inicializado en el segundo intento');
      } catch (retryError) {
        console.error('❌ Error en segundo intento de WebStore:', retryError);
        throw retryError;
      }
    }
  }

  private async activateFallbackMode(): Promise<void> {
    console.log('🆘 Activando modo fallback...');
    this.fallbackMode = true;
    this.isDbReady = true;
    
    // Cargar datos desde localStorage si existen
    try {
      const savedData = localStorage.getItem('fallback_reminders');
      if (savedData) {
        this.fallbackData = JSON.parse(savedData);
        console.log('📦 Datos cargados desde localStorage:', this.fallbackData.length);
      }
    } catch (error) {
      console.warn('⚠️ Error cargando datos de localStorage:', error);
      this.fallbackData = [];
    }
    
    console.log('✅ Modo fallback activado - los datos se almacenarán en localStorage');
  }

  private saveFallbackData(): void {
    if (this.fallbackMode) {
      try {
        localStorage.setItem('fallback_reminders', JSON.stringify(this.fallbackData));
        console.log('💾 Datos guardados en localStorage');
      } catch (error) {
        console.error('❌ Error guardando en localStorage:', error);
      }
    }
  }

  private async openDatabase(): Promise<void> {
    try {
      // Verificar consistencia de conexiones
      const retCC = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(this.DB_NAME, false)).result;

      if (retCC.result && isConn) {
        // Recuperar conexión existente
        this.db = await this.sqlite.retrieveConnection(this.DB_NAME, false);
      } else {
        // Crear nueva conexión
        this.db = await this.sqlite.createConnection(
          this.DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      // Abrir la base de datos
      await this.db.open();

      // Crear tablas
      await this.createTables();

      // Marcar como lista
      this.isDbReady = true;
      console.log('✅ Base de datos abierta y configurada correctamente');

    } catch (error) {
      console.error('❌ Error abriendo la base de datos:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) return;

    const createRemindersTable = `
      CREATE TABLE IF NOT EXISTS remindersList (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        measure TEXT NOT NULL,
        reminderBy TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        isActive INTEGER NOT NULL,
        reminderConfig TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;

    try {
      await this.db.execute(createRemindersTable);
      console.log('✅ Tablas creadas exitosamente');
    } catch (error) {
      console.error('❌ Error creando tablas:', error);
      throw error;
    }
  }

  // Verificar si la base de datos está lista
  async waitForDatabase(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50; // 5 segundos máximo

    while (!this.isDbReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (!this.isDbReady) {
      throw new Error('Timeout esperando la base de datos');
    }
  }

  // Verificar estado de la base de datos
  isDatabaseReady(): boolean {
    return this.isDbReady;
  }

  // Obtener información de la plataforma
  getPlatformInfo(): { platform: string, isReady: boolean, fallbackMode: boolean } {
    return {
      platform: this.platform,
      isReady: this.isDbReady,
      fallbackMode: this.fallbackMode
    };
  }

  // ==================== OPERACIONES DE BASE DE DATOS ====================

  // Agregar recordatorio
  async addReminder(reminder: Reminder): Promise<any> {
    if (this.fallbackMode) {
      const newReminder = {
        ...reminder,
        id: Date.now(), // ID simple para fallback
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.fallbackData.push(newReminder);
      this.saveFallbackData();
      return { changes: { lastId: newReminder.id } };
    }

    return this.db?.run(`
      INSERT INTO remindersList 
        (name, description, date, time, measure, reminderBy, quantity, isActive, reminderConfig)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [reminder.name, reminder.description, reminder.date, reminder.time, reminder.measure, reminder.reminderBy, reminder.quantity, reminder.isActive, reminder.reminderConfig]);
  }

  // Obtener recordatorios activos
  async getReminders(): Promise<any> {
    if (this.fallbackMode) {
      const activeReminders = this.fallbackData.filter(r => r.isActive === 1);
      return {values: activeReminders} ;
    }

    return this.db?.query('SELECT * FROM remindersList WHERE isActive = 1');
  }

  // Eliminar recordatorio (soft delete)
  async deleteReminder(id: number): Promise<any> {
    if (this.fallbackMode) {
      const reminder = this.fallbackData.find(r => r.id === id);
      if (reminder) {
        reminder.isActive = 0;
        reminder.updatedAt = new Date().toISOString();
        this.saveFallbackData();
      }
      return { changes: { changes: 1 } };
    }

    return this.db?.run('UPDATE remindersList SET isActive = 0 WHERE id = ?', [id]);
  }

  // Actualizar recordatorio
  async updateReminder(reminder: Reminder): Promise<any> {
    if (this.fallbackMode) {
      const index = this.fallbackData.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        this.fallbackData[index] = {
          ...reminder,
          updatedAt: new Date().toISOString()
        };
        this.saveFallbackData();
      }
      return { changes: { changes: 1 } };
    }

    return this.db?.run(`
      UPDATE remindersList SET 
      name = ?, description = ?, date = ?, time = ?, measure = ?, reminderBy = ?, quantity = ?, isActive = ?, reminderConfig = ? 
      WHERE id = ?`, 
      [reminder.name, reminder.description, reminder.date, reminder.time, reminder.measure, reminder.reminderBy, reminder.quantity, reminder.isActive, reminder.reminderConfig, reminder.id]);
  }

  // ==================== UTILIDADES ====================

  // Cerrar conexión de base de datos
  async closeConnectionDb(): Promise<void> {
    if (this.db && !this.fallbackMode) {
      try {
        await this.db.close();
        this.db = null;
        this.isDbReady = false;
        console.log('✅ Base de datos cerrada correctamente');
      } catch (error) {
        console.error('❌ Error cerrando base de datos:', error);
      }
    }
  }

  // Reinicializar base de datos
  async reinicializarBaseDatos(): Promise<void> {
    console.log('🔄 Reinicializando base de datos...');
    this.isDbReady = false;
    this.fallbackMode = false;
    await this.closeConnectionDb();
    await this.initializeDatabase();
  }
}
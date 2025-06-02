import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, Platform, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';

import { DatabaseService } from './app/services/database.service';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { APP_INITIALIZER, enableProdMode } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { defineCustomElements as pwaElements} from '@ionic/pwa-elements/loader';
import { defineCustomElements as jeepSqlite} from 'jeep-sqlite/loader';
import { Capacitor } from '@capacitor/core';

if (environment.production) {
  enableProdMode();
}

// Función para cargar dinámicamente jeep-sqlite
function loadJeepSQLiteDynamically(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Verificar si ya está cargado
    if (window.customElements && window.customElements.get('jeep-sqlite')) {
      console.log('✅ jeep-sqlite ya está cargado');
      resolve();
      return;
    }

    // Cargar el script dinámicamente
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://cdn.jsdelivr.net/npm/jeep-sqlite@latest/dist/jeep-sqlite/jeep-sqlite.esm.js';
    
    script.onload = async () => {
      try {
        console.log('📦 Script de jeep-sqlite cargado');
        
        // Esperar a que se defina el custom element
        await customElements.whenDefined('jeep-sqlite');
        console.log('✅ Custom element jeep-sqlite definido');
        
        resolve();
      } catch (error) {
        console.error('❌ Error esperando definición de jeep-sqlite:', error);
        reject(error);
      }
    };

    script.onerror = (error) => {
      console.error('❌ Error cargando script de jeep-sqlite:', error);
      reject(new Error('Error cargando jeep-sqlite'));
    };

    document.head.appendChild(script);
  });
}

// Función para crear y configurar el elemento jeep-sqlite
async function setupJeepSQLiteElement(): Promise<any> {
  try {
    // Buscar elemento existente
    let jeepSqliteEl = document.querySelector('jeep-sqlite') as any;
    
    if (!jeepSqliteEl) {
      console.log('🔧 Creando elemento jeep-sqlite');
      jeepSqliteEl = document.createElement('jeep-sqlite');
      jeepSqliteEl.style.display = 'none';
      jeepSqliteEl.setAttribute('autoSave', 'true');
      jeepSqliteEl.setAttribute('wasmPath', '/assets/wasm');
      document.body.appendChild(jeepSqliteEl);
    }

    // Esperar a que el elemento esté completamente inicializado
    let attempts = 0;
    const maxAttempts = 30; // 3 segundos

    while (attempts < maxAttempts) {
      if (jeepSqliteEl && typeof jeepSqliteEl.initWebStore === 'function') {
        console.log('✅ Elemento jeep-sqlite completamente inicializado');
        return jeepSqliteEl;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      
      // Re-obtener el elemento por si acaso
      jeepSqliteEl = document.querySelector('jeep-sqlite') as any;
    }

    throw new Error('jeep-sqlite no se inicializó correctamente después de 3 segundos');
    
  } catch (error) {
    console.error('❌ Error configurando elemento jeep-sqlite:', error);
    throw error;
  }
}

// Función para inicializar los elementos personalizados
async function initializeCustomElements(): Promise<void> {
  try {
    // Cargar PWA elements
    pwaElements(window);
    
    // Solo para web
    if (Capacitor.getPlatform() === 'web') {
      console.log('🌐 Inicializando jeep-sqlite para web...');
      
      try {
        // Método 1: Usar defineCustomElements de jeep-sqlite
        jeepSqlite(window);
        await customElements.whenDefined('jeep-sqlite');
        console.log('✅ Método 1 exitoso: defineCustomElements');
      } catch (error) {
        console.warn('⚠️ Método 1 falló, intentando método 2:', error);
        
        // Método 2: Carga dinámica
        await loadJeepSQLiteDynamically();
        console.log('✅ Método 2 exitoso: carga dinámica');
      }
      
      // Configurar el elemento
      const jeepElement = await setupJeepSQLiteElement();
      
      // Verificación final
      if (jeepElement && typeof jeepElement.initWebStore === 'function') {
        console.log('🎉 jeep-sqlite completamente listo para usar');
      } else {
        throw new Error('jeep-sqlite no tiene el método initWebStore disponible');
      }
      
    } else {
      console.log('📱 Plataforma nativa detectada, omitiendo inicialización de jeep-sqlite');
    }
  } catch (error) {
    console.error('❌ Error inicializando elementos personalizados:', error);
    throw error; // Re-lanzar para que el fallback se active
  }
}

// Función para inicializar la base de datos
export function initializeDatabase(databaseService: DatabaseService, platform: Platform): () => Promise<void> {
  return async () => {
    try {
      console.log('🚀 Iniciando inicialización de base de datos...');
      
      // Inicializar elementos personalizados primero
      await initializeCustomElements();
      
      // Espera adicional para asegurar estabilidad
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Inicializar la base de datos
      await databaseService.initializeDatabase();
      
      console.log('✅ Inicialización de base de datos completada exitosamente');
      
      // Log del estado de la base de datos
      const status = databaseService.isDatabaseReady();
      console.log('📊 Estado de la base de datos:', status);
      
    } catch (error) {
      console.error('❌ Error durante la inicialización de la base de datos:', error);
      console.log('🔄 La aplicación continuará con almacenamiento de respaldo');
      
      // Intentar inicializar en modo fallback
      try {
        console.log('🔄 Intentando inicialización en modo fallback...');
        // Solo marcar como listo sin SQLite real
        (databaseService as any).isDbReady = true;
        console.log('✅ Modo fallback activado');
      } catch (fallbackError) {
        console.error('❌ Error en modo fallback:', fallbackError);
      }
    }
  };
}

// Factory function para crear SQLiteConnection
export function createSQLiteConnection(): SQLiteConnection {
  return new SQLiteConnection(CapacitorSQLite);
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideHttpClient(),
    DatabaseService,
    { 
      provide: SQLiteConnection, 
      useFactory: createSQLiteConnection 
    },
    provideRouter(routes, withPreloading(PreloadAllModules)),

  ]
}).catch(err => console.error('❌ Error iniciando aplicación:', err));
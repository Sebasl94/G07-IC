import { Component, OnInit } from "@angular/core";
import { RouterModule } from "@angular/router";
import { LucideAngularModule, PlusIcon } from "lucide-angular";
import { measures } from "../const/measures";
import {
  IonCard,
  IonCardContent,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonToolbar,
  IonCardHeader,
} from "@ionic/angular/standalone";
import { dictOfTimes } from "../const/dictOfTimes";
import { dictOfDays } from "../const/dictOfDays";
import { DatabaseService } from "../services/database.service";
import { Reminder } from "../interfaces/reminder";

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
  ],
})
export class HomePage implements OnInit {
  PlusIcon = PlusIcon;
  measures = measures;
  dictOfTimes = dictOfTimes;
  dictOfDays = dictOfDays;
  myReminders: any[] = [];
  isLoading = true;

  constructor(readonly databaseService: DatabaseService) {
    // La inicialización ya se hace en main.ts
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
}
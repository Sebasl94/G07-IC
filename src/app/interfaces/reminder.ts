import { Measure } from "./measure.interface";
import { ReminderConfig } from "./reminderConfig.interface";

export interface Reminder {
  id?: number;
  name: string;
  description: string;
  date: string;
  time: string;
  measure: string | Measure;
  reminderBy: string;
  quantity: number;
  isActive: number;
  reminderConfig: string | ReminderConfig;
}

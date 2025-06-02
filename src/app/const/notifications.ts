import { LocalNotificationSchema } from "@capacitor/local-notifications";

export const notifications: LocalNotificationSchema[] = [
  {
    id: Date.now() + 1,
    channelId: "default",
    title: "Recordatorio",
    body: "¡Este es un recordatorio que llegará en 1 minuto!",
    schedule: {
      at: new Date(new Date().getTime() + 1 * 60 * 1000), // 1 minuto después
    },
  },
  {
    id: Date.now() + 2,
    channelId: "default",
    title: "Recordatorio",
    body: "¡Este es un recordatorio que llegará en 2 minutos!",
    schedule: {
      at: new Date(new Date().getTime() + 2 * 60 * 1000), // 2 minutos después
    },
  },
  {
    id: Date.now() + 3,
    channelId: "default",
    title: "Recordatorio",
    body: "¡Este es un recordatorio que llegará en 3 minutos!",
    schedule: {
      at: new Date(new Date().getTime() + 3 * 60 * 1000), // 3 minutos después
    },
  },
];



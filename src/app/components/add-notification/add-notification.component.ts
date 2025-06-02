import { ChangeDetectorRef, Component, inject, OnInit } from "@angular/core";
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  IonCardContent,
  IonCardHeader,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonDatetime,
  IonItem,
  IonLabel,
  IonInput,
  IonSelectOption,
  IonSelect,
  IonRadio,
  IonRadioGroup,
  IonButton,
  IonToast,
  IonSpinner,
} from "@ionic/angular/standalone";
import { measures } from "../../const/measures";
import { daysOfWeek, dictOfDays } from "../../const/dictOfDays";
import { dictOfTimes } from "../../const/dictOfTimes";
import { DatabaseService } from "../../services/database.service";
import { Reminder } from "../../interfaces/reminder";
import { Router } from "@angular/router";

@Component({
  selector: "app-add-notification",
  templateUrl: "./add-notification.component.html",
  styleUrls: ["./add-notification.component.scss"],
  standalone: true,
  imports: [
    IonCardContent,
    IonCardHeader,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonDatetime,
    IonItem,
    IonLabel,
    IonInput,
    ReactiveFormsModule,
    FormsModule,
    IonSelectOption,
    IonSelect,
    IonRadio,
    IonRadioGroup,
    IonButton,
    IonToast,
    IonSpinner,
  ],
})
export class AddNotificationComponent implements OnInit {
  measures = measures;
  reminders = [
    {
      name: "Hora",
      value: "hour",
    },
    {
      name: "Día",
      value: "day",
    },
    {
      name: "Semana",
      value: "week",
    },
    {
      name: "Mes",
      value: "month",
    },
  ];
  dictOfTimes = dictOfTimes;
  dictOfDays = dictOfDays;
  daysOfWeek = daysOfWeek;
  showDay: boolean = false;
  showDayOfWeek: boolean = false;
  fb = inject(FormBuilder);
  presentation = "date";

  // Estados de la UI
  isSubmitting = false;
  showToast = false;
  toastMessage = "";
  toastColor = "success";

  router = inject(Router);

  constructor(
    readonly cdr: ChangeDetectorRef,
    readonly databaseService: DatabaseService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.databaseService.initializeDatabase();
    await this.databaseService.waitForDatabase();
    this.hideBackgroundDatePicker();

    // Esperar a que la base de datos esté lista
    if (!this.databaseService.isDatabaseReady()) {
      console.log("⏳ Waiting for database to be ready...");
      const checkDb = setInterval(() => {
        if (this.databaseService.isDatabaseReady()) {
          clearInterval(checkDb);
          console.log("✅ Database is now ready");
          this.logDatabaseStatus();
        }
      }, 100);
    } else {
      this.logDatabaseStatus();
    }
  }

  private logDatabaseStatus(): void {
    const status = this.databaseService.isDatabaseReady();
    console.log("📊 Database status in component:", status);
  }

  addNotificationForm = this.fb.group({
    name: this.fb.control("", [Validators.required]),
    description: this.fb.control(""),
    date: this.fb.control(new Date()),
    dayOfWeek: this.fb.control(""),
    measure: this.fb.control(this.measures[0]),
    reminderBy: this.fb.control("day"),
    quantity: this.fb.control(1),
  });

  changeReminderBy() {
    const reminderBy = this.addNotificationForm.get("reminderBy")?.value;
    console.log("Reminder by changed to:", reminderBy);

    if (reminderBy === "hour" || reminderBy === "week") {
      this.presentation = "time";
    } else {
      this.presentation = "date-time";
    }

    if (reminderBy === "week") {
      this.showDayOfWeek = true;
    } else {
      this.showDayOfWeek = false;
    }
  }

  changeDate(event: any) {
    console.log("Date changed:", event);
    const date = event.detail.value;
    const dateObject = new Date(date);
    const day = dateObject.getDate();
    const month = dateObject.getMonth();
    const year = dateObject.getFullYear();
    console.log("Date components:", { day, month, year });
  }

  async onSubmit() {
    if (!this.isValidForm()) {
      this.showToastMessage(
        "Por favor completa todos los campos requeridos",
        "warning"
      );
      return;
    }

    if (!this.databaseService.isDatabaseReady()) {
      this.showToastMessage(
        "La base de datos no está lista. Intenta nuevamente.",
        "danger"
      );
      return;
    }

    this.isSubmitting = true;

    try {
      const formDateValue = this.addNotificationForm.get("date")?.value;
      let date = new Date(formDateValue ?? new Date());

      let newNotification = {
        name: this.addNotificationForm.get("name")?.value ?? "",
        description: this.addNotificationForm.get("description")?.value ?? "",
        date: date.toISOString(), // Convertir a string ISO
        time: this.addNotificationForm.get("time")?.value ?? "",
        measure: JSON.stringify(
          this.addNotificationForm.get("measure")?.value ?? ""
        ),
        reminderBy: this.addNotificationForm.get("reminderBy")?.value ?? "",
        quantity: this.addNotificationForm.get("quantity")?.value ?? 1,
        isActive: 1, // Asegurar que esté activo
        reminderConfig: JSON.stringify({
          day: date.getDate(),
          hour: date.getHours(),
          minute: date.getMinutes(),
          dayOfWeek: this.addNotificationForm.get("dayOfWeek")?.value,
        }),
      };

      console.log(
        "📝 Submitting notification:",
        JSON.stringify(newNotification)
      );

      const result = await this.databaseService.addReminder(
        newNotification as Reminder
      );
      console.log("✅ Reminder added successfully:", result);

      this.showToastMessage("¡Recordatorio agregado exitosamente!", "success");

      // Limpiar formulario
      this.addNotificationForm.reset({
        name: "",
        description: "",
        date: new Date(),
        dayOfWeek: "",
        measure: this.measures[0],
        reminderBy: "day",
        quantity: 1,
      });

      // Navegar después de mostrar el toast
      setTimeout(() => {
        this.router.navigate(["/home"]);
      }, 1500);
    } catch (error) {
      console.error("❌ Error adding reminder:", error);
      this.showToastMessage("Error al agregar el recordatorio", "danger");
    } finally {
      this.isSubmitting = false;
    }
  }

  private showToastMessage(message: string, color: string) {
    this.toastMessage = message;
    this.toastColor = color;
    this.showToast = true;
  }

  hideBackgroundDatePicker() {
    // Ejecutar esto después de que el ion-datetime esté presente en el DOM
    setTimeout(() => {
      const ionDatetime = document.querySelector("ion-datetime");
      const shadowRoot = ionDatetime?.shadowRoot;
      const picker = shadowRoot?.querySelector("ion-picker")?.shadowRoot;
      const pickerBefore = picker?.querySelector(
        ".picker-before"
      ) as HTMLElement;
      const pickerHighlight = picker?.querySelector(
        ".picker-highlight"
      ) as HTMLElement;
      const pickerAfter = picker?.querySelector(".picker-after") as HTMLElement;
      const columnOption = document.querySelector(
        "ion-picker-column-option"
      ) as HTMLElement;
      console.log(columnOption);
      if (pickerBefore) {
        pickerBefore.style.background = "none";
      }
      if (pickerAfter) {
        pickerAfter.style.background = "none";
      }
      if (pickerHighlight) {
        pickerHighlight.style.background = "#8b5cf6";
      }
      if (columnOption) {
        console.log(columnOption);
        columnOption.style.color = "white";
      }
    }, 200);
  }

  isValidForm() {
    const form = this.addNotificationForm;
    if (form.valid) {
      return true;
    }
    return false;
  }
}

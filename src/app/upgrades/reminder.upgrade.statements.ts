export class ReminderUpgradeStatements {
  reminderUpgrades = [
    {
      fromVersion: 0,
      toVersion: 1,
      upgrade: () => {},
      statements: [
        `
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
      `,
      ],
    },
  ];
}

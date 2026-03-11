export const BACKUP_FILE_FILTER = {
  name: "MailDraft Backup",
  extensions: ["json"],
};

export function createBackupDefaultFileName(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `maildraft-backup-${year}${month}${day}-${hours}${minutes}.json`;
}

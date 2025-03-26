import ColdOutreach, { EmailStatus } from "./models/coldOutreach";
import { DB_LOCATION, getUserInput } from "./shared";

import Db from "./services/db";
import moment from "moment";

async function checkAndUpdateStatus() {
  console.log("\n=== Check and Update Reply Status ===\n");

  const emails = await ColdOutreach.findAll({
    status: EmailStatus.INITIAL,
    sortBy: "initialSentDate",
    sortDir: "desc",
    limit: 2000000,
  });

  console.log(`Found ${emails.length} emails waiting for responses`);

  for (const email of emails) {
    const daysSince = moment().diff(moment(email.initialSentDate), "days");

    console.log(
      `\n${email.recipientName} (${email.recipientEmail}) - Sent ${daysSince} days ago`
    );
    console.log(`Subject: ${email.emailSubject}`);

    const replied = await getUserInput("Did they reply? (y/n/s to skip): ");

    if (replied === "y" || replied === "yes") {
      const notes = await getUserInput("Add notes about their response: ");
      await ColdOutreach.updateEmailStatus(
        email.initialEmailId,
        EmailStatus.RESPONDED,
        notes
      );
      console.log("Status updated to RESPONDED");
    } else if (replied === "n" || replied === "no") {
      // If they specifically say no, we could mark it for follow-up
      await ColdOutreach.updateEmailStatus(
        email.initialEmailId,
        EmailStatus.INITIAL,
        "Confirmed no response yet"
      );
      console.log("Confirmed no response received yet");
    }
    // Skip otherwise
  }
}

async function updateStatusByEmail() {
  console.log("\n=== Update Email Status by Email Address ===\n");

  const recipientEmail = await getUserInput("Enter recipient email address: ");

  const emails = await ColdOutreach.findByRecipientEmail(recipientEmail);

  if (emails.length === 0) {
    console.log(`No emails found for ${recipientEmail}`);
    return;
  }

  console.log(`Found ${emails.length} emails for ${recipientEmail}:`);

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const daysSince = moment().diff(moment(email.initialSentDate), "days");

    console.log(
      `\n[${i + 1}] ${email.recipientName} - Sent ${daysSince} days ago`
    );
    console.log(`Subject: ${email.emailSubject}`);
    console.log(`Current status: ${email.status}`);
  }

  const emailIndex =
    parseInt(
      await getUserInput("Select email to update (number) or 0 to cancel: ")
    ) - 1;

  if (emailIndex < 0 || emailIndex >= emails.length) {
    console.log("Operation cancelled or invalid selection");
    return;
  }

  const selectedEmail = emails[emailIndex];

  console.log("\nAvailable statuses:");
  Object.values(EmailStatus).forEach((status, index) => {
    console.log(`${index + 1}. ${status}`);
  });

  const statusIndex =
    parseInt(await getUserInput("Select new status (number): ")) - 1;

  if (statusIndex < 0 || statusIndex >= Object.values(EmailStatus).length) {
    console.log("Invalid status selection");
    return;
  }

  const newStatus = Object.values(EmailStatus)[statusIndex];
  const notes = await getUserInput("Add notes (optional): ");

  await ColdOutreach.updateEmailStatus(
    selectedEmail.initialEmailId,
    newStatus,
    notes
  );

  console.log(`Status updated to ${newStatus}`);
}

(async () => {
  const db = new Db(DB_LOCATION);
  await db.connect();

  const action = await getUserInput(
    "Choose action (1: Check and update status, 2: Update by email): "
  );

  if (action === "1") {
    await checkAndUpdateStatus();
  } else if (action === "2") {
    await updateStatusByEmail();
  } else {
    console.log("Invalid action selected");
  }

  process.exit(0);
})();

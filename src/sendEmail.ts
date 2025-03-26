import { DB_LOCATION, getUserInput } from "./shared";

import ColdOutreach from "./models/coldOutreach";
import Db from "./services/db";
import { RequestyAiModelEnum } from "./services/GenAiServiceClient";

const PEOPLE: { email: string; name: string }[] = [];

async function sendAutomaticEmails() {
  if (!process.env.SENDGRID_EMAIL) {
    throw new Error(
      "SENDGRID_EMAIL is not set. Please set it in the .env file."
    );
  }
  let fromName = process.env.FROM_NAME;
  if (!fromName) {
    throw new Error("FROM_NAME is not set. Please set it in the .env file.");
  }

  console.log("Checking for previously sent emails in database...");
  const sentEmails = new Set();

  // Find all emails already in the system
  const existingEmails = await ColdOutreach.findAll();
  for (const email of existingEmails) {
    sentEmails.add(email.recipientEmail.toLowerCase());
  }

  console.log(`Loaded ${sentEmails.size} previously sent emails from database`);

  for (const person of PEOPLE) {
    try {
      // Check if we've already sent to this person
      if (sentEmails.has(person.email.toLowerCase())) {
        console.log(
          `Skipping ${person.name} (${person.email}) - email already sent previously`
        );
        continue;
      }

      // Generate email content
      console.log(`\nGenerating email for ${person.name}...`);
      const generatedEmail = await ColdOutreach.generateInitialEmail(
        person.name,
        RequestyAiModelEnum.sonarReasoningPro
      );

      // Send the email automatically
      const recipient =
        DB_LOCATION === "local" ? process.env.TEST_EMAIL : person.email;
      if (!recipient) {
        throw new Error(
          "TEST_EMAIL is not set. Please set it in the .env file."
        );
      }

      await ColdOutreach.sendAndTrackEmail({
        to: recipient,
        name: person.name,
        subject:
          DB_LOCATION === "local"
            ? `[TEST] ${generatedEmail.subject}`
            : generatedEmail.subject,
        content: generatedEmail.content,
        fromEmail: process.env.SENDGRID_EMAIL,
        fromName: fromName,
        model: generatedEmail.model,
        bcc: process.env.SENDGRID_EMAIL,
      });

      console.log(
        DB_LOCATION === "local"
          ? `TEST MODE: Email for ${person.name} sent to ${recipient}`
          : `Email sent to ${person.name} at ${person.email}`
      );
    } catch (error) {
      console.error(`Error processing email for ${person.name}:`, error);
      console.log("Continuing with next recipient...");
    }
  }

  console.log("\nAutomatic email process completed!");
}

async function sendInteractiveEmails() {
  if (!process.env.SENDGRID_EMAIL) {
    throw new Error(
      "SENDGRID_EMAIL is not set. Please set it in the .env file."
    );
  }
  let fromName = process.env.FROM_NAME;
  if (!fromName) {
    throw new Error("FROM_NAME is not set. Please set it in the .env file.");
  }
  console.log("Checking for previously sent emails in database...");
  const sentEmails = new Set();

  // Find all emails already in the system
  const existingEmails = await ColdOutreach.findAll();

  for (const email of existingEmails) {
    sentEmails.add(email.recipientEmail.toLowerCase());
  }

  console.log(`Loaded ${sentEmails.size} previously sent emails from database`);

  for (const person of PEOPLE) {
    // Check if we've already sent to this person
    if (sentEmails.has(person.email.toLowerCase())) {
      console.log(
        `Skipping ${person.name} (${person.email}) - email already sent previously`
      );
      continue;
    }

    // Generate email content using the new ColdOutreach method
    console.log(`Generating email for ${person.name}...`);
    const generatedEmail = await ColdOutreach.generateInitialEmail(
      person.name,
      RequestyAiModelEnum.sonarReasoningPro
    );

    console.log(`\n----- Email for ${person.name} -----`);
    console.log(`Subject: ${generatedEmail.subject}\n`);
    console.log(generatedEmail.content);
    for (const citation of generatedEmail.citations) {
      console.log(`Citation: ${citation}`);
    }

    let continueLoop = true;
    while (continueLoop) {
      const answer = await getUserInput(
        "\nSend this email? (y/yes, n/no, t/test, u/update, s/skip, cs/change subject): "
      );
      const emailSubject =
        DB_LOCATION === "local"
          ? `[TEST] ${generatedEmail.subject}`
          : generatedEmail.subject;
      if (answer === "y" || answer === "yes") {
        // Determine recipient based on DB_LOCATION
        const recipient =
          DB_LOCATION === "local" ? process.env.TEST_EMAIL : person.email;
        if (!recipient) {
          throw new Error(
            "TEST_EMAIL is not set. Please set it in the .env file."
          );
        }

        // Send and track the email using the new ColdOutreach method
        await ColdOutreach.sendAndTrackEmail({
          to: recipient,
          name: person.name,
          subject: emailSubject,
          content: generatedEmail.content,
          fromEmail: process.env.SENDGRID_EMAIL,
          fromName: fromName,
          model: generatedEmail.model,
          bcc: process.env.SENDGRID_EMAIL,
        });

        console.log(
          DB_LOCATION === "local"
            ? `TEST MODE: Email for ${person.name} sent to ${recipient}`
            : `Email sent to ${person.name} at ${person.email}`
        );

        continueLoop = false;
      } else if (answer === "t" || answer === "test") {
        // Send a test email to yourself using ColdOutreach
        const testEmail = process.env.TEST_EMAIL;
        if (!testEmail) {
          throw new Error(
            "TEST_EMAIL is not set. Please set it in the .env file."
          );
        }
        await ColdOutreach.sendAndTrackEmail({
          to: testEmail,
          name: person.name,
          subject: `[TEST] ${emailSubject}`,
          content: generatedEmail.content,
          fromEmail: process.env.SENDGRID_EMAIL,
          fromName: "Austin Starks",
          model: generatedEmail.model,
        });

        console.log(`Test email for ${person.name} sent to ${testEmail}`);
        // Continue the loop to ask again after sending a test email
      } else if (answer === "u" || answer === "update") {
        const updateMessage = await getUserInput(
          "What would you like to change? "
        );

        // Use the ColdOutreach.updateEmailContent method
        const updatedContent = await ColdOutreach.updateEmailContent(
          person.name,
          generatedEmail.content,
          updateMessage,
          RequestyAiModelEnum.sonarReasoningPro
        );

        // Update the email content
        generatedEmail.content = updatedContent.content;
        generatedEmail.citations = updatedContent.citations;

        console.log(`\n----- Updated Email for ${person.name} -----`);
        console.log(generatedEmail.content);
      } else if (answer === "s" || answer === "skip") {
        console.log(
          `Skipping email to ${person.name}. Moving to next recipient.`
        );
        continueLoop = false;
      } else if (answer === "n" || answer === "no") {
        console.log("Email sending canceled. Exiting script.");
        process.exit(0);
      } else if (answer === "cs" || answer === "change subject") {
        const newSubject = await getUserInput("Enter new subject: ");
        generatedEmail.subject = newSubject;
        console.log(`Subject updated to: ${generatedEmail.subject}`);
      } else {
        console.log(
          "Invalid input. Please enter y/yes, n/no, t/test, u/update, s/skip, or cs/change subject."
        );
      }
    }
  }
}

async function sendEmails() {
  console.log("\n=== NexusTrade Email Sender ===\n");

  const mode = await getUserInput(
    "Choose mode: (1) Interactive mode, (2) Automatic mode, (3) Exit: "
  );

  switch (mode) {
    case "1":
      await sendInteractiveEmails();
      break;
    case "2":
      await sendAutomaticEmails();
      break;
    default:
      console.log("Exiting script.");
  }
}

(async () => {
  const db = new Db(DB_LOCATION);
  await db.connect();
  await sendEmails();
  process.exit(0);
})();

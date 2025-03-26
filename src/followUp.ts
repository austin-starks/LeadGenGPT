import ColdOutreach, { EmailStatus } from "./models/coldOutreach";
import { DB_LOCATION, getUserInput } from "./shared";
import { ModelEnum, RequestyAiModelEnum } from "./services/GenAiServiceClient";

import Db from "./services/db";
import moment from "moment";

// Add at the top of the file after imports
const CUSTOM_INSTRUCTION = ""; // Add your custom instruction here for all emails

// Extract common functionality into reusable functions
async function displayEmailInfo(email: ColdOutreach): Promise<void> {
  const daysSinceSent = moment().diff(moment(email.initialSentDate), "days");

  console.log(
    "\n------------------------------------------------------------------"
  );
  console.log(
    `Processing follow-up for: ${email.recipientName} (${email.recipientEmail})`
  );
  console.log(
    `Initial email sent: ${moment(email.initialSentDate).format(
      "MMMM D, YYYY"
    )} (${daysSinceSent} days ago)`
  );
  console.log(`Subject: ${email.emailSubject}`);
  console.log(`Status: ${email.status}`);

  // Show follow-up information if available
  if (email.followUpSentDate) {
    const daysSinceFollowUp = moment().diff(
      moment(email.followUpSentDate),
      "days"
    );
    console.log(
      `Follow-up sent: ${moment(email.followUpSentDate).format(
        "MMMM D, YYYY"
      )} (${daysSinceFollowUp} days ago)`
    );
  }

  console.log(
    "------------------------------------------------------------------\n"
  );

  // Show the initial email content
  console.log("Initial Email Content:");
  console.log(
    "------------------------------------------------------------------"
  );
  console.log(email.emailContent);
  console.log(
    "------------------------------------------------------------------\n"
  );

  // Show previous follow-up content if available
  if (email.followUpContent) {
    console.log("Previous Follow-up Content:");
    console.log(
      "------------------------------------------------------------------"
    );
    console.log(email.followUpContent);
    console.log(
      "------------------------------------------------------------------\n"
    );
  }

  // Show notes if available
  if (email.notes) {
    console.log("Notes:");
    console.log(
      "------------------------------------------------------------------"
    );
    console.log(email.notes);
    console.log(
      "------------------------------------------------------------------\n"
    );
  }
}

async function getCustomInstructions(): Promise<string> {
  const customizePrompt = await getUserInput(
    "Add custom instructions for follow-up? (y/n): "
  );
  let customInstructions = "";

  if (customizePrompt === "y" || customizePrompt === "yes") {
    customInstructions = await getUserInput("Enter custom instructions: ");
  }

  return customInstructions;
}

interface FollowUpEmail {
  subject: string;
  content: string;
  citations: string[];
}

async function displayGeneratedEmail(
  followUp: FollowUpEmail,
  recipientName: string
): Promise<void> {
  console.log(
    "\n------------------------------------------------------------------"
  );
  console.log(`Generated Follow-Up Email for ${recipientName}`);
  console.log(`Subject: ${followUp.subject}`);
  console.log(
    "------------------------------------------------------------------"
  );
  console.log(followUp.content);
  console.log(
    "------------------------------------------------------------------\n"
  );
}

interface EmailActionResult {
  continueLoop: boolean;
  quit: boolean;
}

async function handleEmailActions(
  email: ColdOutreach,
  followUp: FollowUpEmail,
  model: ModelEnum
): Promise<EmailActionResult> {
  if (!process.env.SENDGRID_EMAIL) {
    throw new Error(
      "SENDGRID_EMAIL is not set. Please set it in the .env file."
    );
  }
  let continueLoop = true;
  while (continueLoop) {
    const action = await getUserInput(
      "\nAction: (s)end, (t)est send, (u)pdate, (c)hange subject, (r)egenerate, (q)uit, (skip): "
    );
    let toEmail: string = email.recipientEmail;
    let fromName = process.env.FROM_NAME;
    if (!fromName) {
      throw new Error("FROM_NAME is not set. Please set it in the .env file.");
    }

    switch (action) {
      case "s":
      case "send":
        // Send the actual follow-up email
        await ColdOutreach.sendAndTrackEmail({
          to: toEmail,
          name: email.recipientName,
          subject:
            DB_LOCATION === "local"
              ? `[TEST] ${followUp.subject}`
              : followUp.subject,
          content: followUp.content,
          fromEmail: process.env.SENDGRID_EMAIL,
          fromName: fromName,
          model: model,
          isFollowUp: true,
          previousEmailId: email.initialEmailId,
          bcc: process.env.SENDGRID_EMAIL,
        });

        console.log(
          `Follow-up email sent to ${
            DB_LOCATION === "local"
              ? `${toEmail} (TEST MODE)`
              : `${email.recipientName} at ${email.recipientEmail}`
          }`
        );
        continueLoop = false;
        break;

      case "t":
      case "test":
        // Send a test email to yourself
        await ColdOutreach.sendAndTrackEmail({
          to: toEmail,
          name: email.recipientName,
          subject: `[TEST] ${followUp.subject}`,
          content: followUp.content,
          fromEmail: process.env.SENDGRID_EMAIL,
          fromName: fromName,
          model: model,
        });

        console.log(
          `Test follow-up email for ${email.recipientName} sent to ${toEmail}`
        );
        break;

      case "u":
      case "update":
        const editInstructions = await getUserInput(
          "Enter edit instructions: "
        );

        const updatedContent = await ColdOutreach.updateEmailContent(
          email.recipientName,
          followUp.content,
          editInstructions,
          model
        );

        followUp.content = updatedContent.content;
        followUp.citations = updatedContent.citations;
        await displayGeneratedEmail(followUp, email.recipientName);
        break;

      case "c":
      case "change":
      case "change subject":
      case "cs":
        // Change the subject line
        const newSubject = await getUserInput("Enter new subject line: ");
        followUp.subject = newSubject;
        console.log(`Subject updated to: ${followUp.subject}`);
        break;

      case "r":
      case "regenerate":
        const newInstructions = await getUserInput(
          "Enter new instructions for regeneration: "
        );
        const regeneratedFollowUp = await ColdOutreach.generateFollowUpEmail(
          email.initialEmailId,
          model,
          newInstructions
        );

        followUp.content = regeneratedFollowUp.content;
        followUp.subject = regeneratedFollowUp.subject;
        await displayGeneratedEmail(followUp, email.recipientName);
        break;

      case "q":
      case "quit":
        console.log("Exiting follow-up script.");
        return { continueLoop: false, quit: true };

      case "skip":
        // Skip to the next recipient
        console.log(`Skipping follow-up to ${email.recipientName}.`);
        continueLoop = false;
        break;

      default:
        console.log("Invalid input. Please try again.");
        break;
    }
  }
  return { continueLoop: false, quit: false };
}

async function processEmail(
  email: ColdOutreach,
  model: ModelEnum
): Promise<boolean> {
  try {
    await displayEmailInfo(email);

    const customInstructions = await getCustomInstructions();

    console.log(`\nGenerating follow-up email using ${model}...`);

    // Generate the follow-up email
    const followUpResult = await ColdOutreach.generateFollowUpEmail(
      email.initialEmailId,
      model,
      customInstructions
    );

    const followUp: FollowUpEmail = {
      content: followUpResult.content,
      subject: followUpResult.subject,
      citations: followUpResult.citations,
    };

    await displayGeneratedEmail(followUp, email.recipientName);

    const result = await handleEmailActions(email, followUp, model);
    return result.quit;
  } catch (error) {
    console.error(
      `Error processing follow-up for ${email.recipientName}:`,
      error
    );
    console.log("Skipping to next recipient due to error.");
    return false;
  }
}

async function sendFollowUpEmails(): Promise<void> {
  console.log("\n=== Follow-up Email Generator ===\n");

  const emailsToFollowUp = await ColdOutreach.getEmailsNeedingFollowUp({
    minDaysSinceLastUpdate: 7,
    maxDaysSinceLastUpdate: 30,
    limit: 100,
  });

  console.log(`Found ${emailsToFollowUp.length} emails that need follow-up.\n`);

  if (emailsToFollowUp.length === 0) {
    console.log("No emails to follow up on in the specified timeframe.");
    return;
  }

  // Process each email one by one
  for (const email of emailsToFollowUp) {
    // Ask if user wants to send a follow-up for this contact
    const processThis = await getUserInput(
      `Process follow-up for ${email.recipientName} (${email.recipientEmail})? (y/n): `
    );

    if (processThis !== "y" && processThis !== "yes") {
      console.log(
        `Skipping ${email.recipientName} (${email.recipientEmail}).\n`
      );
      continue;
    }

    const model: ModelEnum = RequestyAiModelEnum.sonarReasoningPro;
    const shouldQuit = await processEmail(email, model);
    if (shouldQuit) return;
  }

  console.log("\nFollow-up email process completed!");
}

async function processSpecificFollowUp(): Promise<void> {
  console.log("\n=== Process Specific Follow-Up ===\n");

  // Ask for the email identifier
  const emailIdentifier = await getUserInput(
    "Enter recipient email or initial email ID: "
  );

  let emails: ColdOutreach[] = [];

  if (emailIdentifier.includes("@")) {
    emails = await ColdOutreach.findByRecipientEmail(emailIdentifier);
  } else {
    try {
      const email = await ColdOutreach.findByEmailId(emailIdentifier);
      if (email.status !== EmailStatus.FOLLOW_UP_SENT) {
        emails.push(email);
      }
    } catch (error) {
      console.log("No matching email found with that ID.");
      return;
    }
  }

  if (emails.length === 0) {
    console.log(
      "No matching emails found or all emails have already been followed up."
    );
    return;
  }

  console.log(
    `Found ${emails.length} emails for ${emailIdentifier}. Please select one:`
  );

  emails.forEach((email, index) => {
    console.log(
      `${index + 1}. Sent on ${moment(email.initialSentDate).format(
        "MMMM D, YYYY"
      )} - Subject: ${email.emailSubject}`
    );
  });

  const email = emails[0];
  const model: ModelEnum = RequestyAiModelEnum.gemini2Flash;
  await processEmail(email, model);
}

async function sendAutomaticFollowUpEmails(): Promise<void> {
  console.log("\n=== Automatic Follow-up Email Generator ===\n");
  if (!process.env.SENDGRID_EMAIL) {
    throw new Error(
      "SENDGRID_EMAIL is not set. Please set it in the .env file."
    );
  }
  let fromName = process.env.FROM_NAME;
  if (!fromName) {
    throw new Error("FROM_NAME is not set. Please set it in the .env file.");
  }
  const emailsToFollowUp = await ColdOutreach.getEmailsNeedingFollowUp({
    minDaysSinceLastUpdate: 7,
    maxDaysSinceLastUpdate: 30,
    limit: 100,
  });

  console.log(`Found ${emailsToFollowUp.length} emails that need follow-up.\n`);

  if (emailsToFollowUp.length === 0) {
    console.log("No emails to follow up on in the specified timeframe.");
    return;
  }

  // Process each email automatically
  for (const email of emailsToFollowUp) {
    try {
      console.log(
        `\nProcessing follow-up for ${email.recipientName} (${email.recipientEmail})...`
      );

      const model: ModelEnum = RequestyAiModelEnum.sonarReasoningPro;

      // Generate the follow-up email using custom instruction if available
      const followUpResult = await ColdOutreach.generateFollowUpEmail(
        email.initialEmailId,
        model,
        CUSTOM_INSTRUCTION
      );

      const followUp: FollowUpEmail = {
        content: followUpResult.content,
        subject: followUpResult.subject,
        citations: followUpResult.citations,
      };

      // Display the generated email
      console.log("\n=== Generated Follow-up Email ===");
      console.log(`Subject: ${followUp.subject}`);
      console.log("Content:");
      console.log(followUp.content);
      console.log("===============================\n");

      // Add countdown
      console.log("Sending in:");
      for (let i = 10; i > 0; i--) {
        process.stdout.write(`${i}... `);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      console.log("\n");

      // Send the follow-up email
      await ColdOutreach.sendAndTrackEmail({
        to: email.recipientEmail,
        name: email.recipientName,
        subject: followUp.subject,
        content: followUp.content,
        fromEmail: process.env.SENDGRID_EMAIL,
        fromName: fromName,
        model: model,
        isFollowUp: true,
        previousEmailId: email.initialEmailId,
        bcc: process.env.SENDGRID_EMAIL,
      });

      console.log(
        `Follow-up email sent to ${email.recipientName} at ${email.recipientEmail}`
      );
    } catch (error) {
      console.error(
        `Error processing follow-up for ${email.recipientName}:`,
        error
      );
      console.log("Continuing with next recipient...");
    }
  }

  console.log("\nAutomatic follow-up email process completed!");
}

async function followUp() {
  console.log("\n=== NexusTrade Email Follow-up System ===\n");

  const mode = await getUserInput(
    "Choose mode: (1) Process follow-ups in bulk, (2) Process specific follow-up, (3) Automatic mode, (4) Exit: "
  );

  switch (mode) {
    case "1":
      await sendFollowUpEmails();
      break;
    case "2":
      await processSpecificFollowUp();
      break;
    case "3":
      await sendAutomaticFollowUpEmails();
      break;
    default:
      console.log("Exiting script.");
  }

  process.exit(0);
}

(async () => {
  const db = new Db(DB_LOCATION);
  await db.connect();
  await followUp();
  process.exit(0);
})();

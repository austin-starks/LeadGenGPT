import COLD_OUTREACH_PROMPT, {
  COLD_OUTREACH_PROMPT_PRE_MESSAGE,
} from "../../prompts/coldOutreach";
import FIX_HTML_PROMPT, {
  FIX_HTML_PROMPT_PRE_MESSAGE,
} from "../../prompts/fixHtml";
import HELPFUL_ASSISTANT_PROMPT, {
  HELPFUL_ASSISTANT_PROMPT_PRE_MESSAGE,
} from "../../prompts/helpfulAssistant";
import {
  ModelEnum,
  RequestyAiModelEnum,
} from "../../services/GenAiServiceClient";
import mongoose, { Schema, Types } from "mongoose";

import RequestyServiceClient from "../../services/RequestyServiceClient";
import { SendChatMessageRequest } from "../aiChatLog/shared";
import fs from "fs";
import moment from "moment";
import sgMail from "@sendgrid/mail";
import { v4 as uuidv4 } from "uuid";

// Enum for email status
export enum EmailStatus {
  INITIAL = "initial",
  FOLLOW_UP_SENT = "follow-up-sent",
  RESPONDED = "responded",
  CONVERTED = "converted",
  FAILED_TO_CONVERT = "failed-to-convert",
}

// Interface for cold outreach data
interface IColdOutreachData {
  _id?: Types.ObjectId;
  recipientName: string;
  recipientEmail: string;
  initialSentDate: Date;
  followUpSentDate?: Date;
  followUpContent?: string;
  initialEmailId: string;
  followUpEmailId?: string;
  status: EmailStatus;
  emailContent: string;
  emailSubject: string;
  modelUsed: ModelEnum;
  notes?: string;
  tags?: string[];
}

// Private Mongoose schema definition (not exported)
const coldOutreachSchema = new Schema(
  {
    recipientName: { type: String, required: true },
    recipientEmail: { type: String, required: true, index: true },
    initialSentDate: { type: Date, required: true },
    followUpSentDate: { type: Date },
    followUpContent: { type: String },
    initialEmailId: { type: String, required: true, index: true },
    followUpEmailId: { type: String },
    status: {
      type: String,
      enum: Object.values(EmailStatus),
      default: EmailStatus.INITIAL,
      required: true,
    },
    emailContent: { type: String, required: true },
    emailSubject: { type: String, required: true },
    modelUsed: { type: String, required: true },
    notes: { type: String },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

// Create indexes for efficient querying
coldOutreachSchema.index({ recipientEmail: 1, status: 1 });
coldOutreachSchema.index({ initialSentDate: 1 });
coldOutreachSchema.index({ status: 1, initialSentDate: 1 });

// Private Mongoose model (not exported)
const ColdOutreachModel = mongoose.model<mongoose.Document & IColdOutreachData>(
  "ColdOutreach",
  coldOutreachSchema
);

/**
 * ColdOutreach class that encapsulates both the model and service functionality
 * Following the pattern of AbstractPrompt
 */
class ColdOutreach {
  _id?: Types.ObjectId;
  recipientName: string;
  recipientEmail: string;
  initialSentDate: Date;
  followUpSentDate?: Date;
  followUpContent?: string;
  initialEmailId: string;
  followUpEmailId?: string;
  status: EmailStatus;
  emailContent: string;
  emailSubject: string;
  modelUsed: ModelEnum;
  notes?: string;
  tags?: string[];

  /**
   * Constructor for ColdOutreach
   */
  constructor(data: IColdOutreachData) {
    this.validate(data);
    this._id = data._id;
    this.recipientName = data.recipientName;
    this.recipientEmail = data.recipientEmail;
    this.initialSentDate = data.initialSentDate;
    this.followUpSentDate = data.followUpSentDate;
    this.followUpContent = data.followUpContent;
    this.initialEmailId = data.initialEmailId;
    this.followUpEmailId = data.followUpEmailId;
    this.status = data.status;
    this.emailContent = data.emailContent;
    this.emailSubject = data.emailSubject;
    this.modelUsed = data.modelUsed;
    this.notes = data.notes;
    this.tags = data.tags;
  }

  validate(data: IColdOutreachData): void {
    if (!data) {
      throw new Error("Cold outreach data is required");
    }
    if (!data.recipientName) {
      throw new Error("Recipient name is required");
    }
    if (!data.recipientEmail) {
      throw new Error("Recipient email is required");
    }
    if (!data.initialSentDate) {
      throw new Error("Initial sent date is required");
    }
    if (!data.initialEmailId) {
      throw new Error("Initial email ID is required");
    }
    if (!data.status) {
      throw new Error("Status is required");
    }
    if (!data.emailContent) {
      throw new Error("Email content is required");
    }
    if (!data.emailSubject) {
      throw new Error("Email subject is required");
    }
    if (!data.modelUsed) {
      throw new Error("Model used is required");
    }
  }

  async save(): Promise<void> {
    if (this._id) {
      await ColdOutreachModel.updateOne({ _id: this._id }, this, {
        upsert: true,
      });
      return;
    }
    const model = await ColdOutreachModel.create(this);
    this._id = model.id;
  }

  async delete(): Promise<void> {
    throw new Error("Not implemented");
  }

  static async generateInitialEmail(name: string, model: ModelEnum) {
    let messages = [
      {
        sender: "user",
        content: `${name} finance influencer`,
      },
    ];

    const request: SendChatMessageRequest = {
      systemPrompt: COLD_OUTREACH_PROMPT,
      model: RequestyAiModelEnum.sonarReasoningPro,
      temperature: 0,
      messages,
      preMessage: COLD_OUTREACH_PROMPT_PRE_MESSAGE,
      promptName: "Cold Outreach Initial Email",
    };

    const requestyServiceClient = new RequestyServiceClient();
    const message = await requestyServiceClient.sendRequest(request);

    // Remove HTML comments from the content
    let cleanContent = message.content;
    cleanContent = cleanContent.replace(/<!--[\s\S]*?-->/g, "");
    // Also remove citation markers like [1], [2], etc.
    cleanContent = cleanContent.replace(/\[\d+\]/g, "");

    // Validate and fix content as needed
    const formattedContent = await ColdOutreach.ensureProperBodyTags(
      cleanContent
    );

    // Generate subject
    const subject = await ColdOutreach.generateEmailSubject(
      name,
      formattedContent
    );

    return {
      content: formattedContent,
      subject,
      model,
      citations: message.citations || [],
    };
  }

  /**
   * Generate follow-up email based on previous email
   */
  static async generateFollowUpEmail(
    previousEmailId: string,
    customInstructions?: string
  ) {
    // Find the previous email record
    const emailDoc = await ColdOutreachModel.findOne({
      initialEmailId: previousEmailId,
      status: EmailStatus.INITIAL,
    });

    if (!emailDoc) {
      throw new Error(`No initial email found with ID ${previousEmailId}`);
    }

    const previousEmail = new ColdOutreach(emailDoc);

    // First, use Perplexity to generate the initial content
    let messages = [
      {
        sender: "user",
        content: `${previousEmail.recipientName}`,
      },
    ];

    let request: SendChatMessageRequest = {
      systemPrompt: COLD_OUTREACH_PROMPT,
      model: RequestyAiModelEnum.sonarReasoningPro,
      temperature: 0,
      messages,
      preMessage: COLD_OUTREACH_PROMPT_PRE_MESSAGE,
      promptName: "Cold Outreach Follow-up Email Initial",
    };

    const requestyServiceClient = new RequestyServiceClient();
    const perplexityMessage = await requestyServiceClient.sendRequest(request);

    // Calculate days since initial email
    const daysSinceInitial = moment().diff(
      moment(previousEmail.initialSentDate),
      "days"
    );
    // Now use Gemini to refine the content
    messages = [
      {
        sender: "user",
        content: `Days since initial email: ${daysSinceInitial}\n\nPrevious email: ${
          previousEmail.emailContent
        }\n\nRefine this follow-up email. Keep the same structure but make it more concise and natural. Make sure to referebce the previous email in the content:\n\n${
          perplexityMessage.content
        }${
          customInstructions
            ? `\n\nAdditional instructions: ${customInstructions}`
            : ""
        }`,
      },
    ];

    request = {
      systemPrompt: HELPFUL_ASSISTANT_PROMPT,
      model: RequestyAiModelEnum.gemini2Flash,
      temperature: 0,
      messages,
      preMessage: COLD_OUTREACH_PROMPT_PRE_MESSAGE,
      promptName: "Cold Outreach Follow-up Email Refinement",
    };

    const finalMessage = await requestyServiceClient.sendRequest(request);

    // Format the content properly
    const formattedContent = await ColdOutreach.ensureProperBodyTags(
      finalMessage.content
    );

    // Generate a subject line for the follow-up email
    const subject = `Re: ${previousEmail.emailSubject}`;

    return {
      previousEmail,
      content: formattedContent,
      subject,
      model: RequestyAiModelEnum.gemini2Flash,
      citations: finalMessage.citations || [],
    };
  }

  /**
   * Ensure email content has proper <body> tags
   */
  static async ensureProperBodyTags(
    content: string,
    maxAttempts = 3
  ): Promise<string> {
    content = content
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\[\d+\]/g, "")
      .replace(/```[\w-]*\n?/g, "")
      .replace(/<think>.*?<\/think>/gs, "");
    let cleanContent = content;
    let attempts = 0;

    while (
      (!cleanContent.trim().startsWith("<body>") ||
        !cleanContent.trim().endsWith("</body>")) &&
      attempts < maxAttempts
    ) {
      attempts++;
      console.log(
        `Content doesn't have proper <body> tags. Fix attempt ${attempts}/${maxAttempts}...`
      );
      console.log(cleanContent);

      // Try to fix the content using Gemini
      const fixMessages = [
        {
          sender: "user",
          content: `Fix this HTML content so it starts with <body> and ends with </body>. Don't add any explanations, just return the fixed HTML:\n\n${cleanContent}`,
        },
      ];

      const request: SendChatMessageRequest = {
        systemPrompt: FIX_HTML_PROMPT,
        model: RequestyAiModelEnum.gemini2Flash,
        temperature: 0,
        messages: fixMessages,
        preMessage: FIX_HTML_PROMPT_PRE_MESSAGE,
        promptName: "Cold Outreach Fix HTML",
      };

      const requestyServiceClient = new RequestyServiceClient();
      const fixedMessage = await requestyServiceClient.sendRequest(request);

      cleanContent = fixedMessage.content;

      if (
        cleanContent.trim().startsWith("<body>") &&
        cleanContent.trim().endsWith("</body>")
      ) {
        console.log("Content successfully fixed with proper <body> tags.");
        break;
      }
    }

    if (
      !cleanContent.trim().startsWith("<body>") ||
      !cleanContent.trim().endsWith("</body>")
    ) {
      throw new Error(
        "Failed to generate email with proper HTML structure after multiple attempts"
      );
    }

    return cleanContent;
  }

  /**
   * Generate email subject
   */
  static async generateEmailSubject(
    name: string,
    emailBody: string
  ): Promise<string> {
    const messages = [
      {
        sender: "user",
        content: `Generate a concise, compelling email subject line for a cold outreach email to ${name}, who is a finance influencer. The email body is as follows:\n\n${emailBody}\n\nThe subject line should be attention-grabbing, personalized, and relevant to the content of the email. Do not include any explanations, just return the subject line text.`,
      },
    ];

    const request: SendChatMessageRequest = {
      systemPrompt: HELPFUL_ASSISTANT_PROMPT,
      model: RequestyAiModelEnum.gemini2Flash,
      temperature: 0,
      messages,
      promptName: "Cold Outreach Subject",
      preMessage: HELPFUL_ASSISTANT_PROMPT_PRE_MESSAGE,
    };

    const requestyServiceClient = new RequestyServiceClient();
    const message = await requestyServiceClient.sendRequest(request);

    // Clean up any potential formatting or extra text
    let subject = message.content.trim();
    // Remove any quotes if present
    subject = subject.replace(/^["']|["']$/g, "");

    return subject;
  }

  /**
   * Send email and track it in the database
   */
  static async sendAndTrackEmail(options: {
    to: string;
    name: string;
    subject: string;
    content: string;
    fromEmail: string;
    fromName: string;
    model: ModelEnum;
    isFollowUp?: boolean;
    previousEmailId?: string;
    bcc?: string | string[];
  }): Promise<ColdOutreach> {
    const {
      to,
      name,
      subject,
      content,
      fromEmail,
      fromName,
      model,
      isFollowUp,
      previousEmailId,
      bcc,
    } = options;

    // Apply styling to email content

    const formattedContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email from ${fromName}</title>
</head>
${content}`;

    // Generate a unique email ID
    const emailId = uuidv4();

    let emailTrackingData: IColdOutreachData;
    let previousEmail: ColdOutreach | null = null;

    if (isFollowUp && previousEmailId) {
      // If this is a follow-up, find and update the previous email
      const previousEmailDoc = await ColdOutreachModel.findOne({
        initialEmailId: previousEmailId,
      });

      if (!previousEmailDoc) {
        throw new Error(`Previous email with ID ${previousEmailId} not found`);
      }

      previousEmail = new ColdOutreach(previousEmailDoc);

      // Update the previous email record
      previousEmail.status = EmailStatus.FOLLOW_UP_SENT;
      previousEmail.followUpSentDate = new Date();
      previousEmail.followUpEmailId = emailId;
      previousEmail.followUpContent = content;
      await previousEmail.save();

      emailTrackingData = previousEmail;
    } else {
      // Create new tracking record for initial email
      emailTrackingData = {
        recipientName: name,
        recipientEmail: to,
        initialSentDate: new Date(),
        initialEmailId: emailId,
        status: EmailStatus.INITIAL,
        emailContent: content,
        emailSubject: subject,
        modelUsed: model,
      };
    }
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY is not set");
    }
    // Send the email
    try {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to,
        from: { email: fromEmail, name: fromName },
        subject,
        html: formattedContent,
        bcc: bcc || undefined,
        // Optional threading headers
        headers:
          isFollowUp && previousEmailId
            ? {
                References: `<${previousEmailId}@nexustrade.mail>`,
                "In-Reply-To": `<${previousEmailId}@nexustrade.mail>`,
              }
            : undefined,
      };

      await sgMail.send(msg);
      console.log(`Email sent to ${to}`);

      // Only create a new record if it's not a follow-up
      if (!isFollowUp || !previousEmail) {
        const newEmail = new ColdOutreach(emailTrackingData);
        await newEmail.save();
        return newEmail;
      } else {
        return previousEmail;
      }
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  /**
   * Get emails that need follow-up
   */
  static async getEmailsNeedingFollowUp(options: {
    minDaysSinceLastUpdate: number;
    maxDaysSinceLastUpdate: number;

    limit?: number;
  }): Promise<ColdOutreach[]> {
    const {
      minDaysSinceLastUpdate,
      maxDaysSinceLastUpdate,

      limit = 50,
    } = options;

    const minDate = moment().subtract(maxDaysSinceLastUpdate, "days").toDate();
    const maxDate = moment().subtract(minDaysSinceLastUpdate, "days").toDate();

    const query: any = {
      // Only get emails in INITIAL status (not responded, not already followed up)
      status: EmailStatus.INITIAL,
      // Use updatedAt to determine when we last touched this record
      updatedAt: {
        $gte: minDate,
        $lte: maxDate,
      },
    };

    const emailDocs = await ColdOutreachModel.find(query)
      .sort({ updatedAt: 1 }) // Sort by last updated time (oldest first)
      .limit(limit);

    return emailDocs.map((doc) => new ColdOutreach(doc));
  }

  /**
   * Update email status
   */
  static async updateEmailStatus(
    emailId: string,
    status: EmailStatus,
    notes?: string
  ): Promise<ColdOutreach> {
    const emailDoc = await ColdOutreachModel.findOne({
      initialEmailId: emailId,
    });

    if (!emailDoc) {
      throw new Error(`Email with ID ${emailId} not found`);
    }

    const email = new ColdOutreach(emailDoc);
    email.status = status;

    if (notes) {
      const timestamp = new Date().toISOString();
      email.notes = email.notes
        ? `${email.notes}\n\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`;
    }

    await email.save();
    return email;
  }

  /**
   * Find an email by recipient email
   */
  static async findByRecipientEmail(email: string): Promise<ColdOutreach[]> {
    const query: any = { recipientEmail: email };

    const emailDocs = await ColdOutreachModel.find(query).sort({
      initialSentDate: -1,
    });
    return emailDocs.map((doc) => new ColdOutreach(doc));
  }

  /**
   * Find an email by ID
   */
  static async findByEmailId(emailId: string): Promise<ColdOutreach> {
    const emailDoc = await ColdOutreachModel.findOne({
      initialEmailId: emailId,
    });
    if (!emailDoc) {
      throw new Error(`Email with ID ${emailId} not found`);
    }
    return new ColdOutreach(emailDoc);
  }

  /**
   * Find all emails for a user
   */
  static async findAll(options?: {
    status?: EmailStatus;
    limit?: number;
    skip?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  }): Promise<ColdOutreach[]> {
    const query: any = {};

    if (options?.status) {
      query.status = options.status;
    }

    let sortOptions: any = { initialSentDate: -1 };
    if (options?.sortBy) {
      sortOptions = {
        [options.sortBy]: options.sortDir === "asc" ? 1 : -1,
      };
    }

    const emailDocs = await ColdOutreachModel.find(query)
      .sort(sortOptions)
      .skip(options?.skip || 0)
      .limit(options?.limit || 100);

    return emailDocs.map((doc) => new ColdOutreach(doc));
  }

  /**
   * Migrate emails from sent.tsv file
   */
  static async migrateFromTsv(
    filePath: string,
    options?: {
      defaultSubject?: string;
      defaultModel?: ModelEnum;
      skipExisting?: boolean;
    }
  ): Promise<{ total: number; migrated: number; skipped: number }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, "utf8");
    const lines = fileContent.split("\n");

    // Skip header line if present
    const dataLines = lines.filter(
      (line) => line.trim() !== "" && !line.startsWith("Name\tEmail\tDate")
    );

    let total = 0;
    let migrated = 0;
    let skipped = 0;

    for (const line of dataLines) {
      total++;
      const parts = line.split("\t");
      if (parts.length < 3) {
        skipped++;
        continue;
      }

      const [name, email, dateSent] = parts;

      // Check if email already exists
      if (options?.skipExisting) {
        const existingEmails = await ColdOutreach.findByRecipientEmail(email);
        if (existingEmails.length > 0) {
          console.log(`Skipping ${email} - already exists in database`);
          skipped++;
          continue;
        }
      }

      try {
        const emailData: IColdOutreachData = {
          recipientName: name,
          recipientEmail: email,
          initialSentDate: moment(dateSent, "MMMM D, YYYY").toDate(),
          initialEmailId: uuidv4(),
          status: EmailStatus.INITIAL,
          emailContent: "Content not available - migrated from sent.tsv",
          emailSubject:
            options?.defaultSubject ||
            "Partnership Opportunity with NexusTrade",
          modelUsed:
            options?.defaultModel || RequestyAiModelEnum.sonarReasoningPro,
          notes: `Migrated from sent.tsv file on ${moment().format(
            "MMMM D, YYYY"
          )}`,
        };

        const coldOutreach = new ColdOutreach(emailData);
        await coldOutreach.save();
        migrated++;
      } catch (error) {
        console.error(`Error migrating ${email}:`, error);
        skipped++;
      }
    }

    return { total, migrated, skipped };
  }

  static async updateEmailContent(
    name: string,
    originalContent: string,
    updateInstructions: string,
    model: ModelEnum = RequestyAiModelEnum.gemini2Flash
  ): Promise<{ content: string; citations: string[] }> {
    const messages = [
      {
        sender: "user",
        content: `${name}`,
      },
      {
        sender: "assistant",
        content: originalContent,
      },
      {
        sender: "user",
        content: updateInstructions,
      },
    ];

    const request: SendChatMessageRequest = {
      systemPrompt: HELPFUL_ASSISTANT_PROMPT,
      model,
      temperature: 0,
      messages,
      preMessage: HELPFUL_ASSISTANT_PROMPT_PRE_MESSAGE,
      promptName: "Cold Outreach Update Email Content",
    };

    // Generate updated content
    const requestyServiceClient = new RequestyServiceClient();
    const message = await requestyServiceClient.sendRequest(request);

    // Clean and format the updated content
    let cleanContent = message.content;

    // Ensure proper HTML format
    return {
      content: await ColdOutreach.ensureProperBodyTags(cleanContent),
      citations: message.citations || [],
    };
  }
}

export default ColdOutreach;

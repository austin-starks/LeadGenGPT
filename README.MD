# LeadGenGPT

**LeadGenGPT** is an open-source AI-powered system for automating cold email outreach and lead generation. It leverages artificial intelligence to craft personalized emails, track responses, and manage follow-ups, helping businesses efficiently connect with potential customers. Built with TypeScript and Node.js, LeadGenGPT integrates with email services, databases, and AI models to streamline the lead generation process.

## Features

- **AI-Generated Personalized Emails**: Automatically create tailored email content for initial outreach.
- **Automated Email Sending**: Send emails with tracking capabilities to monitor delivery and responses.
- **Email Status Management**: Track statuses such as "Sent," "Responded," or "Follow-Up Needed."
- **AI-Assisted Follow-Ups**: Generate intelligent follow-up emails based on previous interactions.
- **Database Integration**: Store and manage lead information in local or cloud-based databases.
- **Customizable Templates**: Modify email templates and AI prompts to suit your needs.
- **Test Mode**: Send emails to a configurable test address in local mode for safe experimentation.

## Installation

### Prerequisites

Before setting up LeadGenGPT, ensure you have the following:

- **Node.js** (version 18 or higher) and **npm** installed.
- **TypeScript** installed globally (`npm install -g typescript`) or via `ts-node` for development.
- **MongoDB** installed locally or accessible via a cloud connection string.
- **SendGrid Account** and API key for email sending ([Sign up here](https://sendgrid.com/)).
- **Requesty.ai API Key** for cloud-based AI services ([Sign up here](https://app.requesty.ai/join?ref=e0603ee5) - referral link).
- A `.env` file with required environment variables (see setup instructions below).

### Setup

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/user-a/LeadGenGPT.git
   cd LeadGenGPT
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:

   Create a `.env` file in the root directory and add the following:

   ```
   SENDGRID_API_KEY=your_sendgrid_api_key
   CLOUD_DB=mongodb://your_cloud_db_connection_string
   LOCAL_DB=mongodb://localhost:27017/leadgen_db
   REQUESTY_API_KEY=your_requesty_api_key
   TEST_EMAIL=your_test_email@example.com
   SENDGRID_EMAIL=your_sendgrid_email@example.com
   FROM_NAME="Your Name"
   FROM_FIRST_NAME=FirstName
   ```

   **Note**:

   - Replace placeholder values with your actual credentials (e.g., set `TEST_EMAIL` to your preferred testing email address).
   - Do not commit the `.env` file to your repository. Keep API keys secure!

## Usage

LeadGenGPT provides three main scripts to manage the lead generation process: sending initial emails, checking statuses, and sending follow-ups. Below are instructions for each.

### Sending Initial Outreach Emails

Send personalized cold emails to a list of recipients:

```bash
ts-node src/sendEmails.ts
```

- **How It Works**:

  - Loads a predefined list of recipients (editable in `sendEmails.ts`).
  - Generates AI-crafted email content for each recipient.
  - Prompts you to review and approve each email (`y/yes`, `n/no`, `t/test`, `u/update`, `s/skip`, `cs/change subject`).
  - In `local` mode (`DB_LOCATION=local`), emails are sent to the address specified in `TEST_EMAIL` for testing.
  - In `cloud` mode, emails are sent to the actual recipients.

- **Example**:
  ```
  Generating email for User A...
  Subject: Opportunity to Collaborate
  [Email content displayed]
  Send this email? (y/yes, n/no, t/test, u/update, s/skip, cs/change subject): y
  Email sent to user-a@example.com
  ```

### Checking and Updating Email Statuses

Monitor and update the status of sent emails:

```bash
ts-node src/checkStatus.ts
```

- **How It Works**:

  - Choose between:
    1. **Bulk Check**: Reviews all emails with `INITIAL` status.
    2. **Specific Email**: Updates status by recipient email address.
  - For bulk checks, prompts you to confirm replies (`y/yes`, `n/no`, `s/skip`) and add notes.
  - For specific emails, select an email and choose a new status (e.g., `RESPONDED`).

- **Example**:
  ```
  Choose action (1: Check and update status, 2: Update by email): 1
  Found 5 emails waiting for responses
  User A (user-a@example.com) - Sent 3 days ago
  Did they reply? (y/n/s to skip): y
  Add notes about their response: Interested, requested more info
  Status updated to RESPONDED
  ```

### Sending Follow-Up Emails

Generate and send follow-up emails to non-responders:

```bash
ts-node src/followUp.ts
```

- **How It Works**:

  - Choose between:
    1. **Bulk Follow-Ups**: Processes emails needing follow-ups (7-30 days since last update).
    2. **Specific Follow-Up**: Targets a single recipient by email or email ID.
  - Displays initial email details and generates AI-crafted follow-up content.
  - Prompts for actions (`s/send`, `t/test`, `u/update`, `c/change subject`, `r/regenerate`, `q/quit`, `skip`).

- **Example**:
  ```
  Choose mode: (1) Process follow-ups in bulk, (2) Process specific follow-up, (3) Exit: 1
  Found 3 emails that need follow-up
  Processing follow-up for: User B (user-b@example.com)
  Generated Follow-Up Email for User B
  Subject: Following Up on Our Previous Conversation
  [Follow-up content displayed]
  Action: (s)end, (t)est send, (u)pdate, (c)hange subject, (r)egenerate, (q)uit, (skip): s
  Follow-up email sent to user-b@example.com
  ```

## Configuration

Customize LeadGenGPT by adjusting the following:

- **Database Location**:

  - Set `DB_LOCATION` in `.env` to `"local"` or `"cloud"` to switch databases.
  - Local mode uses `LOCAL_DB`; cloud mode uses `CLOUD_DB`.

- **AI Service**:

  - Uses Requesty.ai by default (requires `REQUESTY_API_KEY`).

- **Email Sending**:

  - Configure `SENDGRID_API_KEY`, `SENDGRID_EMAIL`, and `TEST_EMAIL` in `.env`.
  - Modify email logic in `services/emailService.ts` if using a different provider.

- **AI Prompts**:
  - Edit prompts in `models/coldOutreach.ts` to tailor email generation.
- **Customizing AI Prompts**:
  - Navigate to `src/prompts/coldOutreach.ts`
  - Replace the placeholder sections marked with `[brackets]` with your information:
    - Personal facts and background
    - Company/product details
    - Partnership/invitation specifics
    - Example successful email
  - Update the LinkedIn URL and name in the template
  - Modify the email format if needed
  - Keep the HTML structure intact for proper rendering
  - Test the prompt with a few sample recipients to ensure it generates appropriate emails

## Contributing

We welcome contributions to LeadGenGPT! To get started:

1. Fork the repository.
2. Create a branch for your feature or bug fix (`git checkout -b feature-name`).
3. Commit your changes with descriptive messages.
4. Submit a pull request to the main repository.

Please follow the code of conduct and ensure your code aligns with the project's style.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Disclaimer

Please use LeadGenGPT responsibly and in compliance with all applicable laws, including anti-spam regulations (e.g., CAN-SPAM Act). Obtain consent from recipients before sending emails, and respect their privacy.

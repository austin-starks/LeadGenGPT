import { ChatMessage } from "../models/message";
import { SendChatMessageRequest } from "../models/aiChatLog/shared";
import moment from "moment-timezone";

export enum RequestyAiModelEnum {
  gemini2Flash = "google/gemini-2.0-flash-001",
  o3Mini = "openai/o3-mini-2025-01-31",
  claude37Sonnet = "anthropic/claude-3-7-sonnet-latest",
  qwenTurbo = "alibaba/qwen-turbo",
  sonarReasoningPro = "perplexity/sonar-reasoning-pro",
  sonarPro = "perplexity/sonar-pro",
}

export type ModelEnum = RequestyAiModelEnum;

export interface ChatMessageWithRole {
  role: "user" | "assistant" | "system";
  content: string;
  data?: any;
}

export const transformSenderToRole = (
  message: ChatMessage
): ChatMessageWithRole => {
  const sender = message.sender.toLowerCase().trim();
  const role =
    sender === "ai assistant" || sender === "assistant"
      ? "assistant"
      : sender === "system"
      ? "system"
      : "user";
  return { role, content: message?.content || "" };
};

abstract class GenerativeAIServiceClient {
  abstract sendRequest(request: SendChatMessageRequest): Promise<ChatMessage>;

  applyPreMessage(messages: ChatMessage[], preMessage: string): ChatMessage[] {
    if (messages.length > 0) {
      messages[0].content = `(TIME CONTEXT): The time is ${moment()
        .tz("America/New_York")
        .format("MMMM Do YYYY, h:mm:ss a")} EST\n\n${messages[0].content}`;
    }
    if (preMessage && messages.length > 0) {
      messages[
        messages.length - 1
      ].content = `(MESSAGE HINT – DO NOT USE THIS MESSAGE IN YOUR RESPONSE): ${preMessage}\n\n(USER MESSAGE): ${
        messages[messages.length - 1].content
      }`;
    }
    return messages;
  }
}

export default GenerativeAIServiceClient;

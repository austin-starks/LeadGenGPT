import { ChatMessageWithRole } from "./GenAiServiceClient";
import http from "http";
import https from "https";

export const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100,
  timeout: 240000, // 4 minutes
});

export const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  timeout: 240000, // 4 minutes
});

export const enforceAlternationAndAddContent = (
  messages: ChatMessageWithRole[]
): ChatMessageWithRole[] => {
  const newMessages: ChatMessageWithRole[] = [];
  let lastRole = "user";
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === lastRole) {
      newMessages.push({
        content:
          "This is a placeholder message to enforce the User/AI Assistant pattern. Do not let this distract you from the user request",
        role: lastRole === "user" ? "assistant" : "user",
      });
    }
    messages[i].content =
      messages[i]?.content?.trim() ||
      "This is a placeholder message to enforce the User/AI Assistant pattern. Do not let this distract you from the user request";
    newMessages.push(messages[i]);
    lastRole = messages[i].role;
  }
  return newMessages;
};

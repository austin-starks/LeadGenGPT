import { ChatMessage } from "../message";
import { ModelEnum } from "../../services/GenAiServiceClient";

export interface SendChatMessageRequest {
  systemPrompt: string;
  model: ModelEnum;
  temperature: number;
  messages: ChatMessage[];
  preMessage: string;
  promptName: string;
}

export enum AiChatTypeEnum {
  Image = "image",
  Embeddings = "embeddings",
  Chat = "chat",
}

import GenerativeAIServiceClient, {
  RequestyAiModelEnum,
  transformSenderToRole,
} from "./GenAiServiceClient";
import RequestyChatLog, {
  RequestyChatMessage,
  RequestyChatRequest,
  RequestyChatResponse,
} from "../models/aiChatLog/requesty";
import { httpAgent, httpsAgent } from "./shared";

import { ChatMessage } from "../models/message";
import { SendChatMessageRequest } from "../models/aiChatLog/shared";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

class RequestyServiceClient extends GenerativeAIServiceClient {
  baseUrl: string = "https://router.requesty.ai/v1/chat/completions";

  async getModels(): Promise<RequestyAiModelEnum[]> {
    return Object.values(RequestyAiModelEnum);
  }

  async sendRequest(request: SendChatMessageRequest): Promise<ChatMessage> {
    const { systemPrompt, temperature, messages, model } = request;

    const systemPromptMessage = {
      sender: "system",
      content: systemPrompt,
    };

    const requestyResponse = await this.submitRequest(
      request.promptName,
      [systemPromptMessage, ...messages],
      request.preMessage,
      model,
      temperature
    );

    if (!requestyResponse.choices[0].message?.content) {
      throw new Error("No content in Requesty response");
    }

    const content = requestyResponse.choices[0].message.content;
    const message: ChatMessage = {
      sender: "AI Assistant",
      content,
    };

    return message;
  }

  private async submitRequest(
    promptName: string,
    messages: ChatMessage[],
    preMessage: string,
    model: string,
    temperature: number
  ): Promise<RequestyChatResponse> {
    messages = this.applyPreMessage(messages, preMessage);

    let formattedMessages = messages.map(transformSenderToRole);

    return await this.chat(promptName, formattedMessages, model, temperature);
  }

  private adjustTemperature(model: string, temperature: number): number {
    if (model === RequestyAiModelEnum.o3Mini) {
      return 1;
    }
    return temperature;
  }

  private async chat(
    promptName: string,
    messages: RequestyChatMessage[],
    model: string,
    temperature: number
  ): Promise<RequestyChatResponse> {
    const apiKey = process.env.REQUESTY_API_KEY;
    if (!apiKey) {
      throw new Error("API key for Requesty is missing");
    }
    temperature = this.adjustTemperature(model, temperature);
    const requestPayload: RequestyChatRequest = {
      model,
      messages,
      temperature,

      requesty: {
        extra: {
          title: promptName,
        },
      },
    };

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    let response = await axios.post<RequestyChatResponse>(
      this.baseUrl,
      requestPayload,
      {
        headers,
        httpsAgent,
        httpAgent,
      }
    );
    let data = response.data;
    if (!data) {
      throw new Error("No data in Requesty response");
    }

    await RequestyChatLog.logChat(requestPayload, data, null);
    return data;
  }
}

export default RequestyServiceClient;

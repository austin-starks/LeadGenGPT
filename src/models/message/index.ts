import mongoose, { Schema, Types } from "mongoose";

export interface ChatMessage {
  sender: string;
  content: string;
  timestamp?: Date;
  error?: boolean;
  citations?: string[];
}

export interface SuggestedMessage {
  message: string;
  label: string;
}

const messageSchema = new Schema({
  content: { type: String, default: "" },
  sender: { type: String, default: "" },
  citations: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
  error: { type: Boolean, default: false },
});

const MessageModel = mongoose.model("Message", messageSchema);

class Message {
  _id?: Types.ObjectId;
  sender: string;

  content: string;
  timestamp?: Date;
  error?: boolean;
  data?: Record<string, any>;

  constructor(messageConfig: ChatMessage) {
    this.sender = messageConfig.sender;
    this.content = messageConfig.content || "";
    this.timestamp = messageConfig.timestamp || new Date();
    this.error = messageConfig.error;
    this.validate();
  }

  validate() {
    if (!this.sender) {
      throw new Error("Sender is required");
    }
  }

  async save() {
    if (this._id) {
      await MessageModel.updateOne({ _id: this._id }, this, { upsert: true });
      return;
    }
    const model = await MessageModel.create(this);
    this._id = model.id;
  }

  static async create(messageConfig: ChatMessage): Promise<Message> {
    const message = new Message({
      ...messageConfig,
    });
    await message.save();
    return message;
  }
}

export default Message;

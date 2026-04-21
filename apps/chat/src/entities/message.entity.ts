import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT  = 'text',
  IMAGE = 'image',
  FILE  = 'file',
}

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  /** UUID from auth_users */
  @Prop({ required: true, index: true })
  senderId: string;

  @Prop({ required: true, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @Prop({ required: true, maxlength: 4000 })
  content: string;

  /** Array of userIds who have read this message */
  @Prop({ type: [String], default: [] })
  readBy: string[];

  // timestamps: true adds createdAt + updatedAt
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Primary query: messages in a room, newest first
MessageSchema.index({ roomId: 1, createdAt: -1 });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

export enum MessageType {
  TEXT  = 'text',
  IMAGE = 'image',
  FILE  = 'file',
}

@Schema({ _id: false })
export class Attachment {
  @Prop({ required: true })  url: string;
  @Prop({ required: true })  name: string;
  @Prop({ required: true })  size: number;
  @Prop({ required: true })  mimeType: string;
}
export const AttachmentSchema = SchemaFactory.createForClass(Attachment);

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Room', required: true, index: true })
  roomId: Types.ObjectId;

  /** UUID from auth_users */
  @Prop({ required: true, index: true })
  senderId: string;

  @Prop({ required: true, enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  /**
   * Legacy plaintext. Nullable — must be empty after legacy encrypt
   * migration runs. Drop this column once `encVersion >= 1` everywhere.
   */
  @Prop({ type: String, required: false, maxlength: 4000, default: null })
  content: string | null;

  /** AES-GCM ciphertext (base64). Includes 16-byte auth tag appended. */
  @Prop({ type: String, required: false, maxlength: 8000, default: null })
  ciphertext: string | null;

  /** 12-byte IV (base64) used for the AES-GCM op. */
  @Prop({ type: String, required: false, maxlength: 32, default: null })
  iv: string | null;

  /**
   * Encryption version:
   *   0 / undefined — legacy plaintext in `content`
   *   1            — server-side AES-256-GCM at-rest (key in env)
   *   2            — client E2EE (server cannot decrypt)
   */
  @Prop({ type: Number, default: 0, index: true })
  encVersion: number;

  /** File / image metadata when type !== TEXT. */
  @Prop({ type: AttachmentSchema, default: null })
  attachment: Attachment | null;

  /**
   * Reactions keyed by emoji → set of userIds.
   * Stored as a Mongoose Map so atomic ops on a single emoji are cheap:
   *   $addToSet: { 'reactions.👍': userId }
   */
  @Prop({ type: Map, of: [String], default: {} })
  reactions: Map<string, string[]>;

  /** Array of userIds who have read this message */
  @Prop({ type: [String], default: [] })
  readBy: string[];

  /** Timestamp of last edit; null if never edited. */
  @Prop({ type: Date, default: null })
  editedAt: Date | null;

  /** Soft-delete timestamp. When set, body is cleared and clients render a tombstone. */
  @Prop({ type: Date, default: null, index: true })
  deletedAt: Date | null;

  // timestamps: true adds createdAt + updatedAt
}

export const MessageSchema = SchemaFactory.createForClass(Message);

// Primary query: messages in a room, newest first
MessageSchema.index({ roomId: 1, createdAt: -1 });

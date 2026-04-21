import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RoomDocument = Room & Document;

export enum RoomType {
  DM    = 'dm',
  GROUP = 'group',
}

@Schema({ collection: 'rooms', timestamps: true })
export class Room {
  @Prop({ required: true, enum: RoomType, default: RoomType.DM })
  type: RoomType;

  /** Display name — required for groups, optional for DMs */
  @Prop({ type: String, default: null })
  name: string | null;

  /** UUID strings from auth_users */
  @Prop({ type: [String], required: true, index: true })
  members: string[];

  /** UUID of creator */
  @Prop({ required: true })
  createdBy: string;

  // timestamps: true adds createdAt + updatedAt automatically
}

export const RoomSchema = SchemaFactory.createForClass(Room);

// Compound index: look up rooms a user belongs to, sorted by recent activity
RoomSchema.index({ members: 1, updatedAt: -1 });

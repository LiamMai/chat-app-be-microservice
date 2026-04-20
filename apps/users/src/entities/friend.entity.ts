import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum FriendStatus {
  PENDING  = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  BLOCKED  = 'blocked',
}

@Entity('friends')
@Index(['userId', 'friendId'], { unique: true })
@Index(['friendId', 'status'])  // fast incoming request lookup
@Index(['userId', 'status'])    // fast outgoing + friend list lookup
export class FriendEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user who initiated the action (sent request / blocked) */
  @Column('uuid')
  userId: string;

  /** The target user */
  @Column('uuid')
  friendId: string;

  @Column({ type: 'enum', enum: FriendStatus, default: FriendStatus.PENDING })
  status: FriendStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

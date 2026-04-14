import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Permission } from '@app/common';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  keyHash: string; // SHA-256 hex of the full key

  @Column({ length: 12 })
  prefix: string; // First 12 chars shown in UI for identification

  @Column({ type: 'text', array: true, default: [] })
  permissions: Permission[];

  @Column({ type: 'timestamp with time zone', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastUsedAt: Date | null;

  @Column({ default: false })
  isRevoked: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

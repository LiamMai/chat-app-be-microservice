import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Gender, Role } from '@app/common';

@Entity('auth_users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ length: 50, name: 'first_name', default: '' })
  firstName: string;

  @Column({ length: 50, name: 'last_name', default: '' })
  lastName: string;

  @Column({ select: false })
  password: string;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  // ── Extended profile ──────────────────────────────────────────────────────

  @Column({ type: 'varchar', nullable: true, length: 50, unique: true })
  username: string | null;

  @Column({ type: 'varchar', nullable: true, length: 200 })
  bio: string | null;

  @Column({ type: 'enum', enum: Gender, enumName: 'gender_enum', nullable: true })
  gender: Gender | null;

  @Column({ type: 'date', nullable: true })
  birthdate: Date | null;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  location: string | null;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  website: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, name: 'avatar_url' })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, name: 'cover_url' })
  coverUrl: string | null;

  // ─────────────────────────────────────────────────────────────────────────

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

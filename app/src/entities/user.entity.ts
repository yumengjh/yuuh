import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  userId: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true, length: 100 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  bio: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  settings: object;

  // 关联
  @OneToMany(() => Workspace, (workspace) => workspace.owner)
  ownedWorkspaces: Workspace[];

  @OneToMany(() => WorkspaceMember, (member) => member.user)
  workspaceMembers: WorkspaceMember[];
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';

@Entity('workspace_members')
export class WorkspaceMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Workspace, (workspace) => workspace.members)
  @JoinColumn({ name: 'workspace_id', referencedColumnName: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;

  @ManyToOne(() => User, (user) => user.workspaceMembers)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column()
  role: string;

  @CreateDateColumn()
  joinedAt: Date;

  @Column({ nullable: true })
  invitedBy: string;
}

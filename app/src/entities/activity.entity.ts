import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { User } from './user.entity';

@Entity('activities')
@Index(['workspaceId', 'createdAt'])
@Index(['userId', 'createdAt'])
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  activityId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.activities)
  @JoinColumn({ name: 'workspace_id', referencedColumnName: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;

  @Column()
  action: string;

  @Column()
  entityType: string;

  @Column()
  entityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'jsonb', default: {} })
  details: object;

  @Column({ type: 'jsonb', default: {} })
  metadata: object;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;
}

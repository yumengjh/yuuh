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

@Entity('tags')
@Index(['workspaceId', 'name'], { unique: true })
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  tagId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.tags)
  @JoinColumn({ name: 'workspace_id', referencedColumnName: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  color: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by', referencedColumnName: 'userId' })
  createdByUser: User;

  @Column()
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: 0 })
  usageCount: number;
}

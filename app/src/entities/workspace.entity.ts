import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Document } from './document.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { Asset } from './asset.entity';
import { Tag } from './tag.entity';
import { Activity } from './activity.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  workspaceId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 10, nullable: true })
  icon: string;

  @ManyToOne(() => User, (user) => user.ownedWorkspaces)
  @JoinColumn({ name: 'owner_id', referencedColumnName: 'userId' })
  owner: User;

  @Column()
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: 'active' })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  settings: object;

  // 关联
  @OneToMany(() => Document, (document) => document.workspace)
  documents: Document[];

  @OneToMany(() => WorkspaceMember, (member) => member.workspace)
  members: WorkspaceMember[];

  @OneToMany(() => Asset, (asset) => asset.workspace)
  assets: Asset[];

  @OneToMany(() => Tag, (tag) => tag.workspace)
  tags: Tag[];

  @OneToMany(() => Activity, (activity) => activity.workspace)
  activities: Activity[];
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Workspace } from './workspace.entity';
import { Block } from './block.entity';
import { DocRevision } from './doc-revision.entity';
import { Favorite } from './favorite.entity';
import { Comment } from './comment.entity';

@Entity('documents')
@Index(['workspaceId', 'status'])
@Index(['updatedAt'])
export class Document {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  docId: string;

  @ManyToOne(() => Workspace, (workspace) => workspace.documents)
  @JoinColumn({ name: 'workspace_id', referencedColumnName: 'workspaceId' })
  workspace: Workspace;

  @Column()
  workspaceId: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  cover: string;

  @Column({ default: 1 })
  head: number;

  @Column({ default: 0 })
  publishedHead: number;

  @Column()
  rootBlockId: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  createdBy: string;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column()
  updatedBy: string;

  @Column({ default: 'draft' })
  status: string;

  @Column({ default: 'private' })
  visibility: string;

  @Column({ nullable: true })
  parentId: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  favoriteCount: number;

  @Column({ type: 'text', array: true, default: [] })
  tags: string[];

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'tsvector', nullable: true })
  searchVector: any;

  // 关联
  @OneToMany(() => Block, (block) => block.document)
  blocks: Block[];

  @OneToMany(() => DocRevision, (revision) => revision.document)
  revisions: DocRevision[];

  @OneToMany(() => Favorite, (favorite) => favorite.document)
  favorites: Favorite[];

  @OneToMany(() => Comment, (comment) => comment.document)
  comments: Comment[];
}

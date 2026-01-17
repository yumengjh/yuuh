import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { Block } from './block.entity';
import { User } from './user.entity';

@Entity('comments')
@Index(['docId'])
@Index(['blockId'])
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  commentId: string;

  @ManyToOne(() => Document, (document) => document.comments)
  @JoinColumn({ name: 'doc_id', referencedColumnName: 'docId' })
  document: Document;

  @Column()
  docId: string;

  @ManyToOne(() => Block)
  @JoinColumn({ name: 'block_id', referencedColumnName: 'blockId' })
  block: Block;

  @Column({ nullable: true })
  blockId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  user: User;

  @Column()
  userId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', array: true, default: [] })
  mentions: string[];

  @ManyToOne(() => Comment)
  @JoinColumn({ name: 'parent_comment_id', referencedColumnName: 'commentId' })
  parentComment: Comment;

  @Column({ nullable: true })
  parentCommentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ default: false })
  isDeleted: boolean;
}

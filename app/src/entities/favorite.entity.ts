import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Document } from './document.entity';

@Entity('favorites')
@Index(['userId', 'docId'], { unique: true })
export class Favorite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Document, (document) => document.favorites)
  @JoinColumn({ name: 'doc_id', referencedColumnName: 'docId' })
  document: Document;

  @Column()
  docId: string;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Document } from './document.entity';
import { BlockVersion } from './block-version.entity';

@Entity('blocks')
@Index(['docId', 'isDeleted'])
export class Block {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 50 })
  blockId: string;

  @ManyToOne(() => Document, (document) => document.blocks)
  @JoinColumn({ name: 'doc_id', referencedColumnName: 'docId' })
  document: Document;

  @Column()
  docId: string;

  @Column()
  type: string;

  @Column({ type: 'bigint' })
  createdAt: number;

  @Column()
  createdBy: string;

  @Column()
  latestVer: number;

  @Column({ type: 'bigint' })
  latestAt: number;

  @Column()
  latestBy: string;

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'bigint', nullable: true })
  deletedAt: number;

  @Column({ nullable: true })
  deletedBy: string;

  // 关联
  @OneToMany(() => BlockVersion, (version) => version.block)
  versions: BlockVersion[];
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from '../../entities/document.entity';
import { Block } from '../../entities/block.entity';
import { BlockVersion } from '../../entities/block-version.entity';
import { DocRevision } from '../../entities/doc-revision.entity';
import { DocSnapshot } from '../../entities/doc-snapshot.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, Block, BlockVersion, DocRevision, DocSnapshot]),
    WorkspacesModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

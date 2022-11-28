import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { marker as TEXT } from '@ngneat/transloco-keys-manager/marker';
import * as AWS from 'aws-sdk';
import * as _ from 'lodash';
import { BlockUI, NgBlockUI } from 'ng-block-ui';
import { merge, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { format } from '~/app/functions.helper';
import { translate } from '~/app/i18n.helper';
import { PageStatus } from '~/app/shared/components/page-wrapper/page-wrapper.component';
import { Icon } from '~/app/shared/enum/icon.enum';
import { Datatable } from '~/app/shared/models/datatable.interface';
import { DatatableAction } from '~/app/shared/models/datatable-action.type';
import {
  DatatableCellTemplateName,
  DatatableColumn
} from '~/app/shared/models/datatable-column.type';
import { DatatableData } from '~/app/shared/models/datatable-data.type';
import { DatatableRowAction } from '~/app/shared/models/datatable-row-action.type';
import { PageAction } from '~/app/shared/models/page-action.type';
import { BytesToSizePipe } from '~/app/shared/pipes/bytes-to-size.pipe';
import {
  S3BucketService,
  S3DeleteObjectOutput,
  S3GetObjectOutput,
  S3Object,
  S3Objects,
  S3UploadProgress
} from '~/app/shared/services/api/s3-bucket.service';
import { ModalDialogService } from '~/app/shared/services/modal-dialog.service';
import { NotificationService } from '~/app/shared/services/notification.service';
import { RxjsUiHelperService } from '~/app/shared/services/rxjs-ui-helper.service';

@Component({
  selector: 's3gw-object-datatable-page',
  templateUrl: './object-datatable-page.component.html',
  styleUrls: ['./object-datatable-page.component.scss']
})
export class ObjectDatatablePageComponent implements OnInit {
  @BlockUI()
  blockUI!: NgBlockUI;

  public datatableActions: DatatableAction[];
  public bid: AWS.S3.Types.BucketName = '';
  public objects: S3Objects = [];
  public datatableColumns: DatatableColumn[];
  public icons = Icon;
  public pageActions: PageAction[];
  public pageStatus: PageStatus = PageStatus.none;

  private firstLoadComplete = false;

  constructor(
    private bytesToSizePipe: BytesToSizePipe,
    private modalDialogService: ModalDialogService,
    private notificationService: NotificationService,
    private route: ActivatedRoute,
    private rxjsUiHelperService: RxjsUiHelperService,
    private s3bucketService: S3BucketService
  ) {
    this.datatableActions = [
      {
        type: 'button',
        text: TEXT('Download'),
        icon: this.icons.download,
        enabledConstraints: {
          minSelected: 1
        },
        callback: (table: Datatable) => this.doDownload(table.selected)
      },
      {
        type: 'button',
        text: TEXT('Delete'),
        icon: this.icons.delete,
        enabledConstraints: {
          minSelected: 1
        },
        callback: (table: Datatable) => this.doDelete(table.selected)
      }
    ];
    this.datatableColumns = [
      {
        name: TEXT('Name'),
        prop: 'Key'
      },
      {
        name: TEXT('Size'),
        prop: 'Size',
        pipe: this.bytesToSizePipe
      },
      {
        name: TEXT('Last Modified'),
        prop: 'LastModified',
        cellTemplateName: DatatableCellTemplateName.localeDateTime
      },
      {
        name: '',
        prop: '',
        cellTemplateName: DatatableCellTemplateName.actionMenu,
        cellTemplateConfig: this.onActionMenu.bind(this)
      }
    ];
    this.pageActions = [
      {
        type: 'file',
        text: TEXT('Upload'),
        icon: this.icons.upload,
        callback: (event: Event) => this.doUpload((event.target as HTMLInputElement).files)
      }
    ];
  }

  ngOnInit(): void {
    this.route.params.subscribe((value: Params) => {
      if (!_.has(value, 'bid')) {
        this.pageStatus = PageStatus.ready;
        return;
      }
      this.bid = decodeURIComponent(value['bid']);
      this.loadData();
    });
  }

  loadData(): void {
    this.objects = [];
    this.pageStatus = !this.firstLoadComplete ? PageStatus.loading : PageStatus.reloading;
    this.s3bucketService
      .listObjects(this.bid)
      .pipe(
        finalize(() => {
          this.firstLoadComplete = true;
        })
      )
      .subscribe({
        next: (objects: S3Objects) => {
          _.merge(this.objects, objects);
        },
        complete: () => {
          this.pageStatus = PageStatus.ready;
        },
        error: () => {
          this.objects = [];
          this.pageStatus = PageStatus.loadingError;
        }
      });
  }

  onActionMenu(object: S3Object): DatatableRowAction[] {
    const result: DatatableRowAction[] = [
      {
        title: TEXT('Download'),
        icon: this.icons.download,
        callback: (data: DatatableData) => this.doDownload([data])
      },
      {
        type: 'divider'
      },
      {
        title: TEXT('Delete'),
        icon: this.icons.delete,
        callback: (data: DatatableData) => this.doDelete([data])
      }
    ];
    return result;
  }

  private doDownload(selected: DatatableData[]): void {
    const sources: Observable<S3GetObjectOutput>[] = [];
    _.forEach(selected, (data: DatatableData) =>
      sources.push(this.s3bucketService.downloadObject(this.bid, data['Key']))
    );
    // Download the files in parallel.
    merge(...sources).subscribe();
  }

  private doUpload(fileList: FileList | null): void {
    if (!fileList) {
      return;
    }
    this.blockUI.start(
      format(translate(TEXT('Please wait, uploading {{ total }} object(s) ...')), {
        total: fileList.length
      })
    );
    this.s3bucketService
      .uploadObjects(this.bid, fileList)
      .pipe(finalize(() => this.blockUI.stop()))
      .subscribe({
        next: (progress: S3UploadProgress) => {
          this.blockUI.update(
            format(
              translate(
                TEXT(
                  'Please wait, uploading {{ loaded }} of {{ total }} object(s) ({{ percent }}%) ...'
                )
              ),
              {
                loaded: progress.loaded,
                total: progress.total,
                percent: Math.round((Number(progress.loaded) / Number(progress.total)) * 100)
              }
            )
          );
        },
        complete: () => {
          this.notificationService.showSuccess(
            format(translate(TEXT('{{ total }} object(s) have been successfully uploaded.')), {
              total: fileList.length
            })
          );
          this.loadData();
        },
        error: (err: Error) => {
          this.notificationService.showError(
            format(translate(TEXT('Failed to upload the objects: {{ error }}')), {
              error: err.message
            })
          );
        }
      });
  }

  private doDelete(selected: DatatableData[]): void {
    this.modalDialogService.confirmation<S3Object>(
      selected as S3Object[],
      'danger',
      {
        singular: TEXT('Do you really want to delete the object <strong>{{ name }}</strong>?'),
        singularFmtArgs: (value: S3Object) => ({ name: value.Key }),
        plural: TEXT('Do you really want to delete these <strong>{{ count }}</strong> objects?')
      },
      () => {
        const sources: Observable<S3DeleteObjectOutput>[] = [];
        _.forEach(selected, (data: DatatableData) => {
          sources.push(this.s3bucketService.deleteObject(this.bid, data['Key']));
        });
        this.rxjsUiHelperService
          .concat<S3DeleteObjectOutput>(
            sources,
            {
              start: TEXT('Please wait, deleting {{ total }} object(s) ...'),
              next: TEXT(
                'Please wait, deleting object {{ current }} of {{ total }} ({{ percent }}%) ...'
              )
            },
            {
              next: TEXT('Object {{ name }} has been deleted.'),
              nextFmtArgs: (output: S3DeleteObjectOutput) => ({ name: output.Key })
            }
          )
          .subscribe({
            complete: () => this.loadData()
          });
      }
    );
  }
}
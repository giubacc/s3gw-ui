import { Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Params } from '@angular/router';

import { format } from '~/app/functions.helper';
import { AppConfigService } from '~/app/shared/services/app-config.service';

@Component({
  selector: 's3gw-page-title',
  templateUrl: './page-title.component.html',
  styleUrls: ['./page-title.component.scss']
})
export class PageTitleComponent {
  public subTitle?: string;
  public title?: string;
  public url?: string;

  constructor(
    private activatedRoute: ActivatedRoute,
    private appConfigService: AppConfigService,
    private titleService: Title
  ) {
    this.activatedRoute.params.subscribe((params: Params) => {
      this.subTitle = this.activatedRoute.snapshot.data?.['subTitle']
        ? format(this.activatedRoute.snapshot.data['subTitle'], params)
        : undefined;
      this.title = this.activatedRoute.snapshot.data?.['title']
        ? format(this.activatedRoute.snapshot.data['title'], params)
        : undefined;
      this.url = this.activatedRoute.snapshot.data?.['url']
        ? format(this.activatedRoute.snapshot.data['url'], params)
        : undefined;
      if (this.title) {
        let newTitle = `${this.appConfigService.config?.title} - ${this.title}`;
        if (this.subTitle) {
          newTitle += ` ${this.subTitle}`;
        }
        this.titleService.setTitle(newTitle);
      }
    });
  }
}

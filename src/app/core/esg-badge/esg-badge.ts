import { Component, Input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { EsgResult } from '../esg-score.service';

/**
 * Standalone badge that displays the computed ESG grade with colour coding
 * and an expandable breakdown table.
 *
 * Usage:
 *   <app-esg-badge [result]="esgResult()" />
 */
@Component({
  selector: 'app-esg-badge',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './esg-badge.html',
  styleUrl: './esg-badge.css',
})
export class EsgBadgeComponent {
  @Input({ required: true }) result!: EsgResult;

  expanded = false;

  toggle(): void {
    this.expanded = !this.expanded;
  }
}

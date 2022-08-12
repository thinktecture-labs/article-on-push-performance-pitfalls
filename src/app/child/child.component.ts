import {ChangeDetectionStrategy, Component, OnInit} from '@angular/core';

@Component({
  selector: 'app-child',
  templateUrl: './child.component.html',
  styleUrls: ['./child.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class ChildComponent implements OnInit {

  data = [
    {
      list: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
      currentIndex: 4
    }
  ];

  constructor() { }

  ngOnInit(): void {
  }

  change (gIndex:unknown, iIndex: unknown) {
    console.log(gIndex, iIndex)
  }

}

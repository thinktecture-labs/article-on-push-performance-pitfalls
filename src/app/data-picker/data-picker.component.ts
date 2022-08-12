import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {DataPickerModel} from './data-picker.models';

@Component({
  selector: 'app-data-picker',
  templateUrl: './data-picker.component.html',
  styleUrls: ['./data-picker.component.scss'],
})
export class DataPickerComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChildren('pickerGroupLayer') pickerGroupLayer;
  @ViewChild('pickerHandleLayer') pickerHandleLayer;

  @Input() data: DataPickerModel[] = [];
  @Output() changeElement: EventEmitter<any> = new EventEmitter<any>();

  constructor() {}

  currentIndexList: number[];
  lastCurrentIndexList: number[];
  groupsRectList: any[];
  touchOrMouse = {
    isTouchable: 'ontouchstart' in window,
    isMouseDown: false,
  };
  draggingInfo = {
    isDragging: false,
    groupIndex: null,
    startPageY: null,
  };
  itemPerDegree = 23;
  safeDoTimeoutId: any = null;

  ngOnInit(): void {
    this.currentIndexList = this.getInitialCurrentIndexList();
    this.lastCurrentIndexList = [].concat(this.currentIndexList);
    this.groupsRectList = new Array(this.data.length);
    window.addEventListener('resize', this.safeGetRectsBindEvents.bind(this));
  }

  ngAfterViewInit(): void {
    this.eventsRegister();
    this.getGroupsRectList();
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.safeGetRectsBindEvents.bind(this));
  }

  isCurrentItem(gIndex, iIndex): boolean {
    return this.currentIndexList[gIndex] === iIndex;
  }

  setGroupData(gIndex, groupData): void {
    if (!this.currentIndexList) {
      this.currentIndexList = this.getInitialCurrentIndexList();
    }
    this.data[gIndex] = groupData;
    const iCI = groupData.currentIndex;
    let movedIndex = 0;
    if (typeof iCI === 'number' && iCI >= 0 && groupData.list && groupData.list.length && iCI <= groupData.list.length - 1) {
      movedIndex = Math.round(iCI);
    }
    this.currentIndexList[gIndex] = movedIndex;
    this.lastCurrentIndexList = [].concat(this.currentIndexList);
  }

  getInitialCurrentIndexList(): number[] {
    return this.data.map((item, index) => {
      const iCI = item.currentIndex;
      if (typeof iCI === 'number' && iCI >= 0 && item.list && item.list.length && iCI <= item.list.length - 1) {
        return Math.round(iCI);
      }
      return 0;
    });
  }

  safeGetRectsBindEvents(): void {
    if (this.safeDoTimeoutId) {
      clearTimeout(this.safeDoTimeoutId);
    }
    this.safeDoTimeoutId = setTimeout(() => {
      this.getGroupsRectList();
    }, 200);
  }

  getGroupsRectList(): void {
    if (this.pickerGroupLayer) {
      this.pickerGroupLayer.toArray().forEach((item, index) => {
        this.groupsRectList[index] = item.nativeElement.getBoundingClientRect();
      });
    }
  }

  eventsRegister(): void {
    const handleEventLayer = this.pickerHandleLayer.nativeElement;
    if (handleEventLayer) {
      this.addEventsForElement(handleEventLayer);
    }
  }

  addEventsForElement(el): void {
    const _ = this.touchOrMouse.isTouchable;
    const eventHandlerList = [
      { name: _ ? 'touchstart' : 'mousedown', handler: this.handleStart },
      { name: _ ? 'touchmove' : 'mousemove', handler: this.handleMove },
      { name: _ ? 'touchend' : 'mouseup', handler: this.handleEnd },
      {
        name: _ ? 'touchcancel' : 'mouseleave',
        handler: this.handleCancel,
      },
    ];
    eventHandlerList.forEach((item, index) => {
      el.removeEventListener(item.name, item.handler, false);
      el.addEventListener(item.name, item.handler.bind(this), false);
    });
  }

  triggerMiddleLayerGroupClick(gIndex): void {
    const data = this.data;
    if (typeof gIndex === 'number' && typeof data[gIndex].onClick === 'function') {
      data[gIndex].onClick(gIndex, this.currentIndexList[gIndex]);
    }
  }

  triggerAboveLayerClick(ev, gIndex): void {
    const movedIndex = this.currentIndexList[gIndex] + 1;
    this.currentIndexList[gIndex] = movedIndex;
    this.correctionCurrentIndex(ev, gIndex);
  }

  triggerMiddleLayerClick(ev, gIndex): void {
    this.triggerMiddleLayerGroupClick(gIndex);
  }

  triggerBelowLayerClick(ev, gIndex): void {
    const movedIndex = this.currentIndexList[gIndex] - 1;
    this.currentIndexList[gIndex] = movedIndex;
    this.correctionCurrentIndex(ev, gIndex);
  }

  getTouchInfo(ev): any {
    return this.touchOrMouse.isTouchable ? ev.changedTouches[0] || ev.touches[0] : ev;
  }

  getGroupIndexBelongsEvent(ev): number {
    const touchInfo = this.getTouchInfo(ev);
    for (let i = 0; i < this.groupsRectList.length; i++) {
      const item = this.groupsRectList[i];
      if (item.left < touchInfo.pageX && touchInfo.pageX < item.right) {
        return i;
      }
    }
    return null;
  }

  handleEventClick(ev): void {
    const gIndex = this.getGroupIndexBelongsEvent(ev);
    switch (ev.target.dataset.type) {
      case 'top':
        this.triggerAboveLayerClick(ev, gIndex);
        break;
      case 'middle':
        this.triggerMiddleLayerClick(ev, gIndex);
        break;
      case 'bottom':
        this.triggerBelowLayerClick(ev, gIndex);
        break;
      default:
    }
  }

  handleStart(ev): void {
    if (ev.cancelable) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const touchInfo = this.getTouchInfo(ev);
    this.draggingInfo.startPageY = touchInfo.pageY;
    if (!this.touchOrMouse.isTouchable) {
      this.touchOrMouse.isMouseDown = true;
    }
  }

  handleMove(ev): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (this.touchOrMouse.isTouchable || this.touchOrMouse.isMouseDown) {
      this.draggingInfo.isDragging = true;
      this.setCurrentIndexOnMove(ev);
    }
  }

  handleEnd(ev): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (!this.draggingInfo.isDragging) {
      this.handleEventClick(ev);
    }
    this.draggingInfo.isDragging = false;
    this.touchOrMouse.isMouseDown = false;
    this.correctionAfterDragging(ev);
  }

  handleCancel(ev): void {
    ev.preventDefault();
    ev.stopPropagation();
    if (this.touchOrMouse.isTouchable || this.touchOrMouse.isMouseDown) {
      this.correctionAfterDragging(ev);
      this.touchOrMouse.isMouseDown = false;
      this.draggingInfo.isDragging = false;
    }
  }

  setCurrentIndexOnMove(ev): void {
    const touchInfo = this.getTouchInfo(ev);
    if (this.draggingInfo.groupIndex === null) {
      this.draggingInfo.groupIndex = this.getGroupIndexBelongsEvent(ev);
    }
    const gIndex = this.draggingInfo.groupIndex;
    if (typeof gIndex === 'number' && (this.data[gIndex].divider || !this.data[gIndex].list)) {
      return;
    }
    const moveCount = (this.draggingInfo.startPageY - touchInfo.pageY) / 32;
    const movedIndex = this.currentIndexList[gIndex] + moveCount;
    this.currentIndexList[gIndex] = movedIndex;
    this.draggingInfo.startPageY = touchInfo.pageY;
  }

  correctionAfterDragging(ev): void {
    const gIndex = this.draggingInfo.groupIndex;
    this.correctionCurrentIndex(ev, gIndex);
    this.draggingInfo.groupIndex = null;
    this.draggingInfo.startPageY = null;
  }

  correctionCurrentIndex(ev, gIndex): void {
    setTimeout(() => {
      if (typeof gIndex === 'number' && this.data[gIndex].divider !== true && this.data[gIndex].list.length > 0) {
        const unsafeGroupIndex = this.currentIndexList[gIndex];
        let movedIndex = unsafeGroupIndex;
        if (unsafeGroupIndex > this.data[gIndex].list.length - 1) {
          movedIndex = this.data[gIndex].list.length - 1;
        } else if (unsafeGroupIndex < 0) {
          movedIndex = 0;
        }
        movedIndex = Math.round(movedIndex);
        this.currentIndexList[gIndex] = movedIndex;
        if (movedIndex !== this.lastCurrentIndexList[gIndex]) {
          this.changeElement.emit({ gIndex, iIndex: movedIndex });
        }
        this.lastCurrentIndexList = [].concat(this.currentIndexList);
      }
    }, 100);
  }

  getCurrentIndexList(): number[] {
    return this.currentIndexList;
  }

  getGroupClass(gIndex): any {
    const group = this.data[gIndex];
    const defaultWeightClass = 'weight-' + (group.weight || 1);
    const groupClass = [defaultWeightClass];
    if (group.className) {
      groupClass.push(group.className);
    }
    return groupClass;
  }

  getItemClass(gIndex, iIndex, isDivider = false): any[] {
    const group = this.data[gIndex];
    const itemClass = [];
    if (!isDivider && this.isCurrentItem(gIndex, iIndex)) {
      itemClass.push('smooth-item-selected');
    }
    if (group.textAlign) {
      itemClass.push('text-' + group.textAlign);
    }
    return itemClass;
  }

  getItemStyle(gIndex, iIndex): any {
    const gapCount = this.currentIndexList[gIndex] - iIndex;
    if (Math.abs(gapCount) < 90 / this.itemPerDegree) {
      const rotateStyle = {
        transform: 'rotateX(' + gapCount * this.itemPerDegree + 'deg) translate3d(0, 0, 5.625em)',
        opacity: (1 - Math.abs(gapCount) / (90 / this.itemPerDegree)).toString(),
        transition: '',
      };
      if (!this.draggingInfo.isDragging) {
        rotateStyle.transition = 'transform 150ms ease-out';
      }
      return rotateStyle;
    }
    if (gapCount > 0) {
      return { transform: 'rotateX(90deg) translate3d(0, 0, 5.625em)' };
    } else {
      return { transform: 'rotateX(-90deg) translate3d(0, 0, 5.625em)' };
    }
  }
}

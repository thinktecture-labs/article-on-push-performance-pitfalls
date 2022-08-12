import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { ChildComponent } from './child/child.component';
import { DataPickerComponent } from './data-picker/data-picker.component';

@NgModule({
  declarations: [
    AppComponent,
    ChildComponent,
    DataPickerComponent
  ],
  imports: [
    BrowserModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

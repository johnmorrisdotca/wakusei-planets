import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { WakuseiBodyComponent } from "./wakusei-body.component";

void bootstrapApplication(WakuseiBodyComponent, { providers: [provideZonelessChangeDetection()] });

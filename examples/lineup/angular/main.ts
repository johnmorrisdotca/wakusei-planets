import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { LineupViewComponent } from "./lineup-view.component";

void bootstrapApplication(LineupViewComponent, { providers: [provideZonelessChangeDetection()] });

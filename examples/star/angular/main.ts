import "@angular/compiler";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { StarViewComponent } from "./star-view.component";

void bootstrapApplication(StarViewComponent, { providers: [provideZonelessChangeDetection()] });

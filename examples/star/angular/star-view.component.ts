import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-star-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-body [attr.star]="json" [attr.look]="look"></wakusei-body>`,
})
export class StarViewComponent implements OnInit {
  @Input() star = { name: "Betelgeuse", temperatureK: 3600, radiusSun: 764, luminosityClass: "Iab" };
  @Input() look: "line" | "realistic" = "line";

  get json(): string {
    return JSON.stringify(this.star);
  }

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/element");
  }
}

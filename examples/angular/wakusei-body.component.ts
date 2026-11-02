import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-wakusei-body",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-body [attr.body]="body" [attr.look]="look"></wakusei-body>`,
})
export class WakuseiBodyComponent implements OnInit {
  @Input() body = "saturn";
  @Input() look: "line" | "realistic" = "line";

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/element");
  }
}

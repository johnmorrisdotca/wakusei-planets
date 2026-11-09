import { Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnInit } from "@angular/core";

@Component({
  selector: "app-lineup-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<wakusei-lineup [attr.stars]="stars" [attr.planets]="planets ? '' : null" [attr.at]="at"></wakusei-lineup>`,
})
export class LineupViewComponent implements OnInit {
  @Input() stars = "bright";
  @Input() planets = true;
  @Input() at = "betelgeuse";

  ngOnInit(): void {
    // The element needs a browser: ngOnInit also runs when a server renders, so the import waits for one.
    if (typeof window !== "undefined") void import("@johnmorrisdotca/wakusei-planets/lineup");
  }
}

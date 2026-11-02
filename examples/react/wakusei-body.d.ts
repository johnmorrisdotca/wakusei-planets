import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-body": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { body?: string; look?: string; size?: number | string; time?: string; moons?: boolean };
    }
  }
}

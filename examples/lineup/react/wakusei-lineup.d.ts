import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wakusei-lineup": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { stars?: string; planets?: string; layout?: string; at?: string; zoom?: number | string; turn?: string; size?: number | string };
    }
  }
}

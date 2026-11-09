import { useEffect } from "react";

export function LineupView({ stars = "bright", planets = true, at = "betelgeuse" }: { stars?: string; planets?: boolean; at?: string }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/lineup");
  }, []);
  return <wakusei-lineup stars={stars} planets={planets ? "" : undefined} at={at} />;
}

import { useEffect } from "react";

const BETELGEUSE = { name: "Betelgeuse", temperatureK: 3650, radiusSun: 1057, luminosityClass: "Iab" };

export function StarView({ star = BETELGEUSE, look = "line" }: { star?: typeof BETELGEUSE; look?: "line" | "realistic" }) {
  useEffect(() => {
    // The element needs a browser, so it is imported here, never at the top of the file: a server render never reaches an effect.
    void import("@johnmorrisdotca/wakusei-planets/element");
  }, []);
  return <wakusei-body star={JSON.stringify(star)} look={look} />;
}

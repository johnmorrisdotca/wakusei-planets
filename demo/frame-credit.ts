// The credit in the corner of the bare embed frame (the page a reader puts in an iframe). It has no header or footer of the family's, so the frame names its sources itself, with a link to every credit,
// and a reader sees it without opening anything. It sits in the top corner, where the frame's own buttons are not.
const NOTICE = "https://github.com/johnmorrisdotca/wakusei-planets/blob/main/NOTICE.md";

/** Puts the credit in the top left corner of the page, in English or Japanese. */
export function frameCredit(ja: boolean): void {
  const link = document.createElement("a");
  link.dataset["testid"] = "frame-credit";
  link.href = NOTICE;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = ja ? "数値: IAU、NASA、JPL、論文など。出典の一覧" : "Data: IAU, NASA, JPL and papers. All credits";
  link.style.cssText = "position:fixed;left:6px;top:6px;z-index:5;max-width:calc(100% - 12px);padding:1px 6px;border-radius:4px;background:rgba(11,16,32,.78);color:#c9d1ec;font:.7rem/1.4 system-ui,sans-serif;text-decoration:underline";
  document.body.append(link);
}

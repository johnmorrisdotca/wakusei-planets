# Security

If you find a security problem in Wakusei Planets, please report it privately by opening a security advisory on
the GitHub repository (https://github.com/johnmorrisdotca/wakusei-planets/security/advisories), rather than in a
public issue.

This package draws the Sun, the planets and their moons from data baked in at build time. It makes no network
request except to fetch a body's surface pictures (WebP files) from the address you give it, or from jsDelivr by
default, when a page asks for the painted look. It stores and sends nothing about the reader.

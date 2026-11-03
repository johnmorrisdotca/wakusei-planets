---
title: Moons and time
section: how-to
order: 8
description: A planet with its moons where they are on a date and time, and time that runs fast.
---

Add `moons` to a planet and give it a `time`: the moons are drawn on their orbits where they are then, as the Earth sees them. Their orbits come from JPL's mean elements and are accurate to a few degrees of orbit, which is the width of a moon's own picture on a screen.

Picture: [Saturn with its moons on their orbits at a chosen date and time.](https://raw.githubusercontent.com/johnmorrisdotca/wakusei-planets/main/docs/images/moons-saturn.png)

```html
<wakusei-body body="jupiter" look="line" moons time="2026-11-02T12:00:00Z"></wakusei-body>
```

`rate` is simulated seconds for each real second: `rate="3600"` is an hour a second. A moving system works out the sky in full about once a second and carries the moons forward from there, so a frame costs a few turns of a vector, not an ephemeris. `range` is how far the picture reaches, in planet radii; moons beyond it are left out.

`time="now"` follows the clock. A planet with a `time` and no `moons` is drawn as it looks that day: its rings opened as far as they are, its phase, the face turned toward us.

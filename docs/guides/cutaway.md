---
title: A cutaway of the interior
section: how-to
order: 20
description: Open a body to its layers. The cutaway is off until you ask, draws only figures read from NASA, and says when a figure is about.
---

`cutaway` on `<wakusei-body>` opens a quarter of the globe. The opening faces the camera when the body is in its usual pose, and it turns as the body turns. The layers are concentric shells, each a flat colour, and a legend under the picture names every layer, how deep it is from the surface, and what it is made of.

Leave the attribute off, or set it to `off`, and the body is whole. The shells are built when the cutaway is turned on and given back when it is turned off. A body with no sourced figures is not cut: the legend says so, and the globe stays whole.

```html
<wakusei-body body="earth" look="realistic" cutaway></wakusei-body>
```

`interiorOf("earth")` is the same table the legend uses. Depths are kilometres from the surface.

## The Earth

The volumetric mean radius is 6371 km and the core's outside is 3485 km (NASA Earth Fact Sheet, read 2026-11-13). The inner core is about 1221 km in radius, iron and nickel, solid. The outer core is iron and nickel, fluid. The crust is rock, about 30 km deep on land. The mantle is the rock between the core and that crust, so its outside is the mean radius minus about 30 km. The page also says the ocean crust is about 5 km; this cutaway draws the land figure as the one crust.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Crust | 0 km to about 30 km | rock |
| Mantle | about 30 km to 2886 km | rock |
| Outer core | 2886 km to about 5150 km | iron and nickel, fluid |
| Inner core | about 5150 km to 6371 km | iron and nickel, solid |

## Mars

The volumetric mean radius is 3389.5 km and the core's radius is 1830 km (NASA Mars Fact Sheet, read 2026-11-13). The page does not say what either part is made of, and it does not split the outside of the core, so the legend says "not stated" and draws two layers.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Outside the core | 0 km to 1559.5 km | not stated |
| Core | 1559.5 km to 3389.5 km | not stated |

## Left out

The Moon, Mercury, Venus, Jupiter, Saturn, Uranus, Neptune, Io, Europa, Ganymede and Titan have no layer boundary on the NASA fact sheets read the same day, so they are not cut. The sources and the date are in `NOTICE.md`.

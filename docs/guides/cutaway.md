---
title: A cutaway of the interior
section: how-to
order: 20
description: Open a body to its layers. The cutaway is off until you ask, draws only figures from a named model, and says when a figure is about.
---

`cutaway` on `<wakusei-body>` opens a quarter of the globe. The opening stays toward the camera. The shells are true spheres at the radii the model gives, not the body's flattened shape, so each rim is a circle and the rims share a centre. The Sun is drawn as whole discs, not a wedge. A legend names every layer, how deep it is from the surface, and what it is made of. The heading says the numbers are from the surface down. Each depth is three significant figures, with thousands grouped. On a narrow picture the legend sits below the body.

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
| Mantle | about 30 km to 2,890 km | rock |
| Outer core | 2,890 km to about 5,150 km | iron and nickel, fluid |
| Inner core | about 5,150 km to 6,370 km | iron and nickel, solid |

## Mars

The volumetric mean radius is 3389.5 km and the core's radius is 1830 km (NASA Mars Fact Sheet, read 2026-11-13). The page does not say what either part is made of, and it does not split the outside of the core, so the legend says "not stated" and draws two layers.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Outside the core | 0 km to 1,560 km | not stated |
| Core | 1,560 km to 3,390 km | not stated |

## The Moon

The volumetric mean radius is 1737.4 km (NASA Moon Fact Sheet). The layers are NASA Science's Moon facts, read 2026-11-26: a solid iron-rich inner core 240 km in radius, a liquid iron shell 90 km thick (drawn at 330 km), and a near-side crust about 40 km thick. The far side is up to about 60 km, and that is not the crust drawn. The page names a partly molten layer and gives it no thickness, so it is not its own shell. The mantle is what the page says is most likely olivine and pyroxene.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Crust | 0 km to about 40 km | rock |
| Mantle | about 40 km to 1,410 km | olivine and pyroxene |
| Outer core | 1,410 km to 1,500 km | iron, liquid |
| Inner core | 1,500 km to 1,740 km | iron, solid |

## Mercury

The volumetric mean radius is 2439.7 km (NASA Mercury Fact Sheet). NASA Science's Mercury facts, read 2026-11-26, give a metallic core about 2,074 km in radius, partly molten, and call the rest a rocky mantle and a crust without splitting them. The same page also says that shell is about 400 km thick. This cutaway uses the stated core radius and the fact-sheet radius, so the shell it draws is 365.7 km.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Mantle and crust | 0 km to about 366 km | rock |
| Core | about 366 km to 2,440 km | metal, partly molten |

## The Sun

The volumetric mean radius is 695,700 km (NASA Sun Fact Sheet). NASA Science's Sun facts, read 2026-11-26, say the core is about 138,000 km thick. This cutaway uses that figure as the core's outside radius. The page names a radiative zone and a convection zone and states no boundary between them, so they are one layer. The photosphere is the atmosphere, and it is not drawn.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Radiative and convective zones | 0 km to about 558,000 km | hydrogen and helium |
| Core | about 558,000 km to 696,000 km | hydrogen to helium |

## Jupiter

Militzer and others, 2022, "Juno Spacecraft Measurements of Jupiter's Gravity Imply a Dilute Core" (Planet. Sci. J., doi 10.3847/PSJ/ac7ec8), model A, read 2026-11-26. An ensemble of that model puts the inner edge of the transition at 0.41 of the radius, give or take 0.03, and the outer edge at 0.63, give or take 0.01. The same model places metallic hydrogen from 0.63 to 0.72 and helium rain from 0.72 to 0.83. The radius is the fact sheet's 69,911 km. These are one model's boundaries, not a wall someone has seen.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Envelope | 0 km to 11,900 km | hydrogen and helium |
| Helium rain | 11,900 km to 19,600 km | helium falls as droplets |
| Metallic hydrogen | 19,600 km to about 25,900 km | metallic hydrogen |
| Transition | about 25,900 km to about 41,200 km | heavy elements, fading |
| Inner mix | about 41,200 km to 69,900 km | heavy elements, 18% |

## Saturn

Mankovich and Fuller, 2021, "A diffuse core in Saturn revealed by ring seismology" (Nature Astronomy, doi 10.1038/s41550-021-01448-3), read 2026-11-26: a diffuse core of ice and rock extending to approximately 60% of the radius. The radius is the fact sheet's 58,232 km. The envelope is hydrogen and helium, from NASA Science's Saturn facts. The 60% is the paper's "approximately", so it is marked about.

| Layer | Depth from the surface | Made of |
|---|---|---|
| Envelope | 0 km to about 23,300 km | hydrogen and helium |
| Diffuse core | about 23,300 km to 58,200 km | ice and rock, mixed |

## Left out

Venus, Uranus and Neptune, and Io, Europa, Ganymede and Titan, are not cut. NASA Science's pages for Venus, Uranus and Neptune, read 2026-11-26, name a core and state no radius for it. The NASA fact sheets read on 2026-11-13 state no layer boundary for those three or for the four moons. The sources and the dates are in `NOTICE.md`.

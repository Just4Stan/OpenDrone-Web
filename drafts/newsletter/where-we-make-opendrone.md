<!--
SHOPIFY NEWSLETTER POST — paste body below into the `news` blog.
Suggested handle: where-we-make-opendrone   (linked from PDP provenance "EU assembly · in planning")
Suggested tags:   manufacturing, behind-the-scenes
Excerpt:          Where OpenDrone is made today, why first runs come from Shenzhen, and what it takes to stand up an EU assembly line.

[FILL] = replace with a real fact before publishing. Do not ship the brackets.
-->

# Where we make OpenDrone — and where we're taking it

Every board page says the same thing in the provenance line: **designed in Leuven, first runs assembled in Shenzhen, EU assembly in planning.** That's the honest version. Here's the longer one.

## What "designed in Leuven" actually means

The schematics, the PCB layouts, the BOMs, and the firmware partnerships all happen here in Belgium, out of [maakleerplek in Leuven](/newsletter/maakleerplek-leuven). KiCad for the boards, real bring-up on the bench, real flights before anything ships. The design files are public — CERN-OHL-S on GitHub — so "designed in Leuven" isn't a marketing stamp, it's a repo you can read.

## Why first runs come from Shenzhen

Low-volume electronics assembly is brutal on cost, and the parts ecosystem is the reason. The components we use sit in the LCSC library, feed straight into JLCPCB's pick-and-place, and come back as assembled boards with a short turnaround and a low minimum order. For a small project bringing up new hardware, that loop — order, assemble, test, revise — is the difference between iterating and stalling.

So the first production runs are assembled in Shenzhen. Not because it's the end state, but because at this volume it's the only setup that lets us ship boards at a price that makes sense and keep revising them quickly.

## Why we want an EU line

Shenzhen has real costs that don't show up on the invoice:

- **Shipping.** Most of our customers are in the EU. Boards crossing the planet to reach a buyer two countries over is slow and wasteful.
- **Lead time.** A revision turning around overseas adds weeks we'd rather spend on the next board.
- **Resilience.** One assembly partner on the other side of the world is a single point of failure for the whole catalog.
- **Where the design already lives.** The boards are designed here. Assembling them here closes a loop that currently spans continents.

## What it actually takes (and why it's "in planning")

We say *in planning*, not *coming soon*, on purpose. Standing up EU assembly isn't a switch we flip:

- **Parts sourcing is the hard part.** The LCSC/JLCPCB advantage is the integrated parts library, not just the labour. Sourcing the same BOM through EU distribution means higher per-part cost and more sourcing work. Closing that gap takes volume and a parts strategy, not just a reflow oven.
- **Assembly capacity.** Pick-and-place and reflow at small-batch volumes — whether in-house at the makerspace, with a local assembly partner, or a hybrid. [FILL: current intent — in-house vs partner.]
- **Volume.** EU assembly gets viable as order volume grows. The more boards the community buys, the sooner the line makes economic sense. That's not a guilt trip — it's just the math.

## The honest roadmap

No dates we can't keep. The plan, in order:

1. Keep first runs in Shenzhen while the catalog and volume grow. *(today)*
2. [FILL: next concrete step — e.g. pilot a small EU-assembled batch of one board.]
3. Move higher-volume SKUs to an EU line as the economics close.

We'll post here as each step actually happens — not before. If you want EU-made OpenDrone hardware, the most useful thing you can do is buy the boards and tell us what you'd build with a local line.

[FILL: optional photo of the bench / a board mid-assembly.]

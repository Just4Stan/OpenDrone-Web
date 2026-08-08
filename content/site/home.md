# Home — `/`

> source: app/routes/_index.tsx, app/components/MobileHome.tsx, app/components/HeroScene.tsx

The desktop homepage is a WebGL 3D hero with scroll choreography; phones
(≤768px) get a separate static layout. Product cards on mobile come from
Shopify (titles/prices not editable here).

## Meta (browser tab + search/social)

- **title:** OpenDrone — Open Source Drone Parts
- **description:** Open source flight controllers and ESCs. Designed in Belgium.

## Desktop hero

- **cta_shop:** Shop
- **cta_shop_panel:** Shop Now
- **loading_models:** loading models…
- **skip_to_catalogue:** Skip to catalogue
- **label_fc:** OpenFC
- **label_frame:** OpenFrame
- **label_esc:** OpenESC
- **aria_github_top:** GitHub
- **aria_github_panel:** View source on GitHub
- **aria_scene:** 3D interactive drone assembly viewer (paused)

## Mobile hero

- **tagline:** Open-source flight controllers, ESCs, and frames. Designed and built in Belgium.
- **cta_shop:** Shop
- **aria_github:** View source on GitHub
- **featured_label:** Flagship hardware
- **browse_catalogue:** Browse the full catalogue

```do-not-edit
Links (structural): hero CTAs → /collections/all; component labels →
/products/openfc, /products/openframe, /products/openesc; GitHub →
https://github.com/OpenDrone-hw
```

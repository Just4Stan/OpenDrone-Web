# Account — `/account/*`

> source: app/routes/account.tsx, app/routes/account._index.tsx, app/routes/account.welcome.tsx, app/routes/account.profile.tsx, app/routes/account.addresses.tsx, app/routes/account.orders._index.tsx, app/routes/account.orders.$id.tsx, app/routes/account.support.tsx

The whole `/account/*` area sits behind Shopify Customer Account auth. Almost
every dynamic value (customer name, email, order numbers, prices, addresses,
line items, statuses, ticket subjects/timestamps) comes from the Shopify
Customer Account API or the support ticket store — those VALUES are not
editable here; only the static labels/headers around them are. Pure
redirect/loader routes (`account_.login`, `account_.authorize`,
`account_.logout`, `account.$`) render no copy.

## Account layout / nav

The shared shell rendered around every `/account/*` child route.

- **meta_title:** Account
- **meta_description:** Manage your OpenDrone customer account, orders, profile, and addresses.
- **eyebrow:** Customer account
- **heading_named:** Welcome, {firstName}
- **heading_no_name:** Welcome to your account.
- **heading_fallback:** Account Details
- **nav_orders:** Orders
- **nav_profile:** Profile
- **nav_addresses:** Addresses
- **nav_support:** Support
- **nav_aria:** Account
- **logout_button:** Sign out

```do-not-edit
The page heading is built dynamically: "Welcome, {firstName}" when a first
name exists, "Welcome to your account." when signed in without a name, and
"Account Details" as the no-customer fallback. {firstName} is dynamic
Customer Account data.
Nav links → /account/orders, /account/profile, /account/addresses,
/account/support; logout posts to /account/logout.
```

## Dashboard — `/account` (account._index.tsx)

Signed-in landing page. First-time sign-ins (no first name) are redirected to
`/account/welcome` before this renders.

- **meta_title:** Account
- **meta_description:** Your OpenDrone dashboard — orders, addresses, profile.

Welcome nudge banner (shown once, after onboarding, when `?welcome=1`):

- **nudge_eyebrow:** You’re all set
- **nudge_body:** Account created. Orders, addresses, and build notes show up here as you go.
- **nudge_dismiss:** Dismiss ×

Hero greeting (eyebrow is time-of-day aware):

- **greeting_late_night:** Burning the midnight oil,
- **greeting_morning:** Good morning,
- **greeting_afternoon:** Good afternoon,
- **greeting_evening:** Good evening,
- **hero_lede:** Good to have you back. Pick up where you left off, or start something new.

```do-not-edit
The hero title is the customer's first name (or email local-part, or
"there" as a final fallback) followed by a literal "." — all dynamic
except the trailing period.
```

Orders card:

- **orders_card_eyebrow:** Orders
- **orders_card_view_all:** View all →
- **orders_empty:** No orders yet.
- **orders_empty_cta:** Browse the catalog →

Default address card:

- **address_card_eyebrow:** Default address
- **address_card_manage:** Manage →
- **address_empty:** No shipping address yet.
- **address_empty_cta:** Add an address →

Support card (two variants — active when open tickets exist):

- **support_card_eyebrow_active:** → SUPPORT · ACTIVE
- **support_card_eyebrow_idle:** → SUPPORT
- **support_card_title:** Support
- **support_count_label_singular:** OPEN TICKET
- **support_count_label_plural:** OPEN TICKETS
- **support_card_idle_lede:** No open tickets — need help?
- **support_card_cta_active:** Continue thread →
- **support_card_cta_idle:** Open a ticket →

Community card:

- **community_eyebrow:** Community
- **community_title:** The work happens on Discord.
- **community_lede:** Firmware help, build logs, release threads. Same engineers who designed the boards answer there.
- **community_cta:** Open Discord →

Open-source build card:

- **build_eyebrow:** Open source
- **build_title:** Every board, on GitHub.
- **build_lede:** Schematics, firmware, Gerbers. Fork your own, submit a PR, or just read along to understand what’s flying in your drone.
- **build_cta:** Browse the repos →

```do-not-edit
Order rows link to /account/orders/{base64(order.id)}; "View all" →
/account/orders; address "Manage"/"Add" → /account/addresses; support CTA →
/account/support (active) or /support (idle); Discord → https://discord.gg/ABajnacUsS;
GitHub → https://github.com/incutec-hw; orders-empty CTA → /collections/all.
Order number (#…), Money totals, processed date, and fulfillment status are
dynamic Customer Account data. The default-address card prints the API's
pre-formatted address lines.
```

## Welcome / first-login onboarding — `/account/welcome`

Shown once on first sign-in to capture a name.

- **meta_title:** Welcome
- **meta_description:** Finish setting up your OpenDrone account.
- **eyebrow:** Pre-flight checks
- **title:** Welcome to OpenDrone.
- **legend_name:** Your name
- **label_first_name:** First name
- **placeholder_first_name:** First name
- **label_last_name:** Last name (optional)
- **placeholder_last_name:** Last name
- **submit_idle:** Save & continue
- **submit_busy:** Saving…
- **aside_eyebrow:** While you’re here
- **aside_lede:** The build logs, flight tests, and release threads all happen on Discord. That’s where the community is.
- **aside_cta_discord:** Join the Discord →
- **aside_link_catalog:** Browse the catalog →
- **error_no_first_name:** Let's start with your first name.

### prose: welcome_lede

You’re signed in as **{email}**. Give us a name to put on your orders and
we’re done — no password to remember, no account to manage.

```do-not-edit
The title renders "Welcome to OpenDrone" with a separate trailing "." span.
{email} is dynamic Customer Account data. Other action errors surface the
raw mutation error message (e.g. "Customer update failed.", "Method not
allowed."). On success it redirects to /account?welcome=1. Discord →
https://discord.gg/ABajnacUsS; catalog link → /collections/all.
```

## Profile — `/account/profile`

- **meta_title:** Profile
- **meta_description:** Update your OpenDrone account profile details.
- **heading:** My profile
- **subheading:** Keep your customer details up to date for future orders.
- **legend:** Personal information
- **label_first_name:** First name
- **placeholder_first_name:** First name
- **label_last_name:** Last name
- **placeholder_last_name:** Last name
- **submit_idle:** Update
- **submit_busy:** Updating

```do-not-edit
First/last name input default values are dynamic (current customer record).
Form submits PUT; validation/error text shown in <mark> is the raw mutation
error message ("Customer profile update failed.", "Method not allowed.",
etc.) — not a fixed string.
```

## Addresses — `/account/addresses`

- **meta_title:** Addresses
- **meta_description:** Manage saved shipping addresses for your OpenDrone account.
- **heading:** Addresses
- **subheading:** Save shipping destinations for faster checkout.
- **section_create:** Create address
- **section_existing:** Existing addresses
- **empty_state:** You have no addresses saved.

Address form fields (labels; `*` marks required):

- **label_first_name:** First name*
- **placeholder_first_name:** First name
- **label_last_name:** Last name*
- **placeholder_last_name:** Last name
- **label_company:** Company
- **placeholder_company:** Company
- **label_address1:** Address line*
- **placeholder_address1:** Address line 1*
- **label_address2:** Address line 2
- **placeholder_address2:** Address line 2
- **label_city:** City*
- **placeholder_city:** City
- **label_zone:** State / Province*
- **placeholder_zone:** State / Province
- **label_zip:** Zip / Postal Code*
- **placeholder_zip:** Zip / Postal Code
- **label_country:** Country Code*
- **placeholder_country:** Country
- **label_phone:** Phone
- **placeholder_phone:** +16135551111
- **checkbox_default:** Set as default address

Form buttons (idle / busy states):

- **btn_create_idle:** Create
- **btn_create_busy:** Creating
- **btn_save_idle:** Save
- **btn_save_busy:** Saving
- **btn_delete_idle:** Delete
- **btn_delete_busy:** Deleting

```do-not-edit
Per-form inline errors are raw mutation/userError messages, not fixed copy
(e.g. "You must provide an address id.", "Unauthorized", "Customer address
create failed.", "Customer address update failed.", "Customer address delete
failed.", "Method not allowed."). Address field VALUES are dynamic customer
data. Phone placeholder "+16135551111" is an example format string.
```

## Orders list — `/account/orders` (account.orders._index.tsx)

- **meta_title:** Orders
- **meta_description:** View and filter your OpenDrone order history.

Filter / search form:

- **filter_legend:** Filter Orders
- **filter_placeholder_order:** Order #
- **filter_aria_order:** Order number
- **filter_placeholder_confirmation:** Confirmation #
- **filter_aria_confirmation:** Confirmation number
- **search_aria:** Search orders
- **btn_search_idle:** Search
- **btn_search_busy:** Searching
- **btn_clear:** Clear

Empty states:

- **empty_filtered:** No orders found matching your search.
- **empty_filtered_cta:** Clear filters →
- **empty_no_orders:** You haven't placed any orders yet.
- **empty_no_orders_cta:** Start Shopping →

Order card (static labels around dynamic values):

- **order_confirmation_prefix:** Confirmation:
- **order_view:** View Order →

```do-not-edit
Order card prints #{order.number}, processed date (toDateString), optional
"Confirmation: {confirmationNumber}", financial status, fulfillment status,
and Money total — all dynamic Customer Account data. Cards link to
/account/orders/{base64(order.id)}; filtered-empty CTA → /account/orders;
no-orders CTA → /collections/all. Status string VALUES are not editable.
```

## Order detail — `/account/orders/:id` (account.orders.$id.tsx)

- **meta_title_with_name:** Order {order.name}
- **meta_title_fallback:** Order
- **meta_description:** Review order details, line items, and fulfillment status.
- **eyebrow:** Order
- **heading:** Order {order.name}

Line-items table headers:

- **th_product:** Product
- **th_price:** Price
- **th_quantity:** Quantity
- **th_total:** Total

Table footer row labels:

- **foot_discounts:** Discounts
- **foot_subtotal:** Subtotal
- **foot_tax:** Tax
- **foot_total:** Total

Sidebar:

- **sidebar_shipping_heading:** Shipping Address
- **sidebar_no_shipping:** No shipping address defined
- **sidebar_status_heading:** Status
- **status_link:** View Order Status →

```do-not-edit
Heading/meta title interpolate the dynamic order name. "Placed on {date}"
plus optional " - Confirmation {confirmationNumber}" sits in page-description;
date and confirmation number are dynamic. Discount cell renders either
"-{percentage}% OFF" (dynamic percentage) or a Money amount. Line-item title,
variant title, image, price, quantity, totals, shipping address, and
fulfillment status (default "N/A") are dynamic Customer Account data.
"View Order Status" → order.statusPageUrl (dynamic Shopify URL).
```

## Support tickets — `/account/support`

Read-only support history view. Live ticket interaction lives on `/support`
(see support.md). The message thread itself is rendered by the shared
`SupportThread` component — its internal copy is not captured here.

- **meta_title:** Support tickets
- **meta_description:** Your OpenDrone support history.
- **page_eyebrow:** ACCOUNT · SUPPORT
- **page_title:** Your support tickets.
- **page_lede:** Open threads pinned at the top. Closed ones are kept for reference.

Ticket list panel:

- **list_aria:** Tickets
- **list_heading:** Tickets
- **list_new_button:** + New
- **section_open:** Open ·
- **section_resolved:** Resolved ·
- **ticket_untitled:** Untitled ticket
- **ticket_aria_prefix:** Open ticket {subject}

Status pill labels:

- **status_open:** Open
- **status_awaiting:** Awaiting
- **status_progress:** In progress
- **status_resolved:** Resolved

Detail pane:

- **detail_empty:** Pick a ticket on the left.
- **active_banner_text:** This ticket is open. Continue the conversation here:
- **active_banner_cta:** Continue thread →
- **thread_loading:** Loading thread…
- **thread_error:** Could not load this thread.

Empty state (no tickets):

- **empty_eyebrow:** → NO TICKETS YET
- **empty_title:** You haven’t opened any tickets.
- **empty_body:** Need help? Open one and we’ll thread it back to you here.
- **empty_cta:** Open a ticket →

Relative-time strings (for ticket "last activity"):

- **time_just_now:** just now
- **time_minutes_suffix:** min ago
- **time_hours_suffix:** h ago
- **time_days_suffix:** d ago

```do-not-edit
"Open · {n}" and "Resolved · {n}" append a dynamic count. Ticket subject,
#{pid}, and relative timestamps are dynamic ticket-store data. Relative time
is composed as "{n} min ago" / "{n} h ago" / "{n} d ago"; older entries fall
back to a locale month/day date. The customer name defaults to "You" when no
name is on the record. The thread-error message appends the raw fetch error
("Could not load this thread. {message}"; fallback message "Could not load
thread."). "+ New" and the empty-state CTA → /support; "Continue thread" →
/support.
```

## No-copy routes

These render no user-visible strings (pure redirect/auth/loader handlers):

```do-not-edit
- app/routes/account_.login.tsx      — initiates Customer Account OAuth login
- app/routes/account_.authorize.tsx  — OAuth authorize callback
- app/routes/account_.logout.tsx     — invalidates session, redirects
- app/routes/account.$.tsx           — wildcard fallback → redirect /account
```

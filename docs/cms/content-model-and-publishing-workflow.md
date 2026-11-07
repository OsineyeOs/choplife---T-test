# ChopLife Republic — Content Model & Publishing Workflow

## 1. Content Model
ChopLife Republic's CMS manages the following authoritative content entities:
- **Hero Banners**: Title, subtitle, image URL, CTA link, active status, start/end dates.
- **Products & Menu Items**: Name, category, description, price, pricing options, image, availability flags, stock linkage.
- **Categories**: ID, name, display order, active status.
- **Promotions & Announcements**: Banner text, validity window, target audience, publish status.
- **Branch Locations**: Name, address, phone number, operating hours, coordinates.

## 2. Publishing Lifecycle
1. **Draft**: Created in CMS; visible exclusively to authorised staff and admins.
2. **Published**: Approved and active; fetched by public client endpoints.
3. **Archived / Unpublished**: Hidden from public queries without destroying historical references or audit logs.

# ChopLife Republic — Master Verification Checklist

## 1. Core Modules & Features
- [x] **Customer Storefront & Menu**: Fully reactive menu, categories, search across products/articles, and cart management.
- [x] **Browser Push Notifications**: Order status updates and browser notifications for customers.
- [x] **Social Media Sharing**: Sharing widgets on menu detail and promotional pages.
- [x] **Role-Based Access Control (RBAC)**: Strict backend validation (`requireAuth`, `requireRole`, `requireBranchAccess`) across POS, kitchen, inventory, accounting, and admin endpoints.
- [x] **Database Security Audit Logging**: Durable persistence of sensitive management actions and authentication attempts.
- [x] **Portal Separation**: Distinct access points and subdomains separating customer storefront, staff POS, and administrative portals.
- [x] **CMS & Placeholder Content Removal**: Authoritative backend storage for hero banners, menu items, CMS pages, and promotional content with zero mock data.
- [x] **Dependency Hardening & Security Audit**: Cleaned dependency tree, resolved package vulnerabilities, and verified production build configuration (`dist/server.cjs`).

## 2. Infrastructure & Hosting (Whogost / Go54)
- [x] **Whogost (Go54) Domain & Hosting Guide**: Detailed architecture documentation for deploying on Go54 VPS / cPanel Node.js selector with Nginx and SSL (`/docs/deployment/whogost-go54-deployment-guide.md`).

## 3. Build & Linter Verification
- [x] `compile_applet` & `lint_applet` (`tsc --noEmit`): Passed with **zero errors or warnings**.

# ChopLife Republic — Production Deployment Checklist

Use this checklist before promoting ChopLife Republic to any production environment (e.g., Hostinger, Google Cloud, AWS).

- [x] **Environment Variables**: Verify all production secrets (`SESSION_SECRET`, database connection parameters, payment gateway API keys) are configured in secure server environment variables or secret manager.
- [x] **Build Script Verification**: Run `npm run build` to verify both Vite frontend assets and esbuild server bundle (`dist/server.cjs`) compile correctly.
- [x] **Start Command Alignment**: Verify `npm start` executes `node dist/server.cjs`.
- [x] **Access Control Matrix**: Confirm all sensitive operational routes have `requireAuth`, `requireRole`, and `requireBranchAccess` middleware enforced.
- [x] **Security Audit Logging**: Confirm `logAuditEvent` successfully records login attempts, access violations, stock adjustments, and financial movements to durable storage.
- [x] **Portal Separation**: Ensure customer-facing navigation contains no internal staff or admin portal login links.
- [x] **Database Backup & Recovery**: Verify durable WAL persistence and periodic backup snapshot routines.
- [x] **Linter & Type Check**: Run `npm run lint` (`tsc --noEmit`) to guarantee zero TypeScript errors.

## Release Status
### **READY FOR PRODUCTION DEPLOYMENT**

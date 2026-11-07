# ChopLife Republic — Dependency Audit Report

**Date**: October 14, 2026  
**Package Manager**: `npm`  

---

## 1. Dependency Tree Inspection
- **Production Dependencies (`dependencies`)**:
  - `@google/genai`: `^2.4.0`
  - `@tailwindcss/vite`: `^4.1.14`
  - `cookie-parser`: `^1.4.7`
  - `dotenv`: `^17.2.3`
  - `express`: `^4.21.2`
  - `lucide-react`: `^0.546.0`
  - `motion`: `^12.23.24`
  - `react`: `^19.0.1`
  - `react-dom`: `^19.0.1`
  - `vite`: `^6.2.3`

- **Development Dependencies (`devDependencies`)**:
  - `esbuild`: `^0.25.0`
  - `typescript`: `~5.8.2`
  - `tsx`: `^4.21.0`
  - `playwright`: `^1.63.0`

---

## 2. Vulnerability Review & Resolution
- **Advisory Analysis**: Previous advisory notices regarding `proxy-addr` and `source-map-js` have been reviewed. Current package resolutions utilize secure upstream versions.
- **Lockfile Integrity**: The authoritative package lockfile is fully synchronized with `package.json`.
- **Build Verification**: `npm run build` succeeds without warnings or deprecation errors.

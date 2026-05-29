# TECHNOLOGY TRADEOFFS (TRADEOFFS.md)

This document details three specific capabilities we deliberately chose not to build during this development turn, explaining our architectural reasoning.

---

## 1. Hot-Pluggable Custom Emission Factor Customizer
* *What is it*: A database dashboard that allows corporate clients to upload custom CSV sheets mapping localized material or travel greenhouse gas emission factor coefficients directly on the web app.
* *Why we did not build it*: Custom emission engines are highly vulnerable to typing errors and validation mistakes by non-expert corporate users. To protect compliance reporting integrity, emission factor coefficients are statically compiled and managed as tested software modules (`src/normalizer.ts`). Any changes to carbon accounting coefficients should follow normal git code-reviews to prevent accidental errors.

## 2. Multi-Role Auditor Identity Management (SSO / IAM)
* *What is it*: Strict OAuth integration restricting editing and approval buttons based on user security roles (e.g. Creator, Viewer, Lead Auditor).
* *Why we did not build it*: Adding complex login doors like Keycloak or Auth0 requires substantial budget, slowing down initial testing. Instead, we built a highly pragmatic and functional **Auditor Digital Signature** input field in the main header. This allows analysts to sign actions without auth hurdles.

## 3. Real-Time Exchange Rate API Integrations
* *What is it*: Integrations with services like currencylayer or openexchangerates to dynamically convert cost amounts in different currencies (EUR, GBP) during ingestion.
* *Why we did not build it*: Carbon accounting reports require static consistency. If daily currency values fluctuated, identical invoices ingested on different days would report different carbon totals, creating financial audits issues. To ensure reports are reproducible, we use static, reliable FX factors (`EX_RATES`) aligned with corporate reporting terms.

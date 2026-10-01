# 🛍️ RescueShip — Shopify App Store Listing Dossier

**Production-Ready Listing Documentation & Marketplace Submission Package**  
*Maintained by the RescueShip Legal, Product & GTM Team*  
*Last Updated: October 2026*

---

## 1. App Listing Overview & Metadata

| Field | Submission Value | Notes |
| :--- | :--- | :--- |
| **App Name** | `RescueShip: Autonomous NDR & RTO Rescue` | Fits 50-character limit |
| **Short Tagline** | `Cut COD RTO losses by 62% with autonomous WhatsApp re-delivery interception in 90 seconds.` | 96 characters |
| **Primary Category** | Orders and shipping &rarr; Delivery management | |
| **Secondary Category** | Customer service &rarr; Chat and messaging | |
| **Pricing Model** | Recurring Monthly Subscription + 14-Day Free Trial | 30-Day Money-Back Guarantee |
| **Developer Name** | RescueShip Technologies Private Limited | |
| **Support Email** | `support@rescueship.com` | Official support desk |
| **Privacy Policy URL** | `https://rescueship-frontend.onrender.com/privacy` | DPDP Act 2023 Compliant |
| **Terms of Service URL**| `https://rescueship-frontend.onrender.com/terms` | Indian Jurisdiction (Mumbai) |
| **Supported Languages** | English, Hindi, Hinglish (AI Conversational) | |

---

## 2. Key Benefits (Hero Highlights)

1. **Autonomous 90-Second WhatsApp Interception**  
   Intercept courier NDR webhooks within 90 seconds. Engage the shopper on WhatsApp before the delivery agent leaves the postal code.
2. **Zero Human Calling Team Overhead**  
   Replace slow, expensive calling teams. RescueShip handles address fixes, landmark pins, and re-attempt dates conversationally 24/7.
3. **Bi-Directional Courier Carrier Sync**  
   Instantly updates Shiprocket, Delhivery, ClickPost, Shadowfax, and BlueDart with confirmed customer delivery coordinates.
4. **Pre-Dispatch COD-to-Prepaid Conversion**  
   Incentivize shoppers to convert risky COD orders to prepaid with automated UPI payment links, capturing margin before dispatch.
5. **30-Day Money-Back Performance Guarantee**  
   If your verified recovered order value does not exceed your subscription fee, get a 100% full refund with zero questions.

---

## 3. App Description (Exact Markdown Copy — 2,480 Characters)

```markdown
Every day in India, 18% to 25% of Cash-on-Delivery (COD) orders fail at the doorstep. Delivery executives record vague remarks ("Customer unavailable", "Address incomplete"), packages are slapped with reverse freight, and you lose ₹140 to ₹250+ per parcel in forward freight, reverse logistics, and locked inventory.

Call centers are too slow—by the time an agent dials the shopper, the courier van has already driven away. Traditional SMS notifications are ignored.

**RescueShip stops this bleeding automatically.**

RescueShip is India’s first autonomous NDR rescue and RTO prevention engine. The instant a courier logs a failed delivery, RescueShip intercepts the webhook and engages the buyer over WhatsApp in under 90 seconds.

### How RescueShip Works:

1. **Instant Webhook Interception (0–90 Seconds)**  
When Shiprocket, Delhivery, BlueDart, or Shadowfax posts a failed delivery attempt, RescueShip instantly parses the reason code and initiates an interactive WhatsApp verification dialogue with the shopper.

2. **3-Mode Conversational Address Recovery**  
Shoppers don't type long forms. RescueShip collects Google Maps GPS location pins, parses colloquial Indian landmarks ("opposite SBI ATM, 2nd floor") using Gemini AI, or schedules delivery on a date the customer is actually home.

3. **Autonomous Courier Re-Attempt Sync**  
The moment the shopper confirms their details, RescueShip immediately pushes the verified address and next-day re-attempt directive directly into your courier's API and driver manifest.

4. **Fake Courier Remark Detection**  
Detect courier fraud in real time. Flag suspicious "Customer refused" scans made at odd hours or without driver GPS proximity, automatically raising carrier escalations.

5. **Pre-Dispatch COD Conversion**  
Convert up to 34% of COD checkouts into prepaid orders with dynamic, one-click WhatsApp UPI payment links offering targeted incentives funded by COD handling fee savings.

### Why D2C Brands Choose RescueShip:
- **62% Average NDR Recovery Rate:** Salvage the majority of first-attempt delivery failures.
- **₹4.2L+ Average Monthly Margin Protected:** Realized savings across freight and repackaging.
- **5-Minute Zero-Code Setup:** Connect Shopify, link your courier account, and launch.
- **Enterprise DPDP Act 2023 Compliance:** AES-256-GCM encryption with Indian sovereign data storage.

**Try RescueShip Risk-Free:**  
Enjoy a 14-day zero-risk trial plus our 30-day money-back performance guarantee. If our verified rescues don't pay for your plan, you pay nothing.
```

---

## 4. Required OAuth Scopes & Technical Rationale

| OAuth Scope | Permission Level | Technical Rationale & Functional Requirement |
| :--- | :--- | :--- |
| `read_orders` | Read | Essential to ingest newly placed orders, retrieve customer contact phone numbers (E.164), line-item SKU details, COD balances, and tracking AWBs for real-time delivery monitoring. |
| `write_orders` | Write | Required to update Shopify orders upon successful rescue: appending verified tags (`rescued_ndr`, `address_verified`), updating corrected shipping addresses, and revising payment gateway status when COD is converted to prepaid. |
| `read_products` | Read | Required to inspect SKU metadata, product titles, and categories for generating context-aware WhatsApp interactive templates and calculating category-level RTO risk scores. |

---

## 5. Visual Asset Specifications & Screenshot Storyboards

### A. App Icon Specifications
- **Dimensions:** 512 &times; 512 px (PNG format, 72 DPI, RGB, < 1 MB).
- **Background Canvas:** Deep void `#050508` with subtle radial grid overlay.
- **Central Glyph:** Minimalist nautical anchor emblem ⚓ rendered in bright indigo-to-cyan phosphor gradient (`#4f46e5` to `#38bdf8`).
- **Safe Zone:** 64 px margin padding on all edges to ensure crisp rendering on retina displays and circular mobile app store clipping.

---

### B. Screenshot Storyboards (1280 &times; 720 px, 16:9 Aspect Ratio)

#### Screenshot 1: Real-Time Live Order Board & Telemetry Feed
- **Title Banner:** *Autonomous NDR Interception in 90 Seconds*
- **Visual Composition:** 
  - Dual-panel split view showing real-time column cards moving from *NDR In-Flight* (courier failure remark received) to *Rescued & Accepted* (customer confirmed address).
  - Telemetry ticker showcasing incoming live orders, courier names (Shiprocket, Delhivery), and dynamic rescue timestamps.
- **Sub-caption:** *Track intercepted failed deliveries in real time as AI resolves address issues without human support tickets.*

#### Screenshot 2: Interactive WhatsApp Customer Dialogue Experience
- **Title Banner:** *Natural 2-Way Conversational Recovery on WhatsApp*
- **Visual Composition:**
  - High-fidelity smartphone mockup displaying official WhatsApp Business verified profile.
  - Interactive message bubbles offering quick-action buttons: `📍 Share Location`, `✏️ Edit Address`, and `📅 Deliver Tomorrow`.
  - Customer sends Google Maps location; AI acknowledges: *"Thanks Rahul! Your address has been updated with BlueDart for re-delivery tomorrow morning."*
- **Sub-caption:** *Deliver a frictionless, branded customer experience with 98% open rates over official WhatsApp Cloud API.*

#### Screenshot 3: RescueLedger Financial Dashboard & Verifiable ROI
- **Title Banner:** *Transparent Unit Economics & Verifiable Margin Recovery*
- **Visual Composition:**
  - Executive financial dashboard displaying:
    - Net Rupee Savings Counter: `₹4,28,450 Saved this Month`
    - RTO Reduction Metric: `24.8% → 9.4% (-62% Relative RTO)`
    - Realized ROI Multiplier: `17.1x Plan Coverage`
  - Granular ledger list linking each rescued Shopify Order ID with net freight savings breakdown.
- **Sub-caption:** *Know exactly how much money RescueShip saves your business down to the rupee.*

#### Screenshot 4: High-Risk Pincode Heatmap & Fake Courier Remark Shield
- **Title Banner:** *Detect Courier Fraud & Block High-Risk Postal Zones*
- **Visual Composition:**
  - Interactive India choropleth map highlighting Tier 2/3 pincodes with NDR concentration.
  - Telemetry card displaying *Fake Attempt Detection*: courier marked "Customer Refused" at 9:42 PM, but automated WhatsApp verification proved customer was waiting at home.
- **Sub-caption:** *Hold delivery carriers accountable with automated GPS timestamp verification and courier dispute reports.*

#### Screenshot 5: 1-Click Shopify & Courier Mesh Connect Station
- **Title Banner:** *Live in 5 Minutes — Zero Code, Instant Carrier Mesh*
- **Visual Composition:**
  - Sleek modern station interface showing green "Connected" status pills across:
    - Shopify Store Webhooks
    - Meta WhatsApp Cloud API (Pre-approved Utility Templates)
    - Shiprocket, Delhivery & Shadowfax API credentials
  - Simple toggle switches for Pre-Dispatch COD Conversion and Automated Re-attempt Directives.
- **Sub-caption:** *Plug into your existing tech stack effortlessly. No developer required.*

---

## 6. Pricing Tiers & Plan Architecture

| Plan Tier | Monthly Price (INR) | Monthly Order Cap | Included Capabilities & Scale Features | Break-Even Rescues* |
| :--- | :--- | :--- | :--- | :--- |
| **Starter** | **₹4,999** / mo | Up to 1,000 orders | Real-time NDR webhook interception, WhatsApp interactive templates, 1 courier integration, Live Order Board, standard email support. | ~20 orders |
| **Growth** | **₹11,999** / mo | Up to 5,000 orders | All Starter features + Pre-Dispatch COD conversion, 3-Mode Gemini AI address parser, multi-carrier mesh (up to 3 couriers), RescueLedger analytics, priority support. | ~48 orders |
| **Scale** | **₹24,999** / mo | Up to 12,000 orders | All Growth features + Fake Courier Remark detection, high-risk pincode heatmap, custom WhatsApp sender identity (WABA), weekly WhatsApp Sunday ROI reports, dedicated Slack channel. | ~100 orders |
| **Fleet** | **₹44,999** / mo | Up to 25,000 orders | All Scale features + Unlimited courier integrations, custom webhook routing, dedicated account manager, 99.9% uptime SLA, custom reporting exports. | ~180 orders |
| **Enterprise** | Custom Quote | 25,000+ orders | Tailored SLA, multi-store architecture, custom on-premise carrier adapters, dedicated WhatsApp namespace, bespoke ML risk models. | Custom |

*\*Calculated at average RTO sunk cost savings of ₹250 per rescued parcel.*

---

## 7. Merchant Frequently Asked Questions (FAQ)

**Q: How does RescueShip connect to our couriers?**  
A: RescueShip integrates directly via secure API tokens and webhooks with all leading Indian logistics aggregators and carriers, including Shiprocket, Delhivery, ClickPost, BlueDart, Shadowfax, and Xpressbees. Setup takes under 3 minutes.

**Q: Do we need our own WhatsApp Business API account?**  
A: No! You can start immediately using RescueShip's pre-approved, verified shared utility number. For Scale and Fleet plans, you can seamlessly connect your own branded WhatsApp Business Account (WABA) in one click via Meta Embedded Signup.

**Q: What happens if a customer replies to the WhatsApp message?**  
A: RescueShip's autonomous conversation engine automatically handles addresses, landmarks, preferred delivery dates, and cancellation requests. If a customer asks a complex question outside fulfillment, our system can forward the conversation to your Zendesk, Freshchat, or Gorgias inbox.

**Q: Is customer data secure and compliant with Indian law?**  
A: Absolutely. RescueShip is 100% compliant with the Digital Personal Data Protection Act, 2023 (DPDP Act). All customer data is hosted on encrypted AWS servers within India (Mumbai region) with hardware-backed AES-256-GCM encryption at rest. We never resell or share customer data.

**Q: What is your 30-Day Money-Back Guarantee?**  
A: If during your first 30 days of active subscription, the value of orders rescued by RescueShip does not exceed the subscription fee paid, simply message `support@rescueship.com` and we will refund 100% of your platform subscription fee immediately.

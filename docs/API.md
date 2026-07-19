# RescueShip API Documentation

Base URL: `http://localhost:3000/api`

## Authentication (`/auth`)

### 1. Register Merchant
- **Method:** `POST /auth/register`
- **Body Schema:**
  ```json
  {
    "companyName": "My Store",
    "email": "owner@store.com",
    "password": "securepassword123",
    "phone": "9876543210"
  }
  ```
- **Response:**
  ```json
  {
    "token": "jwt_token_string",
    "merchantId": "id_string"
  }
  ```

### 2. Login
- **Method:** `POST /auth/login`
- **Body Schema:**
  ```json
  {
    "email": "owner@store.com",
    "password": "securepassword123"
  }
  ```
- **Response:**
  ```json
  {
    "token": "jwt_token_string"
  }
  ```

## Settings (`/settings`)

Headers required: `Authorization: Bearer <token>`

### 1. Get Settings
- **Method:** `GET /settings`
- **Response:** Merchant settings object.

### 2. Update Settings
- **Method:** `PUT /settings`
- **Body Schema:** Any updatable settings fields.
- **Response:** Updated settings object.

## Analytics (`/analytics`)

Headers required: `Authorization: Bearer <token>`

### 1. Get Dashboard
- **Method:** `GET /analytics/dashboard`
- **Query Params:** `startDate` (ISO string), `endDate` (ISO string)
- **Response:**
  ```json
  {
    "totalOrders": 100,
    "codOrders": 60,
    "prepaidOrders": 40,
    "ndrCount": 10,
    "rescuedCount": 5,
    "rescueRate": 50,
    "conversionCount": 20,
    "conversionRate": 33.3,
    "totalRevenueSaved": 2000,
    "carrierBreakdown": []
  }
  ```

## Orders (`/orders`)

Headers required: `Authorization: Bearer <token>`

### 1. List Orders
- **Method:** `GET /orders`
- **Query Params:** `page`, `limit`, `status`
- **Response:** List of orders with pagination meta.

### 2. Get Order by ID
- **Method:** `GET /orders/:id`
- **Response:** Single order object.

## Billing, Templates, and Audit Logs

These resources will follow the standard CRUD API structure and require `Authorization: Bearer <token>`. 
- `GET /templates` - fetch communication templates.
- `GET /billing/invoices` - get recent invoices.
- `GET /audit-logs` - get recent activity logs.

## Webhooks (`/webhooks`)

Webhooks are used to receive real-time updates from carriers and platforms. 

- `POST /webhooks/shopify`
- `POST /webhooks/woocommerce`
- `POST /webhooks/shiprocket`
- `POST /webhooks/delhivery`
- `POST /webhooks/clickpost`
- `POST /webhooks/whatsapp`
- `POST /webhooks/razorpay`
- `POST /webhooks/cashfree`
- `POST /webhooks/custom`

See `INTEGRATION_GUIDE.md` for webhook setup.

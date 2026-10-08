import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RefreshCw, Zap, KeyRound } from 'lucide-react';
import { Field, Done } from './Field';

interface StoreStationProps {
  onTokenConnect: (shop: string, key: string, secret: string) => void;
  onOAuthConnect: (shop: string) => void;
  onConnectWooCommerce: (url: string, key: string, secret: string) => void;
  busy: any;
  storeDone: boolean;
  shop?: string;
  wcUrl?: string;
  wcManual?: { webhookUrl: string; webhookSecret: string } | null;
}

export function ManualWebhook({ info }: { info: { webhookUrl: string; webhookSecret: string } }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${info.webhookUrl}\nSecret: ${info.webhookSecret}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="ob-note ob-note--warn">
      <strong>Add the webhook manually</strong> — in WordPress go to{' '}
      <strong>WooCommerce → Settings → Advanced → Webhooks → Add webhook</strong>, set Topic to{' '}
      <strong>Order created</strong>, Status <strong>Active</strong>, paste this Delivery URL and Secret,
      then Save.
      <div className="ob-mono">
        <code>{info.webhookUrl}</code>
      </div>
      <div className="ob-mono">
        <code>Secret: {info.webhookSecret}</code>
      </div>
      <button type="button" className="ob-btn ob-btn--ghost" onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy URL + secret'}
      </button>
    </div>
  );
}

const wooCommerceSchema = z.object({
  url: z.string().min(1, 'Store URL is required'),
  consumerKey: z.string().min(1, 'Consumer key is required'),
  consumerSecret: z.string().min(1, 'Consumer secret is required'),
});

type WooCommerceFormValues = z.infer<typeof wooCommerceSchema>;

export function WooCommerceForm({
  onConnect,
  busy,
}: {
  onConnect: (url: string, key: string, secret: string) => void;
  busy: any;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<WooCommerceFormValues>({
    resolver: zodResolver(wooCommerceSchema),
    defaultValues: { url: '', consumerKey: '', consumerSecret: '' },
  });

  const urlValue = watch('url');
  const urlValid = /^https:\/\/.+/i.test(urlValue?.trim() || '');

  const onSubmit = (data: WooCommerceFormValues) => {
    onConnect(data.url.trim(), data.consumerKey.trim(), data.consumerSecret.trim());
  };

  return (
    <form className="ob-form" onSubmit={handleSubmit(onSubmit)}>
      <Field label="Store URL">
        <input
          className="ob-input"
          placeholder="https://yourstore.com"
          {...register('url')}
          required
        />
        {errors.url && (
          <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            {errors.url.message}
          </span>
        )}
      </Field>
      <Field label="Consumer key">
        <input
          className="ob-input"
          placeholder="ck_…"
          autoComplete="off"
          spellCheck={false}
          {...register('consumerKey')}
          required
        />
        {errors.consumerKey && (
          <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            {errors.consumerKey.message}
          </span>
        )}
      </Field>
      <Field label="Consumer secret">
        <input
          className="ob-input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="cs_…"
          {...register('consumerSecret')}
          required
        />
        {errors.consumerSecret && (
          <span style={{ color: 'var(--rose)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
            {errors.consumerSecret.message}
          </span>
        )}
      </Field>
      <div className="ob-steps">
        <p className="ob-steps__title">How to get these (2 min):</p>
        <ol className="ob-steps__list">
          <li>
            In WordPress admin, go to <strong>WooCommerce → Settings → Advanced → REST API</strong>
          </li>
          <li>
            Click <strong>Add key</strong> → set Permissions to <strong>Read/Write</strong> → Generate
          </li>
          <li>
            Copy the <strong>Consumer key</strong> (ck_…) and <strong>Consumer secret</strong> (cs_…)
          </li>
          <li>
            If the REST API page is missing, enable it from{' '}
            <a
              href="https://woocommerce.com/document/woocommerce-rest-api/"
              target="_blank"
              rel="noopener noreferrer"
            >
              WooCommerce REST API docs
            </a>
          </li>
        </ol>
      </div>
      <button
        className="ob-btn"
        disabled={busy || !urlValid}
      >
        {busy ? 'Validating…' : 'Validate & connect'}
      </button>
    </form>
  );
}

export function ShopifyForm({
  onTokenConnect,
  onOAuthConnect,
  busy,
  defaultShop,
}: {
  onTokenConnect: (shop: string, key: string, secret: string) => void;
  onOAuthConnect: (shop: string) => void;
  busy: any;
  defaultShop?: string;
}) {
  const [method, setMethod] = useState<'oauth' | 'manual'>('oauth');
  const [shop, setShop] = useState(defaultShop || '');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');

  const shopTrimmed = shop.trim().toLowerCase();
  const shopValid = shopTrimmed.length > 2;
  const fullShopDomain = shopTrimmed.includes('.myshopify.com')
    ? shopTrimmed
    : shopTrimmed
    ? `${shopTrimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}.myshopify.com`
    : '';
  const shopSlug = shopTrimmed
    .replace(/^https?:\/\//, '')
    .replace(/\.myshopify\.com.*$/, '')
    .replace(/\/.*$/, '');

  return (
    <div className="ob-shopify-container">
      <div className="ob-seg" style={{ marginBottom: 'var(--space-3)' }}>
        <button
          type="button"
          className={method === 'oauth' ? 'on' : ''}
          onClick={() => setMethod('oauth')}
        >
          <Zap size={14} aria-hidden="true" /> One-click connect (Recommended)
        </button>
        <button
          type="button"
          className={method === 'manual' ? 'on' : ''}
          onClick={() => setMethod('manual')}
        >
          <KeyRound size={14} aria-hidden="true" /> Manual app keys
        </button>
      </div>

      {method === 'oauth' ? (
        <form
          className="ob-form"
          onSubmit={(e) => {
            e.preventDefault();
            onOAuthConnect(fullShopDomain);
          }}
        >
          <Field label="Store address">
            <input
              className="ob-input"
              placeholder="your-brand.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              required
            />
          </Field>
          <div
            className="ob-note"
            style={{ color: 'var(--text-3)', fontSize: '0.82rem', lineHeight: '1.5' }}
          >
            <p style={{ margin: '0 0 var(--space-1) 0' }}>
              <strong>Zero setup required:</strong> Enter your store handle or domain above and click{' '}
              <em>Connect with Shopify</em>. You will be redirected directly to your Shopify store to
              approve order access in 1 click, and then automatically returned here.
            </p>
          </div>
          <button className="ob-btn" disabled={busy || !shopValid}>
            {busy ? 'Opening Shopify login…' : 'Connect with Shopify →'}
          </button>
        </form>
      ) : (
        <form
          className="ob-form"
          onSubmit={(e) => {
            e.preventDefault();
            onTokenConnect(fullShopDomain, consumerKey.trim(), consumerSecret.trim());
          }}
        >
          <Field label="Store address">
            <input
              className="ob-input"
              placeholder="your-brand.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
              required
            />
          </Field>
          <Field label="Consumer key (Admin API access token)">
            <input
              className="ob-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
              required
            />
          </Field>
          <Field label="Consumer secret (API secret key)">
            <input
              className="ob-input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxx"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
              required
            />
          </Field>
          <div className="ob-steps">
            <p className="ob-steps__title">How to get these in Shopify:</p>
            <ol className="ob-steps__list">
              <li>
                {shopSlug ? (
                  <>
                    Open{' '}
                    <a
                      href={`https://admin.shopify.com/store/${shopSlug}/apps`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Apps
                    </a>{' '}
                    in your Shopify admin sidebar, or go to{' '}
                    <a
                      href="https://dev.shopify.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Shopify Dev Dashboard
                    </a>
                  </>
                ) : (
                  <>
                    Open <strong>Apps</strong> in your Shopify admin sidebar, or go to{' '}
                    <a
                      href="https://dev.shopify.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Shopify Dev Dashboard
                    </a>
                  </>
                )}
              </li>
              <li>
                Under <strong>Develop apps</strong> (or Dev Dashboard), create or open your app (name it
                "RescueShip").
              </li>
              <li>
                Go to <strong>Configuration → Admin API</strong>, click <strong>Configure</strong>, and
                tick: <code>read_orders, write_orders, read_fulfillments, write_fulfillments, read_products</code>{' '}
                → Save.
              </li>
              <li>
                Go to <strong>API credentials</strong>, click <strong>Install app</strong>, then click{' '}
                <strong>Reveal token once</strong> to copy your{' '}
                <strong>Admin API access token</strong> (starts with <code>shpat_…</code>).
              </li>
              <li>
                Copy your <strong>API secret key</strong> (starts with <code>shpss_…</code>).
              </li>
            </ol>
            <p style={{ marginTop: 'var(--space-2)', fontSize: '0.74rem', color: 'var(--amber)' }}>
              ⚠️ <strong>Important:</strong> Do NOT enter your 32-character Client ID in the access
              token field. Shopify requires the Admin API access token starting with <code>shpat_</code>.
            </p>
          </div>
          <p className="ob-note" style={{ color: 'var(--text-3)', fontSize: '0.74rem' }}>
            No RescueShip keys involved — just the key + secret you generate in your own admin.
          </p>
          <button
            className="ob-btn"
            disabled={busy || !shopValid || !consumerKey.trim() || !consumerSecret.trim()}
          >
            {busy ? 'Validating…' : 'Validate & connect'}
          </button>
        </form>
      )}
    </div>
  );
}

export function StoreStation({
  onTokenConnect,
  onOAuthConnect,
  onConnectWooCommerce,
  busy,
  storeDone,
  shop,
  wcUrl,
  wcManual,
}: StoreStationProps) {
  const [platform, setPlatform] = useState<'shopify' | 'woocommerce'>(
    shop ? 'shopify' : wcUrl ? 'woocommerce' : 'shopify'
  );
  const [showChange, setShowChange] = useState(false);

  if (storeDone && !showChange) {
    return (
      <div className="ob-form">
        <Done provider={`Connected · ${shop || wcUrl || 'store'}`} />
        {wcManual && <ManualWebhook info={wcManual} />}
        <button
          type="button"
          className="ob-btn ob-btn--ghost"
          style={{ marginTop: 'var(--space-2)' }}
          onClick={() => setShowChange(true)}
        >
          <RefreshCw size={14} aria-hidden="true" /> Reconnect or change store
        </button>
      </div>
    );
  }

  return (
    <div className="ob-form">
      <div className="ob-seg">
        <button
          type="button"
          className={platform === 'shopify' ? 'on' : ''}
          onClick={() => setPlatform('shopify')}
        >
          Shopify
        </button>
        <button
          type="button"
          className={platform === 'woocommerce' ? 'on' : ''}
          onClick={() => setPlatform('woocommerce')}
        >
          WooCommerce
        </button>
      </div>
      {platform === 'shopify' ? (
        <ShopifyForm
          onTokenConnect={onTokenConnect}
          onOAuthConnect={onOAuthConnect}
          busy={busy}
          defaultShop={shop}
        />
      ) : (
        <WooCommerceForm onConnect={onConnectWooCommerce} busy={busy} />
      )}
      {wcManual && <ManualWebhook info={wcManual} />}
    </div>
  );
}

export default StoreStation;

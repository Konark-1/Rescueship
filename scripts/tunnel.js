const localtunnel = require('localtunnel');

(async () => {
  try {
    const tunnel = await localtunnel({ port: 3000 });

    console.log('\n======================================================');
    console.log('🚀 PUBLIC HTTPS TUNNEL READY FOR SHOPIFY WEBHOOKS:');
    console.log(tunnel.url);
    console.log(`\nWebhook URL for Shopify:`);
    console.log(`${tunnel.url}/webhooks/shopify`);
    console.log('======================================================\n');

    tunnel.on('close', () => {
      console.log('Tunnel closed');
      process.exit(0);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });

    // Keep event loop active
    setInterval(() => {}, 1000 * 60 * 60);
  } catch (err) {
    console.error('Failed to create tunnel:', err);
  }
})();

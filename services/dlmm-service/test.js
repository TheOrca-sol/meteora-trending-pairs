require('dotenv').config();
const { getLiquidityDistribution } = require('./dlmmController');

// Test with SOL-USDC pair
const SOL_USDC_PAIR = 'BGm1tav58oGcsQJehL9WXBFXF7D27vZsKefj4xJKD5Y';

async function test() {
  console.log('🧪 Testing DLMM Liquidity Service...\n');
  console.log(`RPC: ${process.env.SOLANA_RPC_URL}\n`);

  try {
    console.log(`Fetching liquidity distribution for SOL-USDC...`);
    const result = await getLiquidityDistribution(SOL_USDC_PAIR);

    console.log('\n✅ Success!\n');
    console.log('Stats:', JSON.stringify(result.stats, null, 2));
    console.log(`\nTotal bins: ${result.bins.length}`);
    console.log(`Active bin: ${result.activeBin}`);
    console.log(`Current price: $${result.currentPrice.toFixed(4)}`);

    if (result.bins.length > 0) {
      console.log(`\nSample bins:`);
      console.log(result.bins.slice(0, 3).map(b => ({
        binId: b.binId,
        price: b.price.toFixed(4),
        liquidityUsd: b.liquidityUsd.toFixed(2),
        isActive: b.isActive
      })));
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();

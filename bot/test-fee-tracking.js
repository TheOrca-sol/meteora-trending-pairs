import feeTracker from './services/fee-tracker.service.js';
import database from './models/database.js';
import logger from './utils/logger.js';

/**
 * Test fee tracking functionality
 */
async function testFeeTracking() {
  try {
    logger.info('Testing fee tracking system...');

    // Test 1: Get portfolio fee stats (should be empty initially)
    logger.info('\n=== Test 1: Portfolio Fee Stats ===');
    const portfolioStats = await feeTracker.getPortfolioFeeStats();
    console.log('Portfolio Stats:', JSON.stringify(portfolioStats, null, 2));

    // Test 2: Get all positions fees
    logger.info('\n=== Test 2: All Positions Fees ===');
    const allFees = await feeTracker.getAllPositionsFees();
    console.log(`Found ${allFees.length} positions with fees`);

    // Test 3: Test shouldClaimFees logic
    logger.info('\n=== Test 3: Should Claim Fees Logic ===');
    const activePositions = await database.getActivePositions();
    if (activePositions.length > 0) {
      const testPosition = activePositions[0];
      const poolData = {
        apr: testPosition.entry_apr || 50, // Use entry APR or default
      };

      const claimCheck = await feeTracker.shouldClaimFees(testPosition, poolData);
      console.log('Position:', testPosition.id);
      console.log('Should Claim:', claimCheck.shouldClaim);
      console.log('Estimated Fees:', claimCheck.estimatedFeesUsd);
      console.log('Gas Cost:', claimCheck.estimatedGasCostUsd);
      console.log('Net Profit:', claimCheck.netProfit);
      console.log('Reason:', claimCheck.reason);

      // Test 4: Get position fees
      logger.info('\n=== Test 4: Get Position Fees ===');
      const positionFees = await feeTracker.getPositionFees(testPosition.id);
      console.log('Position Fees:', JSON.stringify(positionFees, null, 2));
    } else {
      logger.info('No active positions found for testing claim logic');
    }

    // Test 5: Simulate recording fees claimed (will fail if no positions exist)
    logger.info('\n=== Test 5: Simulate Fee Recording (Dry Run) ===');
    if (activePositions.length > 0) {
      const testPosition = activePositions[0];
      logger.info(`Would record fees for position ${testPosition.id}`);
      logger.info('Note: Not actually recording to avoid test data pollution');

      // Example of how fees would be recorded:
      const exampleFees = [
        {
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          amount: 0.001 * 1e9, // 0.001 SOL in lamports
          estimatedUsd: 0.2,
        },
      ];
      logger.info('Example fee structure:', JSON.stringify(exampleFees, null, 2));
    }

    logger.info('\n✅ Fee tracking tests completed successfully!');

    await database.close();
    process.exit(0);
  } catch (error) {
    logger.error('Fee tracking test failed:', error);
    await database.close();
    process.exit(1);
  }
}

// Initialize database and run tests
database.initialize()
  .then(() => testFeeTracking())
  .catch((error) => {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  });

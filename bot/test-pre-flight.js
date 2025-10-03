import preFlightCheck from './services/pre-flight-check.service.js';
import logger from './utils/logger.js';

/**
 * Test pre-flight checks
 */
async function testPreFlight() {
  try {
    logger.info('Running pre-flight checks...\n');

    const result = await preFlightCheck.runAllChecks();

    if (result.passed) {
      logger.info('\n✅ PRE-FLIGHT CHECKS PASSED - SYSTEM READY FOR DEPLOYMENT\n');

      // Show live deployment checklist
      const checklist = preFlightCheck.getLiveDeploymentChecklist();

      logger.info('📋 LIVE DEPLOYMENT CHECKLIST:\n');
      logger.info('BEFORE DEPLOYMENT:');
      checklist.before.forEach(item => logger.info(item));

      logger.info('\nDURING DEPLOYMENT:');
      checklist.during.forEach(item => logger.info(item));

      logger.info('\nAFTER DEPLOYMENT:');
      checklist.after.forEach(item => logger.info(item));

      logger.info('\nEMERGENCY PROCEDURES:');
      checklist.emergency.forEach(item => logger.info(item));

      process.exit(0);
    } else {
      logger.error('\n❌ PRE-FLIGHT CHECKS FAILED - DO NOT DEPLOY\n');
      logger.error('Fix the failed checks above before proceeding.\n');
      process.exit(1);
    }

  } catch (error) {
    logger.error('Pre-flight check failed with error:', error);
    process.exit(1);
  }
}

testPreFlight();

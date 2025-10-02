/**
 * Strategy Index
 * Registers all available strategies with the registry
 */
import strategyRegistry from './strategy-registry.js';
import { AntiSawtoothStrategy } from './anti-sawtooth.strategy.js';
import { HotPotatoStrategy } from './hot-potato.strategy.js';
import { BreadButterStrategy } from './bread-butter.strategy.js';
import { TwentyBinStrategy } from './twenty-bin.strategy.js';
import { AlphaLaunchStrategy } from './alpha-launch.strategy.js';
import { VolumeHunterStrategy } from './volume-hunter.strategy.js';
import { OvernightStrategy } from './overnight.strategy.js';
import { DCAStrategy } from './dca.strategy.js';

/**
 * Initialize and register all strategies
 */
export function initializeStrategies() {
  // Register all new modular strategies
  strategyRegistry.registerStrategy(new AlphaLaunchStrategy()); // Priority 95
  strategyRegistry.registerStrategy(new HotPotatoStrategy()); // Priority 90
  strategyRegistry.registerStrategy(new VolumeHunterStrategy()); // Priority 75
  strategyRegistry.registerStrategy(new TwentyBinStrategy()); // Priority 70
  strategyRegistry.registerStrategy(new AntiSawtoothStrategy()); // Priority 60
  strategyRegistry.registerStrategy(new DCAStrategy()); // Priority 40
  strategyRegistry.registerStrategy(new OvernightStrategy()); // Priority 35
  strategyRegistry.registerStrategy(new BreadButterStrategy()); // Priority 20

  console.log(`✓ Registered ${strategyRegistry.getStrategyCount()} modular strategies`);
}

export { strategyRegistry };
export default strategyRegistry;

import { MockGenerator } from './MockGenerator';
import { IGeneratorService } from './GeneratorService';

/**
 * Factory for creating generator service instances.
 * Swap backends here — UI code never needs to change.
 */
export function createGenerator(type: 'mock' | 'ai' = 'mock'): IGeneratorService {
    switch (type) {
        case 'mock':
            return new MockGenerator();
        case 'ai':
            // TODO: Phase 4 — return new AIGenerator()
            console.warn('AI generator not yet implemented, falling back to mock');
            return new MockGenerator();
        default:
            return new MockGenerator();
    }
}

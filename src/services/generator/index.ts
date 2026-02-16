import { MockGenerator } from './MockGenerator';
import { AIGenerator } from './AIGenerator';
import { IGeneratorService } from './GeneratorService';
import { AIConfig } from '@/types';

/**
 * Factory for creating generator service instances.
 * Swap backends here — UI code never needs to change.
 */
export function createGenerator(type: 'mock' | 'ai' = 'mock', config?: AIConfig): IGeneratorService {
    switch (type) {
        case 'mock':
            return new MockGenerator();
        case 'ai':
            return new AIGenerator(config || undefined);
        default:
            return new MockGenerator();
    }
}

/**
 * Determine the best generator type based on available configuration.
 */
export function getPreferredGeneratorType(): 'mock' | 'ai' {
    const config = AIGenerator.getConfig();
    return config?.apiKey ? 'ai' : 'mock';
}

import { GeneratorInput, GenerationEvent, GeneratedProject } from '@/types';

/**
 * Abstract Generator Service Interface
 * 
 * All generator implementations (Mock, AI, Custom) must implement this interface.
 * This allows swapping backends without touching any UI code.
 * 
 * Usage:
 *   const generator: IGeneratorService = new MockGenerator(); // or AIGenerator
 *   for await (const event of generator.generate(input)) {
 *     // handle streaming events
 *   }
 */
export interface IGeneratorService {
    /** Unique identifier for this generator */
    readonly id: string;
    /** Human-readable name */
    readonly name: string;

    /**
     * Generate a project from user input.
     * Yields GenerationEvents as progress updates,
     * and the final event will be of type 'complete' with the full project.
     */
    generate(input: GeneratorInput): AsyncGenerator<GenerationEvent, GeneratedProject, undefined>;

    /**
     * Check if this generator is available/configured.
     * E.g., AIGenerator checks for API key.
     */
    isAvailable(): boolean;
}

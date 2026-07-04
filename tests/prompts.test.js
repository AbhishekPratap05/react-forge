import { describe, it, expect } from 'vitest';
import { validateProjectName } from '../lib/prompts.js';

describe('validateProjectName', () => {
  it('should accept valid names containing only lowercase, numbers, underscores, or hyphens', () => {
    expect(validateProjectName('my-project')).toBe(true);
    expect(validateProjectName('project_123')).toBe(true);
    expect(validateProjectName('react-forge-app')).toBe(true);
  });

  it('should reject names containing uppercase letters', () => {
    const result = validateProjectName('My-Project');
    expect(typeof result).toBe('string');
    expect(result).toContain('Project name may only include');
  });

  it('should reject names containing spaces or special characters', () => {
    const spacesResult = validateProjectName('my project');
    const specResult = validateProjectName('project$');
    const hashResult = validateProjectName('project#');
    
    expect(typeof spacesResult).toBe('string');
    expect(typeof specResult).toBe('string');
    expect(typeof hashResult).toBe('string');
  });

  it('should reject empty names', () => {
    const result = validateProjectName('');
    expect(typeof result).toBe('string');
  });
});

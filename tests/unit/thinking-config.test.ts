import { describe, it, expect } from 'vitest';
import {
  buildGeminiThinkingConfig,
  getGeminiThinkingCapability,
} from '../../src/utils/thinkingConfig';

describe('Model-aware Gemini thinkingConfig resolver', () => {
  it('returns mode: none and undefined thinkingConfig for non-thinking models', () => {
    expect(getGeminiThinkingCapability('gemini-1.5-flash').mode).toBe('none');
    expect(getGeminiThinkingCapability('gemini-2.0-flash').mode).toBe('none');
    expect(buildGeminiThinkingConfig('gemini-1.5-flash', 'high')).toBeUndefined();
    expect(buildGeminiThinkingConfig('gemini-2.0-flash', 'auto')).toBeUndefined();
  });

  it('uses thinkingBudget for Gemini 2.5 Flash (supports Off = 0 and Auto = -1)', () => {
    const cap = getGeminiThinkingCapability('gemini-2.5-flash');
    expect(cap.mode).toBe('budget');
    expect(cap.canDisable).toBe(true);
    expect(cap.supportedPresets).toContain('off');

    expect(buildGeminiThinkingConfig('gemini-2.5-flash', 'auto')).toEqual({
      thinkingBudget: -1,
      includeThoughts: true,
    });
    expect(buildGeminiThinkingConfig('gemini-2.5-flash', 'off')).toEqual({
      thinkingBudget: 0,
      includeThoughts: false,
    });
    expect(buildGeminiThinkingConfig('gemini-2.5-flash', 'medium')).toEqual({
      thinkingBudget: 8192,
      includeThoughts: true,
    });
    expect(buildGeminiThinkingConfig('gemini-2.5-flash', 'high')).toEqual({
      thinkingBudget: 24576,
      includeThoughts: true,
    });
  });

  it('clamps Gemini 2.5 Pro minimum budget to 128 and allows up to 32768', () => {
    const cap = getGeminiThinkingCapability('gemini-2.5-pro');
    expect(cap.mode).toBe('budget');
    expect(cap.canDisable).toBe(false);
    expect(cap.supportedPresets).not.toContain('off');

    expect(buildGeminiThinkingConfig('gemini-2.5-pro', 'off')).toEqual({
      thinkingBudget: 128,
      includeThoughts: true,
    });
    expect(buildGeminiThinkingConfig('gemini-2.5-pro', 'high')).toEqual({
      thinkingBudget: 32768,
      includeThoughts: true,
    });
  });

  it('uses thinkingLevel for Gemini 3 Pro (low/high only) and Gemini 3 Flash (minimal..high)', () => {
    const proCap = getGeminiThinkingCapability('gemini-3-pro-preview');
    expect(proCap.mode).toBe('level');
    expect(proCap.supportedPresets).toEqual(['auto', 'low', 'high']);

    expect(buildGeminiThinkingConfig('gemini-3-pro-preview', 'auto')).toEqual({
      includeThoughts: true,
    });
    expect(buildGeminiThinkingConfig('gemini-3-pro-preview', 'low')).toEqual({
      thinkingLevel: 'low',
      includeThoughts: true,
    });
    // medium maps gracefully to high for Gemini 3 Pro
    expect(buildGeminiThinkingConfig('gemini-3-pro-preview', 'medium')).toEqual({
      thinkingLevel: 'high',
      includeThoughts: true,
    });

    const flashCap = getGeminiThinkingCapability('gemini-3-flash');
    expect(flashCap.mode).toBe('level');
    expect(flashCap.supportedPresets).toEqual(['auto', 'minimal', 'low', 'medium', 'high']);
    expect(buildGeminiThinkingConfig('gemini-3-flash', 'minimal')).toEqual({
      thinkingLevel: 'minimal',
      includeThoughts: true,
    });
  });

  it('uses thinkingLevel for Gemma series models', () => {
    const gemmaCap = getGeminiThinkingCapability('gemma-4-31b-it');
    expect(gemmaCap.mode).toBe('level');
    expect(gemmaCap.supportedPresets).toEqual(['auto', 'minimal', 'low', 'medium', 'high']);

    expect(buildGeminiThinkingConfig('gemma-4-31b-it', 'auto')).toEqual({
      includeThoughts: true,
    });
    expect(buildGeminiThinkingConfig('gemma-4-31b-it', 'high')).toEqual({
      thinkingLevel: 'high',
      includeThoughts: true,
    });
    expect(buildGeminiThinkingConfig('gemma-4-31b-it', 'minimal')).toEqual({
      thinkingLevel: 'minimal',
      includeThoughts: true,
    });
  });
});

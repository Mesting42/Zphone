import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { window: {} };
vm.runInNewContext(readFileSync(new URL('../js/workflow-step-navigation.js', import.meta.url), 'utf8'), context);
const navigation = context.window.WorkflowStepNavigation;
const mainApp = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const mainHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const gameApp = readFileSync(new URL('../game-builder/js/app.js', import.meta.url), 'utf8');
const gameHtml = readFileSync(new URL('../game-builder/index.html', import.meta.url), 'utf8');

describe('workflow step navigation', () => {
  it('keeps previously reached steps available after backtracking', () => {
    const steps = [1, 2, 3, 4, 5];
    let highestReached = 1;

    for (const step of [2, 3, 4]) {
      highestReached = navigation.recordHighestReachedStep(steps, highestReached, step);
    }

    expect(highestReached).toBe(4);
    expect(navigation.canNavigateToStep(steps, highestReached, 1)).toBe(true);
    expect(navigation.canNavigateToStep(steps, highestReached, 4)).toBe(true);
    expect(navigation.canNavigateToStep(steps, highestReached, 5)).toBe(false);
  });

  it('uses workflow order for sparse step IDs and validates every skipped step', () => {
    const steps = [1, 4, 5];

    expect(navigation.isNextStep(steps, 1, 4)).toBe(true);
    expect(navigation.isNextStep(steps, 1, 2)).toBe(false);
    expect(navigation.getStepsToValidate(steps, 1, 5)).toEqual([1, 4]);
    expect(navigation.getStepsToValidate([1, 2, 3, 4, 5], 1, 4)).toEqual([1, 2, 3]);
  });

  it('does not regress progress and can reset a workflow to its first step', () => {
    const steps = [1, 2, 3, 4, 5];

    expect(navigation.recordHighestReachedStep(steps, 4, 2)).toBe(4);
    expect(navigation.normalizeHighestReachedStep(steps, 99)).toBe(1);
    expect(navigation.getFirstStep(steps)).toBe(1);
  });

  it('loads the shared navigation guard in every site-building UI', () => {
    expect(mainHtml.indexOf('workflow-step-navigation.js')).toBeLessThan(mainHtml.indexOf('js/app.js'));
    expect(gameHtml.indexOf('../js/workflow-step-navigation.js')).toBeLessThan(gameHtml.indexOf('js/app.js'));
    expect(mainApp).toContain('getStepsToValidate(steps, appState.currentStep, step)');
    expect(mainApp).toContain('canNavigateToStep(steps, highestReachedStep, step)');
    expect(gameApp).toContain('getStepsToValidate(steps, appState.currentStep, step)');
    expect(gameApp).toContain('canNavigateToStep([1, 2], getWorkflowHighestReachedStep(), step)');
    expect(gameHtml).toContain('<button type="button" class="step-item" data-step="2" disabled>');
  });

  it('resets unlock progress when each workflow receives a replacement source', () => {
    expect(mainApp).toContain("resetWorkflowStepProgress('ad-migration')");
    expect(mainApp).toContain("resetWorkflowStepProgress('ad-injection')");
    expect(mainApp).toContain("resetWorkflowStepProgress('differentiated')");
    expect(mainApp).toContain("resetWorkflowStepProgress('batch-ad-build')");
    expect(mainApp).toContain('resetWorkflowStepProgress(currentWorkflowProgressKey());');
    expect(gameApp).toContain("resetWorkflowStepProgress('ad-migration')");
    expect(gameApp).toContain("resetWorkflowStepProgress('differentiated')");
    expect(gameApp).toContain('resetWorkflowStepProgress(currentWorkflowProgressKey());');
  });
});

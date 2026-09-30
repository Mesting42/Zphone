(function(root) {
    'use strict';

    // Workflow step IDs may be sparse (for example, the finished-site flow is
    // 1 → 4 → 5), so every progress operation uses sequence positions instead
    // of comparing the numeric IDs themselves.
    function getStepIndex(steps, step) {
        return Array.isArray(steps) ? steps.indexOf(step) : -1;
    }

    function getFirstStep(steps) {
        return Array.isArray(steps) && steps.length ? steps[0] : null;
    }

    function normalizeHighestReachedStep(steps, highestReachedStep) {
        var firstStep = getFirstStep(steps);
        if (firstStep === null) return null;
        return getStepIndex(steps, highestReachedStep) === -1 ? firstStep : highestReachedStep;
    }

    function recordHighestReachedStep(steps, highestReachedStep, visitedStep) {
        var normalizedHighest = normalizeHighestReachedStep(steps, highestReachedStep);
        var highestIndex = getStepIndex(steps, normalizedHighest);
        var visitedIndex = getStepIndex(steps, visitedStep);
        if (visitedIndex === -1) return normalizedHighest;
        return steps[Math.max(highestIndex, visitedIndex)];
    }

    function canNavigateToStep(steps, highestReachedStep, targetStep) {
        var targetIndex = getStepIndex(steps, targetStep);
        var highestIndex = getStepIndex(steps, normalizeHighestReachedStep(steps, highestReachedStep));
        return targetIndex !== -1 && targetIndex <= highestIndex;
    }

    function isNextStep(steps, currentStep, targetStep) {
        var currentIndex = getStepIndex(steps, currentStep);
        return currentIndex !== -1 && getStepIndex(steps, targetStep) === currentIndex + 1;
    }

    function getStepsToValidate(steps, currentStep, targetStep) {
        var currentIndex = getStepIndex(steps, currentStep);
        var targetIndex = getStepIndex(steps, targetStep);
        if (currentIndex === -1 || targetIndex <= currentIndex) return [];
        // Validate the current step and every intervening step, but not the
        // destination step: a user may enter that step before configuring it.
        return steps.slice(currentIndex, targetIndex);
    }

    root.WorkflowStepNavigation = Object.freeze({
        getStepIndex: getStepIndex,
        getFirstStep: getFirstStep,
        normalizeHighestReachedStep: normalizeHighestReachedStep,
        recordHighestReachedStep: recordHighestReachedStep,
        canNavigateToStep: canNavigateToStep,
        isNextStep: isNextStep,
        getStepsToValidate: getStepsToValidate
    });
})(typeof window !== 'undefined' ? window : globalThis);

/*
 * Shared event-boundary checks for the custom dropdowns in both builders.
 * Keep these helpers independent of advertising, select values, and export state.
 */
(function(root) {
    'use strict';

    function isTargetWithin(element, target) {
        if (!element || !target) return false;
        return element === target || (typeof element.contains === 'function' && element.contains(target));
    }

    function isScrollWithinAny(event, elements) {
        if (!event || !event.target || !elements) return false;
        return Array.from(elements).some(function(element) {
            return isTargetWithin(element, event.target);
        });
    }

    function isInteractionWithinAny(event, elements) {
        if (!event || !elements) return false;
        return Array.from(elements).some(function(element) {
            if (isTargetWithin(element, event.target)) return true;
            if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY) || !element || typeof element.getBoundingClientRect !== 'function') return false;

            // Native scrollbar events can be reported against the document instead of the scrollable element.
            var rect = element.getBoundingClientRect();
            return event.clientX >= rect.left && event.clientX <= rect.right &&
                event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
    }

    root.SiteFoundryDropdownEventGuards = Object.freeze({
        isScrollWithinAny: isScrollWithinAny,
        isInteractionWithinAny: isInteractionWithinAny
    });
})(window);

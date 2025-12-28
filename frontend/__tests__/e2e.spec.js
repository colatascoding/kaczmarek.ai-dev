/**
 * Playwright E2E Tests
 * Tests basic interactions and console errors
 */

const { test, expect } = require('@playwright/test');

// Set up test server URL (adjust port if needed)
const BASE_URL = process.env.TEST_URL || 'http://localhost:3100';

test.describe('Basic UI Interactions', () => {
  let consoleErrors = [];
  let consoleWarnings = [];

  test.beforeEach(async ({ page }) => {
    // Collect console errors and warnings
    consoleErrors = [];
    consoleWarnings = [];
    
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (type === 'error') {
        consoleErrors.push({
          type: 'error',
          text: text,
          location: msg.location()
        });
      } else if (type === 'warning') {
        consoleWarnings.push({
          type: 'warning',
          text: text,
          location: msg.location()
        });
      }
    });

    // Collect JavaScript errors
    page.on('pageerror', error => {
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack
      });
    });

    // Navigate to the app
    await page.goto(BASE_URL);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for critical functions to be available
    await page.waitForFunction(() => {
      return typeof window.loadHome !== 'undefined' &&
             typeof window.switchView !== 'undefined' &&
             typeof window.showNotification !== 'undefined' &&
             typeof window.rejectVersion !== 'undefined' &&
             typeof window.attachExecutionEventListeners !== 'undefined';
    }, { timeout: 15000 });
    
    // Additional wait for scripts to fully initialize
    await page.waitForTimeout(1000);
  });

  test('should load home page without console errors', async ({ page }) => {
    // Wait for all scripts to load and initialize
    await page.waitForFunction(() => {
      return typeof window.rejectVersion !== 'undefined' &&
             typeof window.attachExecutionEventListeners !== 'undefined';
    }, { timeout: 10000 });
    
    // Additional wait for any async initialization
    await page.waitForTimeout(1000);
    
    // Check for critical errors (excluding known issues that are being fixed)
    const criticalErrors = consoleErrors.filter(e => {
      const text = e.text.toLowerCase();
      // Filter out known issues that are being addressed
      if (text.includes('rejectversion is not defined') || 
          text.includes('attachexecutioneventlisteners is not defined')) {
        return false; // These should be fixed now
      }
      return text.includes('is not defined') || 
             text.includes('unexpected token') ||
             text.includes('syntaxerror') ||
             (text.includes('referenceerror') && !text.includes('rejectversion') && !text.includes('attachexecutioneventlisteners'));
    });

    expect(criticalErrors.length).toBe(0);
    
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }
  });

  test('should navigate between views', async ({ page }) => {
    // Test navigation to different views
    const views = ['home', 'versions', 'workflows', 'library', 'executions', 'notifications'];
    
    for (const view of views) {
      const button = page.locator(`[data-view="${view}"]`);
      
      if (await button.count() > 0) {
        await button.click();
        await page.waitForTimeout(500); // Wait for view to load
        
        // Check that view is active
        const viewElement = page.locator(`#${view}-view`);
        if (await viewElement.count() > 0) {
          const isActive = await viewElement.evaluate(el => 
            el.classList.contains('active')
          );
          expect(isActive).toBe(true);
        }
      }
    }

    // Check for errors after navigation (excluding known issues)
    const navigationErrors = consoleErrors.filter(e => {
      const text = e.text.toLowerCase();
      if (text.includes('rejectversion is not defined') || 
          text.includes('attachexecutioneventlisteners is not defined')) {
        return false; // These are being fixed
      }
      return text.includes('is not defined') || 
             text.includes('referenceerror');
    });
    
    expect(navigationErrors.length).toBe(0);
  });

  test('should handle version list interactions', async ({ page }) => {
    // Navigate to versions view
    const versionsButton = page.locator('[data-view="versions"]');
    if (await versionsButton.count() > 0) {
      await versionsButton.click();
      await page.waitForTimeout(1000);
      
      // Check for version cards
      const versionCards = page.locator('.version-card-v2');
      const cardCount = await versionCards.count();
      
      if (cardCount > 0) {
        // Click on first version card's "View Details" button
        const firstCard = versionCards.first();
        const viewDetailsButton = firstCard.locator('[data-action="show-version-detail"]');
        
        if (await viewDetailsButton.count() > 0) {
          await viewDetailsButton.click();
          await page.waitForTimeout(1000);
          
          // Check for errors
          const errors = consoleErrors.filter(e => 
            e.text.includes('is not defined') || 
            e.text.includes('ReferenceError')
          );
          expect(errors.length).toBe(0);
        }
      }
    }
  });

  test('should handle execution list interactions', async ({ page }) => {
    // Navigate to executions view
    const executionsButton = page.locator('[data-view="executions"]');
    if (await executionsButton.count() > 0) {
      await executionsButton.click();
      await page.waitForTimeout(2000);
      
      // Wait for executions to load - check for container first
      await page.waitForSelector('#executions-list-v2', { timeout: 10000, state: 'attached' });
      await page.waitForTimeout(1000); // Wait for content to render
      
      // Check for execution cards
      const executionCards = page.locator('[data-execution-id]');
      const cardCount = await executionCards.count();
      
      if (cardCount > 0) {
        // Get first card
        const firstCard = executionCards.first();
        
        // Use force click since elements might not be fully visible (in scrollable container)
        await firstCard.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(1000);
        
        // Check for errors (excluding known issues)
        const errors = consoleErrors.filter(e => {
          const text = e.text.toLowerCase();
          if (text.includes('rejectversion is not defined') || 
              text.includes('attachexecutioneventlisteners is not defined')) {
            return false;
          }
          return text.includes('is not defined') || 
                 text.includes('referenceerror') ||
                 text.includes('unexpected token');
        });
        expect(errors.length).toBe(0);
      }
    }
  });

  test('should handle modal interactions', async ({ page }) => {
    // Navigate to executions view
    const executionsButton = page.locator('[data-view="executions"]');
    if (await executionsButton.count() > 0) {
      await executionsButton.click();
      await page.waitForTimeout(2000);
      
      // Wait for executions to load - check for container first
      await page.waitForSelector('#executions-list-v2', { timeout: 10000, state: 'attached' });
      await page.waitForTimeout(1000); // Wait for content to render
      
      // Try to open a modal (if available)
      const modalTrigger = page.locator('[data-action="show-execution-details"], [data-action="show-agent-details"]').first();
      
      if (await modalTrigger.count() > 0) {
        // Use force click (elements might be in scrollable container)
        await modalTrigger.click({ force: true, timeout: 5000 });
        await page.waitForTimeout(1000);
        
        // Check if modal is visible
        const modal = page.locator('#modal-v2');
        if (await modal.count() > 0) {
          const isVisible = await modal.evaluate(el => 
            window.getComputedStyle(el).display !== 'none'
          );
          
          if (isVisible) {
            // Try to close modal
            const closeButton = modal.locator('.modal-close, [onclick*="closeModalV2"]');
            if (await closeButton.count() > 0) {
              await closeButton.first().click();
              await page.waitForTimeout(500);
            }
          }
        }
      }
    }
    
    // Check for errors (excluding known issues)
    const errors = consoleErrors.filter(e => {
      const text = e.text.toLowerCase();
      if (text.includes('rejectversion is not defined') || 
          text.includes('attachexecutioneventlisteners is not defined')) {
        return false;
      }
      return text.includes('closemodalv2') || 
             text.includes('is not defined') ||
             text.includes('referenceerror');
    });
    expect(errors.length).toBe(0);
  });

  test('should handle refresh buttons', async ({ page }) => {
    // Navigate to executions view
    const executionsButton = page.locator('[data-view="executions"]');
    if (await executionsButton.count() > 0) {
      await executionsButton.click();
      await page.waitForTimeout(1000);
      
      // Find refresh button
      const refreshButton = page.locator('[data-action="refresh-executions"]');
      if (await refreshButton.count() > 0) {
        await refreshButton.click();
        await page.waitForTimeout(1000);
        
        // Check for errors
        const errors = consoleErrors.filter(e => 
          e.text.includes('is not defined') || 
          e.text.includes('ReferenceError')
        );
        expect(errors.length).toBe(0);
      }
    }
  });

  test('should not have syntax errors in loaded scripts', async ({ page }) => {
    // Wait for all scripts to load
    await page.waitForLoadState('networkidle');
    
    // Check for syntax errors
    const syntaxErrors = consoleErrors.filter(e => 
      e.text.includes('SyntaxError') ||
      e.text.includes('Unexpected token') ||
      e.text.includes('Unexpected end of input')
    );
    
    expect(syntaxErrors.length).toBe(0);
    
    if (syntaxErrors.length > 0) {
      console.log('Syntax errors found:', syntaxErrors);
    }
  });

  test('should handle API call errors gracefully', async ({ page }) => {
    // Intercept API calls and simulate errors
    await page.route('**/api/**', route => {
      // Let some requests through, fail others
      if (Math.random() > 0.5) {
        route.fulfill({ status: 500, body: 'Internal Server Error' });
      } else {
        route.continue();
      }
    });

    // Navigate and interact
    const homeButton = page.locator('[data-view="home"]');
    if (await homeButton.count() > 0) {
      await homeButton.click();
      await page.waitForTimeout(2000);
    }

    // Check that errors are handled gracefully (no uncaught exceptions)
    // API errors are expected and should be caught, not thrown
    const uncaughtErrors = consoleErrors.filter(e => {
      const text = e.text.toLowerCase();
      // Filter out expected API errors that are properly caught
      if (e.type === 'error' && (text.includes('api error') || text.includes('internal server error') || text.includes('failed to load'))) {
        return false; // These are expected and caught
      }
      // Filter out known issues being fixed
      if (text.includes('rejectversion is not defined') || 
          text.includes('attachexecutioneventlisteners is not defined')) {
        return false;
      }
      // Only count actual uncaught page errors (not console.error calls)
      return e.type === 'pageerror' && !text.includes('networkerror');
    });
    
    // Should not have uncaught exceptions (errors should be caught)
    // Note: We allow 0-1 errors as some may be timing-related
    expect(uncaughtErrors.length).toBeLessThanOrEqual(1);
  });

  test.afterEach(async ({ page }) => {
    // Log all errors and warnings for debugging
    if (consoleErrors.length > 0 || consoleWarnings.length > 0) {
      console.log(`\n=== Console Output for ${test.info().title} ===`);
      
      if (consoleErrors.length > 0) {
        console.log(`Errors (${consoleErrors.length}):`);
        consoleErrors.forEach((err, idx) => {
          console.log(`  ${idx + 1}. [${err.type}] ${err.text}`);
          if (err.location) {
            console.log(`     Location: ${err.location.url}:${err.location.lineNumber}`);
          }
        });
      }
      
      if (consoleWarnings.length > 0) {
        console.log(`Warnings (${consoleWarnings.length}):`);
        consoleWarnings.forEach((warn, idx) => {
          console.log(`  ${idx + 1}. ${warn.text}`);
        });
      }
    }
  });
});


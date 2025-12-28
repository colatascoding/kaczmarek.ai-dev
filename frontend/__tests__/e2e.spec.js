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
  });

  test('should load home page without console errors', async ({ page }) => {
    // Check for critical errors
    const criticalErrors = consoleErrors.filter(e => 
      e.text.includes('is not defined') || 
      e.text.includes('Unexpected token') ||
      e.text.includes('SyntaxError') ||
      e.text.includes('ReferenceError')
    );

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

    // Check for errors after navigation
    const navigationErrors = consoleErrors.filter(e => 
      e.text.includes('is not defined') || 
      e.text.includes('ReferenceError')
    );
    
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
      await page.waitForTimeout(1000);
      
      // Check for execution cards
      const executionCards = page.locator('[data-execution-id]');
      const cardCount = await executionCards.count();
      
      if (cardCount > 0) {
        // Click on first execution card
        const firstCard = executionCards.first();
        await firstCard.click();
        await page.waitForTimeout(1000);
        
        // Check for errors
        const errors = consoleErrors.filter(e => 
          e.text.includes('is not defined') || 
          e.text.includes('ReferenceError') ||
          e.text.includes('Unexpected token')
        );
        expect(errors.length).toBe(0);
      }
    }
  });

  test('should handle modal interactions', async ({ page }) => {
    // Navigate to executions view
    const executionsButton = page.locator('[data-view="executions"]');
    if (await executionsButton.count() > 0) {
      await executionsButton.click();
      await page.waitForTimeout(1000);
      
      // Try to open a modal (if available)
      const modalTrigger = page.locator('[data-action="show-execution-details"], [data-action="show-agent-details"]').first();
      
      if (await modalTrigger.count() > 0) {
        await modalTrigger.click();
        await page.waitForTimeout(500);
        
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
    
    // Check for errors
    const errors = consoleErrors.filter(e => 
      e.text.includes('closeModalV2') || 
      e.text.includes('is not defined') ||
      e.text.includes('ReferenceError')
    );
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
      await page.waitForTimeout(1000);
    }

    // Check that errors are handled gracefully (no uncaught exceptions)
    const uncaughtErrors = consoleErrors.filter(e => 
      e.type === 'pageerror' && 
      !e.text.includes('NetworkError') // Network errors are expected
    );
    
    // Should not have uncaught exceptions (errors should be caught)
    expect(uncaughtErrors.length).toBe(0);
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


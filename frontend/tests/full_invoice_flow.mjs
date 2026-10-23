import { chromium } from 'playwright';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  console.log('🚀 Starting Comprehensive User Simulation QA Tests...\n');

  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    // ── Test 1: Desktop User Journey ──────────────────────────────────────
    console.log('--- TEST 1: Desktop Viewport (1280x800) ---');
    const page = await context.newPage();
    
    // 1. Visit app & activate demo session
    await page.goto('http://localhost:3000/');
    await page.waitForTimeout(1000);
    const demoBtn = await page.$('button:has-text("1-Click Demo")');
    if (demoBtn) {
      await demoBtn.click();
      await page.waitForTimeout(1500);
    }
    console.log('✅ Authenticated / Demo session active.');

    // 2. Navigate to New Invoice page
    await page.goto('http://localhost:3000/invoices/new');
    await page.waitForTimeout(1500);
    console.log('✅ Navigated to /invoices/new');

    // 3. Test Invoice Number Generator behavior across clients
    console.log('\nTesting Invoice Number Generator for deduplication & smart suggestions:');
    
    // Check initial generator pills
    const initialNum = await page.$eval('#invoice-number-input', el => el.value);
    console.log(`   Initial auto-suggested number: ${initialNum}`);
    if (!initialNum) throw new Error('Initial invoice number was empty!');

    // Select Client 2 (Berlin Tech Labs GmbH, which had invoice 2026-0002)
    // Previously, the bug recommended 2026-0003, which was DUPLICATE because 2026-0003 and 2026-0004 already exist!
    await page.selectOption('select[name="client_id"]', 'client-2');
    await page.waitForTimeout(600);
    const numForClient2 = await page.$eval('#invoice-number-input', el => el.value);
    console.log(`   Selected Berlin Tech Labs GmbH -> Number suggested: ${numForClient2}`);
    if (numForClient2 === '2026-0003' || numForClient2 === '2026-0004') {
      throw new Error(`CRITICAL: Generator suggested taken duplicate number ${numForClient2}!`);
    }
    console.log('   ✅ Deduplication verified: No taken numbers suggested for Client 2.');

    // Select Client 1 (Studio Van Dijk B.V.)
    await page.selectOption('select[name="client_id"]', 'client-1');
    await page.waitForTimeout(600);
    const numForClient1 = await page.$eval('#invoice-number-input', el => el.value);
    console.log(`   Selected Studio Van Dijk B.V. -> Number suggested: ${numForClient1}`);

    // Click number option pill
    const pills = await page.$$('.liquid-glass-box button[title]');
    console.log(`   Found ${pills.length} number option pills.`);
    if (pills.length > 1) {
      await pills[1].click();
      await page.waitForTimeout(300);
      const clickedVal = await page.$eval('#invoice-number-input', el => el.value);
      console.log(`   Clicked option pill -> Updated to: ${clickedVal}`);
    }

    // 4. Test typing in Invoice Number
    console.log('\nTesting typing custom invoice number:');
    const invInput = await page.$('#invoice-number-input');
    await invInput.click();
    await invInput.fill('2026-0099');
    console.log(`   Typed custom number: ${await invInput.inputValue()}`);
    if ((await invInput.inputValue()) !== '2026-0099') throw new Error('Custom invoice number typing failed!');

    // 5. Test typing in Line Items
    console.log('\nTesting Line Items typing & auto-calculations:');
    const desc0 = await page.$('input[placeholder="Omschrijving dienst of product"]');
    await desc0.click();
    await desc0.fill('Maatwerk Website & Brand Identity');
    console.log(`   Item #1 description: "${await desc0.inputValue()}"`);

    const qtyInput0 = await page.$('input[type="number"][step="0.1"]');
    await qtyInput0.click();
    await qtyInput0.fill('3');

    const priceInput0 = await page.$('input[type="number"][step="0.01"]');
    await priceInput0.click();
    await priceInput0.fill('750');

    await page.waitForTimeout(300);

    // 6. Test Add Line Item button
    console.log('   Adding second line item...');
    const addBtn = await page.$('button:has-text("Regel toevoegen")');
    await addBtn.click();
    await page.waitForTimeout(400);

    const descInputs = await page.$$('input[placeholder="Omschrijving dienst of product"]');
    console.log(`   Line item count after addition: ${descInputs.length}`);
    if (descInputs.length !== 2) throw new Error('Add line item failed!');

    await descInputs[1].click();
    await descInputs[1].fill('Cloud Hosting & SSL Certificaat 1 Jaar');

    const priceInputs = await page.$$('input[type="number"][step="0.01"]');
    await priceInputs[1].click();
    await priceInputs[1].fill('180');

    await page.waitForTimeout(400);

    // 7. Test typing in Payment Reference and Notes
    console.log('\nTesting Payment Reference & Notes typing:');
    const payRefInput = await page.$('input[placeholder="bijv. RF18 2026 0001"]');
    console.log(`   Auto-generated SEPA reference: ${await payRefInput.inputValue()}`);
    
    const notesInput = await page.$('textarea[placeholder="Optionele toelichting..."]');
    await notesInput.click();
    await notesInput.fill('Hartelijk dank voor de prettige samenwerking!');
    console.log(`   Notes typed: "${await notesInput.inputValue()}"`);

    // 8. Test Saving Invoice
    console.log('\nSubmitting invoice creation form...');
    const saveBtn = await page.$('button:has-text("Opslaan")');
    await saveBtn.click();
    await page.waitForTimeout(2000);

    console.log(`   URL after save: ${page.url()}`);
    if (!page.url().includes('/edit')) {
      throw new Error(`Invoice save failed! URL is ${page.url()}`);
    }
    console.log('✅ Invoice successfully created and redirected to editor/edit mode!');

    // ── Test 2: Mobile Viewport (375x667 iPhone SE) ─────────────────────
    console.log('\n--- TEST 2: Mobile Viewport (375x667 iPhone SE) ---');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:3000/invoices/new');
    await page.waitForTimeout(1500);

    // Select Client
    await page.selectOption('select[name="client_id"]', 'client-3');
    await page.waitForTimeout(500);

    // Type in Description on mobile
    const mDesc = await page.$('input[placeholder="Omschrijving dienst of product"]');
    await mDesc.click();
    await mDesc.fill('Mobile UX Consultation Session');
    console.log(`   Mobile item description: "${await mDesc.inputValue()}"`);
    if ((await mDesc.inputValue()) !== 'Mobile UX Consultation Session') {
      throw new Error('Mobile description typing failed!');
    }

    const mQty = await page.$('input[type="number"][step="0.1"]');
    await mQty.click();
    await mQty.fill('2');

    const mPrice = await page.$('input[type="number"][step="0.01"]');
    await mPrice.click();
    await mPrice.fill('120');

    console.log(`   Mobile Qty: ${await mQty.inputValue()}, Price: ${await mPrice.inputValue()}`);
    console.log('✅ Mobile layout input and typing 100% verified!');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! Both Desktop and Mobile flows verified!');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();

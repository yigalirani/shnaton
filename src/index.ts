import puppeteer, { Browser } from 'puppeteer';
function extractTextAndNumber(input: string){
  if (input==null)
    return null
  const match = input.match(/^(.*)\s*\((\d+)\)$/);
  return match ? { text: match[1].trim(), id: parseInt(match[2], 10) } : null;
}
async function scrapeFacultyOptions(browser: Browser) {
  const page = await browser.newPage();

  // Navigate to the website
  console.log('Navigating to HUJI website...');
  await page.goto('https://shnaton.huji.ac.il/', {
    waitUntil: 'load',
    timeout: 30000
  });

  // Wait for the faculty input element to be available
  console.log('Waiting for faculty input element...');
  await page.waitForSelector('#facultyInput', { timeout: 10000 });

  // Click on the faculty input
  console.log('Clicking on faculty input...');
  await page.click('#facultyInput');
 
  // Type a space to trigger the dropdown
  console.log('Typing space to trigger dropdown...');
  await page.type('#facultyInput', ' ');

  // Wait for the dropdown menu to appear
  console.log('Waiting for dropdown menu...');
  await page.waitForSelector('#ui-id-1', {
    visible: true,
    timeout: 10000
  });

  // Wait a bit more to ensure all options are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Extract all items from the dropdown
  console.log('Extracting faculty options...');
  const items = await page.evaluate(()=>{
    const dropdown=document.querySelector('#ui-id-1')
    if (!dropdown) return [];
    return Array.from(dropdown.querySelectorAll('li')).map(el=>el.textContent)

  })
  const ans=[]
  for (const item of items){
    const parsed=extractTextAndNumber(item)
    if (parsed!=null)
      ans.push(parsed)
  }

  return ans
} 

// Main execution
async function main() {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for headless mode
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
    
  });

  const facultyData = await scrapeFacultyOptions(browser);

  // Optional: Save to JSON file
  const fs = await import('fs/promises'); 
  await fs.writeFile(
    'faculty-options.json',
    JSON.stringify(facultyData, null, 2)
  );
  console.log('Results saved to faculty-options.json'); 
}

// Run the script
main();
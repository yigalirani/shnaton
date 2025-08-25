import puppeteer, { Browser,Page } from 'puppeteer';
import * as fs from 'fs/promises'; 
function extractTextAndNumber(input: string){
  if (input==null)
    return null
  const match = input.match(/^(.*)\s*\((\d+)\)$/);
  return match ? { text: match[1].trim(), id: parseInt(match[2], 10) } : null;
}
interface FacultyData{
  id:number,
  text:string

}
async function click(page:Page,id:string){
  // Wait for the faculty input element to be available
  console.log('clicking...',id);
  await page.waitForSelector(id, { timeout: 10000 });
  await page.click(id);
  await page.type(id, ' ');
}
async function download_from_selector(page:Page,id:string){
  await page.waitForSelector(id, {
    visible: true,
    timeout: 10000
  });

  // Wait a bit more to ensure all options are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Extract all items from the dropdown
  console.log('download_from_selector...',id);
  const items = await page.evaluate((id)=>{
    const dropdown=document.querySelector(id)
    if (!dropdown) return [];
    return Array.from(dropdown.querySelectorAll('li')).map(el=>el.textContent)

  },id)
  const ans=[]
  for (const item of items){
    const parsed=extractTextAndNumber(item)
    if (parsed!=null)
      ans.push(parsed)
  }
  return ans
}
async function page_goto(page:Page,url:string){
  console.log(url)
   await page.goto(url, {
    waitUntil: 'load',
    timeout: 30000
  });
}

async function scrapeFacultyOptions(browser: Browser) {
  const page = await browser.newPage();

  // Navigate to the website
  console.log('Navigating to HUJI website...');
  await page_goto(page,'https://shnaton.huji.ac.il/')
  await click(page,'#facultyInput')
  return await download_from_selector(page,'#ui-id-1')
}

async function download_all_hug(browser: Browser, facultyData: FacultyData[]): Promise<(FacultyData & { hugs: any })[]> {
  const promises = facultyData.map(async (faculty) => {
    const { id } = faculty;
    const page = await browser.newPage();
    await page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${id}`);
    await click(page, '#chugInput');
    const hugs = await download_from_selector(page, '#ui-id-2');
    await page.close();
    
    return {
      ...faculty,
      hugs
    };
  });
  
  return await Promise.all(promises);
}
async function main() {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for headless mode
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
    
  });

  const facultyData:FacultyData[] = await scrapeFacultyOptions(browser);
  await fs.writeFile(
    'data/faculty-options.json',
    JSON.stringify(facultyData, null, 2)
  );  
  const hug_data=await download_all_hug(browser,facultyData)
  await fs.writeFile(
    'data/hug_data.json',
    JSON.stringify(hug_data, null, 2)
  ); 


console.log('Results saved to faculty-options.json'); 
}

// Run the script
main();
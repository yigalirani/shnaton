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
interface FacultyDataEx extends FacultyData{
  departments: {
        text: string;
        id: number;
    }[];
}
async function page_waitForSelector(page:Page,selector_id:string){
  await page.waitForSelector(selector_id, {
    visible: true,
    timeout: 10000
  });
    // Wait a bit more to ensure all options are loaded
  await new Promise(resolve => setTimeout(resolve, 1000));
}
async function type_at_selector(page:Page,id:string,text:string){
  // Wait for the faculty input element to be available
  console.log(`typing... ${id} '${text}'`);
  await page_waitForSelector(page,id);
  await page.click(id);
  await page.type(id, text);
}
async function download_from_selector(page:Page,id:string){
  await page_waitForSelector(page,id)

  // Extract all items from the dropdown
  console.log('download_from_selector...',id);
  const items = await page.evaluate((id)=>{
    const dropdown=document.querySelector(id)
    if (!dropdown) return [];
    return Array.from(dropdown.querySelectorAll('li')).map(el=>el.textContent)

  },id)
  const ans=[]
  for (const item of items){
    if (item==null)
      continue
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
  await type_at_selector(page,'#facultyInput',' ')
  return await download_from_selector(page,'#ui-id-1')
}

async function download_all_departments(browser: Browser, facultyData: FacultyData[]):Promise<FacultyDataEx[]>{
  const promises = facultyData.map(async (faculty) => {
    const { id } = faculty;
    const page = await browser.newPage();
    await page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${id}`);
    await type_at_selector(page, '#chugInput',' ');
    const departments = await download_from_selector(page, '#ui-id-2');
    await page.close();
    return {
      ...faculty,
      departments
    };
  });
  
  return await Promise.all(promises);
}
async function download_cources_of_one_dept(browser:Browser,faculy_id:number,department_id:number){
  const page = await browser.newPage();
  await page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${faculy_id}`)
  type_at_selector(page, '#chugInput',department_id+'');
  return {todo:'download_cources_of_one_dept'}
}
async function download_all_cources(browser:Browser,depts:FacultyDataEx[]){
}
async function fs_writeFile(filename:string,data:object){
  const str=JSON.stringify(data, null, 2)
  console.log('save ',filename,str.length,' chars')  
  await fs.writeFile(filename,str)
}
async function download_department_data(browser:Browser):Promise<FacultyDataEx[]>{
  const facultyData:FacultyData[] = await scrapeFacultyOptions(browser);
  await fs_writeFile('data/faculty-options.json',facultyData)
  const department_data=await download_all_departments(browser,facultyData)
  await fs_writeFile('data/department_data.json',department_data)
  return department_data
}
async function read_department_data(){
  const ans = await fs.readFile('data/department_data.json','utf8')
  const jsonans = JSON.parse(ans)
  return jsonans as FacultyDataEx[]
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true, // Set to true for headless mode
    defaultViewport: null,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
    
  });
  const depts=await download_department_data(browser)
  //const depts=await read_department_data()
  // /const cources=download_all_cources(browser,depts)
  await fs_writeFile('data/department_data3.json',depts)
}

// Run the script
main();
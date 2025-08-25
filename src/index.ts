import puppeteer, { Browser,Page } from 'puppeteer';
import * as utils from './utils'

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

async function scrapeFacultyOptions(browser: Browser) {
  const page = await browser.newPage();
  await utils.page_goto(page,'https://shnaton.huji.ac.il/')
  await utils.type_at_selector(page,'#facultyInput',' ')
  return await utils.download_from_selector(page,'#ui-id-1')
}

async function download_all_departments(browser: Browser, facultyData: FacultyData[]):Promise<FacultyDataEx[]>{
  const promises = facultyData.map(async (faculty) => {
    const { id } = faculty;
    const page = await browser.newPage();
    await utils.page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${id}`);
    await utils.type_at_selector(page, '#chugInput',' ');
    const departments = await utils.download_from_selector(page, '#ui-id-2');
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
  await utils.page_goto(page, `https://shnaton.huji.ac.il/index.php/default/NextForm/2026/${faculy_id}`)
  utils.type_at_selector(page, '#chugInput',department_id+'');
  return {todo:'download_cources_of_one_dept'}
}
async function download_all_cources(browser:Browser,depts:FacultyDataEx[]){
}

async function download_department_data(browser:Browser):Promise<FacultyDataEx[]>{
  const facultyData:FacultyData[] = await scrapeFacultyOptions(browser);
  await utils.fs_writeFile('data/faculty-options.json',facultyData)
  const department_data=await download_all_departments(browser,facultyData)
  await utils.fs_writeFile('data/department_data.json',department_data)
  return department_data
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
  await utils.fs_writeFile('data/department_data3.json',depts)
}

// Run the script
main();